import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { resolvePlanFromPriceId } from "@/lib/stripe/price-lookup";
import { PLANS } from "@/config/plans";

export const runtime = "nodejs";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-01-28.clover" });
}

function getAdminClient(): SupabaseClient | null {
  // Fall back to NEXT_PUBLIC_SUPABASE_URL if SUPABASE_URL is not set.
  // .env.example only documents NEXT_PUBLIC_SUPABASE_URL; both point to the same project.
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("[stripe/webhook] Missing STRIPE_WEBHOOK_SECRET");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    console.error(
      "[stripe/webhook] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"
    );
    return new Response("Database client not configured", { status: 500 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    console.error("[stripe/webhook] Stripe init error:", e);
    return new Response("Stripe not configured", { status: 500 });
  }

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

  console.info("[stripe/webhook] received:", event.type, event.id);

  // Idempotency: skip duplicates; fail-open if stripe_events table is absent
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
    // Table may not exist or transient error — log and continue processing
    console.warn(
      "[stripe/webhook] stripe_events insert error (continuing):",
      insertErr.code,
      insertErr.message
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      // Primary: client_reference_id set in /api/checkout
      let userId = session.client_reference_id ?? "";

      // Fallback: look up by Stripe customer email if client_reference_id is absent
      if (!userId && customerId) {
        userId = await getUserIdFromCustomer(customerId, stripe, supabaseAdmin);
      }

      if (!userId) {
        console.warn(
          "[stripe/webhook] checkout.session.completed: could not resolve userId for customer",
          customerId
        );
        break;
      }

      // Resolve plan from session metadata (set by /api/checkout).
      // Default to FREE — customer.subscription.created fires next and will
      // set the correct plan via price ID lookup, so this is self-correcting.
      const sessionPlan = session.metadata?.plan ?? PLANS.FREE;

      // Look up email so we can UPSERT the row if it doesn't exist yet.
      // Supabase UPDATE silently no-ops on a missing row; UPSERT guarantees
      // billing state is persisted even if the auth trigger never fired.
      const { data: checkoutAuthData } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      const checkoutEmail = checkoutAuthData?.user?.email;

      const { error: e1 } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            id: userId,
            ...(checkoutEmail ? { email: checkoutEmail } : {}),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            pro: sessionPlan !== PLANS.FREE,
            pro_status: "pending",
            plan: sessionPlan,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (e1) {
        console.error("[stripe/webhook] checkout upsert error:", e1.message);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;

      const userId =
        sub.metadata?.user_id ||
        (await getUserIdFromCustomer(
          sub.customer as string,
          stripe,
          supabaseAdmin
        ));

      if (!userId) {
        console.warn(
          "[stripe/webhook]",
          event.type,
          ": could not resolve userId for customer",
          sub.customer
        );
        break;
      }

      // Resolve plan: prefer metadata set by /api/checkout, then price ID lookup.
      // Default to FREE — never escalate access for unrecognized price IDs.
      const metaPlan = sub.metadata?.plan;
      const priceId = sub.items?.data[0]?.price?.id;
      const resolvedPlan =
        metaPlan ?? (priceId ? resolvePlanFromPriceId(priceId) : null) ?? PLANS.FREE;

      if (!metaPlan && !resolvePlanFromPriceId(priceId ?? "")) {
        console.warn(
          "[stripe/webhook]",
          event.type,
          ": could not resolve plan from metadata or price ID",
          priceId,
          "— defaulting to free"
        );
      }

      const isPro = sub.status === "active" || sub.status === "trialing";

      // Look up email for UPSERT — same rationale as checkout.session.completed.
      const { data: subAuthData } =
        await supabaseAdmin.auth.admin.getUserById(userId);
      const subEmail = subAuthData?.user?.email;

      const { error: e2 } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            id: userId,
            ...(subEmail ? { email: subEmail } : {}),
            pro: isPro,
            pro_status: sub.status,
            plan: isPro ? resolvedPlan : "free",
            stripe_subscription_id: sub.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (e2) {
        console.error(
          "[stripe/webhook]",
          event.type,
          "upsert error:",
          e2.message
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;

      const userId =
        sub.metadata?.user_id ||
        (await getUserIdFromCustomer(
          sub.customer as string,
          stripe,
          supabaseAdmin
        ));

      if (!userId) {
        console.warn(
          "[stripe/webhook] customer.subscription.deleted: could not resolve userId",
          sub.customer
        );
        break;
      }

      const { error: e3 } = await supabaseAdmin
        .from("users")
        .update({
          pro: false,
          pro_status: "canceled",
          plan: "free",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (e3) {
        console.error(
          "[stripe/webhook] subscription.deleted update error:",
          e3.message
        );
      }
      break;
    }

    // invoice.paid is the preferred modern event; invoice.payment_succeeded is
    // the legacy alias. Both fire for the same payment — idempotency via
    // stripe_events prevents double-processing.
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      // Cast to include subscription field — present in webhook payloads but
      // removed from the TypeScript type in API version 2026-01-28+
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      // Only process subscription invoices, not one-off charges
      if (!invoice.subscription) break;

      const customerId = invoice.customer as string;

      const userId = await getUserIdFromCustomer(
        customerId,
        stripe,
        supabaseAdmin
      );

      if (!userId) {
        console.warn(
          "[stripe/webhook]",
          event.type,
          ": could not resolve userId",
          customerId
        );
        break;
      }

      // Renewal: restore active status. The plan column is authoritative and
      // was set by subscription.created/updated — no need to re-derive it here
      // unless the subscription's price ID changes (handled by subscription.updated).
      const { error: e4 } = await supabaseAdmin
        .from("users")
        .update({
          pro: true,
          pro_status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (e4) {
        console.error(
          "[stripe/webhook]",
          event.type,
          "update error:",
          e4.message
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      // Cast to include subscription field (same as invoice.paid handling above)
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      // Only process subscription invoices, not one-off charges
      if (!invoice.subscription) break;

      const customerId = invoice.customer as string;

      const userId = await getUserIdFromCustomer(
        customerId,
        stripe,
        supabaseAdmin
      );

      if (!userId) {
        console.warn(
          "[stripe/webhook] invoice.payment_failed: could not resolve userId",
          customerId
        );
        break;
      }

      // Policy: mark pro_status as past_due for observability only.
      // Do NOT revoke plan access here — Stripe will retry the charge per
      // dunning settings. If all retries fail, Stripe fires
      // customer.subscription.updated (status: "past_due"/"unpaid") or
      // customer.subscription.deleted, which handle the actual downgrade.
      const { error: e5 } = await supabaseAdmin
        .from("users")
        .update({
          pro_status: "past_due",
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (e5) {
        console.error(
          "[stripe/webhook] invoice.payment_failed update error:",
          e5.message
        );
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
}

/**
 * Resolve a Supabase user_id from a Stripe customer ID.
 * Resolution order:
 *   1. Stripe customer metadata.user_id (set in /api/checkout)
 *   2. Supabase users table email lookup using Stripe customer email
 * Returns "" on any failure.
 */
async function getUserIdFromCustomer(
  customerId: string,
  stripe: Stripe,
  supabaseAdmin: SupabaseClient
): Promise<string> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return "";
    const stripeCustomer = customer as Stripe.Customer;

    // 1. Metadata lookup (fastest path — set by /api/checkout)
    const metaUserId = stripeCustomer.metadata?.user_id;
    if (metaUserId) return metaUserId;

    // 2. Email fallback: look up by email in Supabase users table
    const email = stripeCustomer.email;
    if (email) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.warn(
          "[stripe/webhook] email lookup error:",
          error.code,
          error.message
        );
      }

      if (data?.id) return data.id;
    }

    console.warn(
      "[stripe/webhook] getUserIdFromCustomer: no match for customer",
      customerId
    );
    return "";
  } catch (e) {
    console.error(
      "[stripe/webhook] getUserIdFromCustomer error for customer",
      customerId,
      ":",
      e
    );
    return "";
  }
}
