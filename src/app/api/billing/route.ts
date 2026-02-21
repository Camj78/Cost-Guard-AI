import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function POST() {
  try {
    const stripe = getStripe();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!userRow?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userRow.stripe_customer_id,
      return_url: APP_URL,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
