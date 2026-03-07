/**
 * CostGuardAI — Stripe price-lookup helper tests
 * Run with: pnpm test:stripe-price-lookup
 */

import { getPriceId, resolvePlanFromPriceId } from "../src/lib/stripe/price-lookup";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.info(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function assertThrows(label: string, fn: () => unknown, messageFragment: string): void {
  try {
    fn();
    console.error(`  ✗ FAIL: ${label} — expected throw, got none`);
    failed++;
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg.includes(messageFragment)) {
      console.info(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${label} — wrong error: "${msg}"`);
      failed++;
    }
  }
}

// ── Setup: inject synthetic env vars ─────────────────────────────────────────

process.env.STRIPE_PRICE_PRO_MONTHLY  = "price_pro_monthly_test";
process.env.STRIPE_PRICE_PRO_YEARLY   = "price_pro_yearly_test";
process.env.STRIPE_PRICE_TEAM_MONTHLY = "price_team_monthly_test";
process.env.STRIPE_PRICE_TEAM_YEARLY  = "price_team_yearly_test";

// ── getPriceId ────────────────────────────────────────────────────────────────

console.info("\ngetPriceId");

assert(
  "pro + monthly returns STRIPE_PRICE_PRO_MONTHLY",
  getPriceId("pro", "monthly") === "price_pro_monthly_test"
);
assert(
  "pro + yearly returns STRIPE_PRICE_PRO_YEARLY",
  getPriceId("pro", "yearly") === "price_pro_yearly_test"
);
assert(
  "team + monthly returns STRIPE_PRICE_TEAM_MONTHLY",
  getPriceId("team", "monthly") === "price_team_monthly_test"
);
assert(
  "team + yearly returns STRIPE_PRICE_TEAM_YEARLY",
  getPriceId("team", "yearly") === "price_team_yearly_test"
);

// Missing env var throws
const origProMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY;
delete process.env.STRIPE_PRICE_PRO_MONTHLY;
assertThrows(
  "missing env var throws with key name in message",
  () => getPriceId("pro", "monthly"),
  "STRIPE_PRICE_PRO_MONTHLY"
);
process.env.STRIPE_PRICE_PRO_MONTHLY = origProMonthly;

// ── resolvePlanFromPriceId ────────────────────────────────────────────────────

console.info("\nresolvePlanFromPriceId");

assert(
  "pro monthly price ID resolves to 'pro'",
  resolvePlanFromPriceId("price_pro_monthly_test") === "pro"
);
assert(
  "pro yearly price ID resolves to 'pro'",
  resolvePlanFromPriceId("price_pro_yearly_test") === "pro"
);
assert(
  "team monthly price ID resolves to 'team'",
  resolvePlanFromPriceId("price_team_monthly_test") === "team"
);
assert(
  "team yearly price ID resolves to 'team'",
  resolvePlanFromPriceId("price_team_yearly_test") === "team"
);
assert(
  "unknown price ID returns null",
  resolvePlanFromPriceId("price_unknown_xyz") === null
);

// ── Summary ───────────────────────────────────────────────────────────────────

console.info(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
