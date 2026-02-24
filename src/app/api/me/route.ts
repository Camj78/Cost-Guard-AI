import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        pro: false,
        pro_status: null,
        is_authed: false,
        usage_this_month: 0,
        usage_limit: 25,
      });
    }

    const { data: row } = await supabase
      .from("users")
      .select("pro, pro_status")
      .eq("id", user.id)
      .single();

    if (!row) {
      // Trigger didn't run or legacy user — upsert the row
      await supabase.from("users").upsert(
        { id: user.id, email: user.email },
        { onConflict: "id" }
      );
      return NextResponse.json({
        pro: false,
        pro_status: null,
        is_authed: true,
        usage_this_month: 0,
        usage_limit: 25,
      });
    }

    const isPro = row.pro === true;

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
    ).toISOString();

    const { count, error: countErr } = await supabase
      .from("analysis_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart);

    const usedThisMonth = countErr || count === null ? 0 : count;

    return NextResponse.json({
      pro: row.pro,
      pro_status: row.pro_status,
      is_authed: true,
      usage_this_month: usedThisMonth,
      usage_limit: isPro ? null : 25,
    });
  } catch {
    return NextResponse.json({
      pro: false,
      pro_status: null,
      is_authed: false,
      usage_this_month: 0,
      usage_limit: 25,
    });
  }
}
