import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST() {
  try {
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

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
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
