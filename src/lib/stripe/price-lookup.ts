/**
 * Stripe price ID resolution helpers.
 *
 * Canonical env vars:
 *   STRIPE_PRICE_PRO_MONTHLY
 *   STRIPE_PRICE_TEAM_MONTHLY
 *   STRIPE_PRICE_PRO_YEARLY
 *   STRIPE_PRICE_TEAM_YEARLY
 *
 * Usage:
 *   import { getPriceId } from "@/lib/stripe/price-lookup";
 *   const priceId = getPriceId("pro", "monthly");
 */

export type StripePlan = "pro" | "team";
export type BillingInterval = "monthly" | "yearly";

const ENV_VAR_MAP: Record<StripePlan, Record<BillingInterval, string>> = {
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
  team: {
    monthly: "STRIPE_PRICE_TEAM_MONTHLY",
    yearly: "STRIPE_PRICE_TEAM_YEARLY",
  },
};

/**
 * Returns the Stripe price ID for the given plan + interval.
 * Throws with a clear message if the required env var is missing.
 */
export function getPriceId(plan: StripePlan, interval: BillingInterval): string {
  const envKey = ENV_VAR_MAP[plan][interval];
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new Error(`Missing required Stripe env var: ${envKey}`);
  }
  return priceId;
}

/**
 * Maps a Stripe price ID back to an internal plan name.
 * Both monthly and yearly variants resolve to the same plan.
 * Returns null if the price ID is not recognized by any configured env var.
 */
export function resolvePlanFromPriceId(priceId: string): StripePlan | null {
  const matches: Array<[StripePlan, string]> = [
    ["pro", process.env.STRIPE_PRICE_PRO_MONTHLY ?? ""],
    ["pro", process.env.STRIPE_PRICE_PRO_YEARLY ?? ""],
    ["team", process.env.STRIPE_PRICE_TEAM_MONTHLY ?? ""],
    ["team", process.env.STRIPE_PRICE_TEAM_YEARLY ?? ""],
  ];

  for (const [plan, id] of matches) {
    if (id && id === priceId) return plan;
  }
  return null;
}
