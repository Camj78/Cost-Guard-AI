import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { getPriceId, type BillingInterval } from "@/lib/stripe/price-lookup";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    let plan: "monthly" | "annual" = "monthly";
    try {
      const body = await req.json();
      if (body?.plan === "annual") plan = "annual";
    } catch {
      // No body or invalid JSON — default to monthly
    }
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("pro, stripe_customer_id")
      .eq("id", user.id)
      .single();

    // Already Pro — redirect to billing portal instead
    if (userRow?.pro) {
      const customerId = userRow.stripe_customer_id;
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

    // Create Checkout session — Pro plan only; team tier not yet exposed in UI
    const interval: BillingInterval = plan === "annual" ? "yearly" : "monthly";
    const priceId = getPriceId("pro", interval);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { user_id: user.id },
      },
      success_url: `${APP_URL}/?checkout=success`,
      cancel_url: `${APP_URL}/upgrade`,
    });

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
