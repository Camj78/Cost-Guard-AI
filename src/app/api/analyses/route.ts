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

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
    ).toISOString();

    // Fetch pro flag — check error separately to avoid false-free-tier gating
    const { data: userRow, error: userRowErr } = await supabase
      .from("users")
      .select("pro")
      .eq("id", user.id)
      .single();

    // If users lookup errors (RLS etc.) → skip gating entirely, fail-open
    if (!userRowErr) {
      const isPro = userRow?.pro === true;

      if (!isPro) {
        const { count, error: countErr } = await supabase
          .from("analysis_history")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", monthStart);

        // Only gate when count is reliable and at limit
        if (!countErr && (count ?? 0) >= 25) {
          return NextResponse.json({ ok: true, recorded: false, limit_reached: true });
        }
      }
    }

    const { error } = await supabase.from("analysis_history").insert({
      user_id: user.id,
      prompt_hash,
      model_id,
      input_tokens,
      output_tokens,
      cost_total,
      risk_score,
    });

    if (error) {
      return NextResponse.json({ ok: false, recorded: false });
    }

    return NextResponse.json({ ok: true, recorded: true });
  } catch {
    return NextResponse.json({ ok: false, recorded: false });
  }
}
