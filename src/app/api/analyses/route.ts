import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { recordAnalysisRun } from "@/lib/telemetry/analysis-run";
import { recordAiUsageEvent } from "@/lib/telemetry/ai-usage-event";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("analysis_history")
      .select(
        "id, prompt_hash, model_id, input_tokens, output_tokens, cost_total, risk_score, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ analyses: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const runId = crypto.randomUUID();
  const start = Date.now();

  return await Sentry.startSpan(
    { name: "api.analyses", op: "http.server" },
    async (span) => {
      const deployment = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
      span.setAttribute("deployment", deployment);
      span.setAttribute("route", "/api/analyses");
      span.setAttribute("runId", runId);

      try {
        const supabase = await createSupabaseServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Unauthenticated: exit early — never insert with null user_id
        if (!user) {
          return NextResponse.json({ ok: true, recorded: false });
        }

        span.setAttribute("userId", user.id);

        const body = await req.json();
        const prompt_hash = String(body.prompt_hash ?? "").trim();
        const model_id = String(body.model_id ?? "").trim();
        const input_tokens = Number(body.input_tokens);
        const output_tokens = Number(body.output_tokens);
        const cost_total = Number(body.cost_total);
        const risk_score = Number(body.risk_score);
        const truncated = body.truncated === true;
        const compressionUsed = Boolean(body.compressionUsed ?? body.compression_used ?? false);
        // Trust fields (optional, gracefully absent for legacy callers)
        const analysis_version = typeof body.analysis_version === "string" ? body.analysis_version.trim() : "1.0.0";
        const score_version    = typeof body.score_version    === "string" ? body.score_version.trim()    : "v1.0";
        const ruleset_hash     = typeof body.ruleset_hash     === "string" ? body.ruleset_hash.trim()     : null;
        const input_hash       = typeof body.input_hash       === "string" ? body.input_hash.trim()       : null;

        span.setAttribute("model", model_id);
        span.setAttribute("truncated", truncated);
        span.setAttribute("compressionUsed", compressionUsed);

        if (
          !prompt_hash ||
          !model_id ||
          !Number.isFinite(input_tokens) ||
          !Number.isFinite(output_tokens) ||
          !Number.isFinite(cost_total) ||
          !Number.isFinite(risk_score)
        ) {
          return NextResponse.json({ ok: false, recorded: false });
        }

        // Fetch pro flag — check error separately to avoid false-free-tier gating
        let { data: userRow, error: userRowErr } = await supabase
          .from("users")
          .select("pro")
          .eq("id", user.id)
          .single();

        // PGRST116 = "no rows" — new/incognito account; upsert then re-fetch
        if (userRowErr?.code === "PGRST116") {
          const { error: upsertErr } = await supabase
            .from("users")
            .upsert(
              {
                id: user.id,
                email: user.email ?? null,
                pro: false,
                pro_status: "free",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );

          if (!upsertErr) {
            ({ data: userRow, error: userRowErr } = await supabase
              .from("users")
              .select("pro")
              .eq("id", user.id)
              .single());
          } else {
            userRowErr = upsertErr;
          }
        }

        // Fail-closed: real DB/RLS errors still block recording
        if (userRowErr) {
          return NextResponse.json({ ok: false, recorded: false });
        }

        const isPro = userRow?.pro === true;
        span.setAttribute("plan", isPro ? "pro" : "free");

        // Telemetry — best-effort, non-blocking
        await Sentry.startSpan(
          { name: "telemetry.recordAnalysisRun", op: "function" },
          async () => {
            void recordAnalysisRun({
              runId,
              userId: user.id,
              plan: isPro ? "pro" : "free",
              model: model_id,
              inputTokens: input_tokens,
              outputTokens: output_tokens,
              cost: cost_total,
              latencyMs: Date.now() - start,
              truncated,
              compressionUsed,
            });
          }
        );

        // AI usage event — observability telemetry
        void recordAiUsageEvent({
          endpoint: "/api/analyses",
          model: model_id,
          tokensIn: input_tokens,
          tokensOut: output_tokens,
          latencyMs: Date.now() - start,
          orgId: user.id,
        });

        let result: NextResponse;

        if (!isPro) {
          // Atomic count-check + insert via RPC — prevents race condition under concurrent requests
          result = await Sentry.startSpan(
            { name: "analysis.recordFree", op: "db.query" },
            async (innerSpan) => {
              const { data: rpcData, error: rpcErr } = await supabase.rpc("record_analysis", {
                p_user_id: user.id,
                p_created_at: new Date().toISOString(),
                p_payload: { prompt_hash, model_id, input_tokens, output_tokens, cost_total, risk_score },
                p_limit: 25,
              });

              if (rpcErr) {
                innerSpan.setAttribute("rpcError", true);
                return NextResponse.json({ ok: false, recorded: false });
              }

              const rpcResult = rpcData as { recorded: boolean; limit_reached: boolean; id?: string };
              innerSpan.setAttribute("recorded", rpcResult.recorded);
              if (!rpcResult.recorded) {
                return NextResponse.json({ ok: true, recorded: false, limit_reached: rpcResult.limit_reached ?? false });
              }

              return NextResponse.json({ ok: true, recorded: true, id: rpcResult.id ?? null });
            }
          );
        } else {
          // Pro tier: no monthly limit — insert directly
          result = await Sentry.startSpan(
            { name: "analysis.recordPro", op: "db.query" },
            async (innerSpan) => {
              const { data: inserted, error } = await supabase
                .from("analysis_history")
                .insert({
                  user_id: user.id,
                  prompt_hash,
                  model_id,
                  input_tokens,
                  output_tokens,
                  cost_total,
                  risk_score,
                  analysis_version,
                  score_version,
                  ruleset_hash,
                  input_hash,
                })
                .select("id")
                .single();

              if (error) {
                innerSpan.setAttribute("insertError", true);
                return NextResponse.json({ ok: false, recorded: false });
              }

              return NextResponse.json({ ok: true, recorded: true, id: inserted?.id ?? null });
            }
          );
        }

        span.setAttribute("latencyMs", Date.now() - start);
        return result;
      } catch (err) {
        Sentry.captureException(err);
        return NextResponse.json({ ok: false, recorded: false });
      }
    }
  );
}
