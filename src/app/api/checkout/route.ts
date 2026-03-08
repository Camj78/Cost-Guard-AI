import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import {
  getPriceId,
  type BillingInterval,
  type StripePlan,
} from "@/lib/stripe/price-lookup";
import { hasProAccess } from "@/lib/entitlement";
import { PLANS } from "@/config/plans";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    let interval: BillingInterval = "monthly";
    let tier: StripePlan = "pro";
    try {
      const body = await req.json();
      if (body?.plan === "annual") interval = "yearly";
      if (body?.tier === "team") tier = "team";
    } catch {
      // No body or invalid JSON — use defaults
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Guarantee the users row exists before Stripe creates the subscription.
    // Supabase UPDATE silently no-ops when the target row is absent, so any
    // webhook that fires before this row exists would silently lose billing state.
    await supabase
      .from("users")
      .upsert({ id: user.id, email: user.email }, { onConflict: "id" });

    const { data: userRow } = await supabase
      .from("users")
      .select("pro, plan, stripe_customer_id")
      .eq("id", user.id)
      .single();

    // Already subscribed — redirect to billing portal to manage plan.
    // Use plan column (source of truth); fall back to legacy pro boolean
    // only if plan is absent (e.g., pre-migration row).
    const isAlreadyPaid =
      hasProAccess(userRow?.plan ?? PLANS.FREE) || userRow?.pro === true;
    if (isAlreadyPaid) {
      const customerId = userRow?.stripe_customer_id;
      if (customerId) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: APP_URL,
        });
        return NextResponse.json({ url: portalSession.url });
      }
    }

    // Get or create Stripe customer
    let customerId = userRow?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const priceId = getPriceId(tier, interval);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { plan: tier },
      subscription_data: {
        metadata: { user_id: user.id, plan: tier },
      },
      success_url: `${APP_URL}/?checkout=success`,
      cancel_url: `${APP_URL}/upgrade`,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
