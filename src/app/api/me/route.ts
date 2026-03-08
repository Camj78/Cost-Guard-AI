import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { PLANS, type Plan } from "@/config/plans";
import { hasProAccess } from "@/lib/entitlement";

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
      .select("pro, pro_status, plan")
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
        plan: "free",
        is_authed: true,
        usage_this_month: 0,
        usage_limit: 25,
      });
    }

    // Canonical effective plan resolution.
    // plan column is the primary source of truth; if it is null/free but the
    // pro boolean is true (e.g. post-checkout before subscription.created fires,
    // or after invoice.paid which does not write plan), fall back to PLANS.PRO
    // so the user retains their valid entitlement.
    const effectivePlan: Plan =
      row.plan && row.plan !== PLANS.FREE
        ? (row.plan as Plan)
        : row.pro === true
        ? PLANS.PRO
        : PLANS.FREE;
    const isPro = hasProAccess(effectivePlan);

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
      plan: effectivePlan,
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
