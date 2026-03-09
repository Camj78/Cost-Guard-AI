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

    // Guarantee users profile row exists (legacy path / auth trigger safety net).
    const { data: profileRow } = await supabase
      .from("users")
      .select("pro, pro_status, plan, first_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profileRow) {
      await supabase.from("users").upsert(
        { id: user.id, email: user.email },
        { onConflict: "id" }
      );
    }

    // Canonical entitlement: read from billing_accounts first.
    const { data: billingRow } = await supabase
      .from("billing_accounts")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle();

    let effectivePlan: Plan;

    if (billingRow) {
      // billing_accounts row exists — it is the authoritative source.
      effectivePlan =
        billingRow.plan && billingRow.plan !== PLANS.FREE
          ? (billingRow.plan as Plan)
          : PLANS.FREE;
    } else {
      // No billing_accounts row yet — fall back to legacy users fields
      // so existing paid users don't lose access during migration.
      effectivePlan =
        profileRow?.plan && profileRow.plan !== PLANS.FREE
          ? (profileRow.plan as Plan)
          : profileRow?.pro === true
          ? PLANS.PRO
          : PLANS.FREE;
    }

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

    const founderEmails = (process.env.FOUNDER_EMAIL ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isFounder =
      founderEmails.length > 0 &&
      founderEmails.includes(user.email?.toLowerCase() ?? "");

    return NextResponse.json({
      pro: isPro,
      pro_status: billingRow?.status ?? profileRow?.pro_status ?? null,
      plan: effectivePlan,
      is_authed: true,
      usage_this_month: usedThisMonth,
      usage_limit: isPro ? null : 25,
      firstName: profileRow?.first_name ?? null,
      isFounder,
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
