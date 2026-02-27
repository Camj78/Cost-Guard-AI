import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

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
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Unauthenticated: exit early — never insert with null user_id
    if (!user) {
      return NextResponse.json({ ok: true, recorded: false });
    }

    const body = await req.json();
    const prompt_hash = String(body.prompt_hash ?? "").trim();
    const model_id = String(body.model_id ?? "").trim();
    const input_tokens = Number(body.input_tokens);
    const output_tokens = Number(body.output_tokens);
    const cost_total = Number(body.cost_total);
    const risk_score = Number(body.risk_score);

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
    const { data: userRow, error: userRowErr } = await supabase
      .from("users")
      .select("pro")
      .eq("id", user.id)
      .single();

    // Fail-closed: if users lookup errors (RLS etc.), refuse to record
    if (userRowErr) {
      return NextResponse.json({ ok: false, recorded: false });
    }

    const isPro = userRow?.pro === true;

    if (!isPro) {
      // Atomic count-check + insert via RPC — prevents race condition under concurrent requests
      const { data: rpcData, error: rpcErr } = await supabase.rpc("record_analysis", {
        p_user_id: user.id,
        p_created_at: new Date().toISOString(),
        p_payload: { prompt_hash, model_id, input_tokens, output_tokens, cost_total, risk_score },
        p_limit: 25,
      });

      if (rpcErr) {
        return NextResponse.json({ ok: false, recorded: false });
      }

      const result = rpcData as { recorded: boolean; limit_reached: boolean; id?: string };
      if (!result.recorded) {
        return NextResponse.json({ ok: true, recorded: false, limit_reached: result.limit_reached ?? false });
      }

      return NextResponse.json({ ok: true, recorded: true, id: result.id ?? null });
    }

    // Pro tier: no monthly limit — insert directly
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
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, recorded: false });
    }

    return NextResponse.json({ ok: true, recorded: true, id: inserted?.id ?? null });
  } catch {
    return NextResponse.json({ ok: false, recorded: false });
  }
}
