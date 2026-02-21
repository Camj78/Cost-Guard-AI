import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const stripe = getStripe();
  const rawBody = Buffer.from(await req.arrayBuffer());
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  // Idempotency: skip if already processed, retry on DB error
  const { error: insertErr } = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id });

  if (insertErr) {
    const isDuplicate =
      insertErr.code === "23505" ||
      insertErr.message?.includes("duplicate") ||
      insertErr.details?.includes("already exists");
    if (isDuplicate) {
      return new Response("ok", { status: 200 });
    }
    return new Response("DB error", { status: 500 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (!userId) break;

      const subscriptionId = session.subscription as string;
      const customerId = session.customer as string;

      // Store IDs and mark pending; subscription.updated is authoritative for pro=true
      await supabaseAdmin
        .from("users")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          pro_status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId =
        sub.metadata?.user_id ||
        (await getUserIdFromCustomer(sub.customer as string));
      if (!userId) break;

      // pro=true only for active or trialing; false for everything else
      const isPro = sub.status === "active" || sub.status === "trialing";
      await supabaseAdmin
        .from("users")
        .update({
          pro: isPro,
          pro_status: sub.status,
          stripe_subscription_id: sub.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId =
        sub.metadata?.user_id ||
        (await getUserIdFromCustomer(sub.customer as string));
      if (!userId) break;

      await supabaseAdmin
        .from("users")
        .update({
          pro: false,
          pro_status: "canceled",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      break;
    }
  }

  return new Response("ok", { status: 200 });
}

// Fallback: look up user_id from Stripe customer metadata
// Returns "" if customer is deleted, has no metadata, or on error
async function getUserIdFromCustomer(customerId: string): Promise<string> {
  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return "";
    return (customer as Stripe.Customer).metadata?.user_id ?? "";
  } catch {
    return "";
  }
}
