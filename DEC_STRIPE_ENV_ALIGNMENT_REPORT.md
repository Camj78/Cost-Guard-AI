# DEC_STRIPE_ENV_ALIGNMENT_REPORT

**Date:** 2026-03-06
**Scope:** Align Stripe billing flows to new plan-specific env vars
**Status:** Complete — typecheck clean, 10/10 tests pass

---

## Summary

Vercel env vars were migrated from two legacy variables (`STRIPE_PRICE_ID`,
`STRIPE_ANNUAL_PRICE_ID`) to four plan-specific variables. This report documents
what changed, what was preserved, and the verification results.

---

## Old Env Var Usage — Removed

| Variable | Previous usage | Disposition |
|---|---|---|
| `STRIPE_PRICE_ID` | Monthly Pro price — inline in `/api/checkout` | **Removed** from all active code paths |
| `STRIPE_ANNUAL_PRICE_ID` | Annual Pro price — inline in `/api/checkout` with fallback to `STRIPE_PRICE_ID` | **Removed** from all active code paths |

Both variables have been removed from `.env.example`.

---

## New Canonical Env Vars

| Variable | Plan | Interval | Status |
|---|---|---|---|
| `STRIPE_PRICE_PRO_MONTHLY` | Pro | Monthly | Active — used in checkout |
| `STRIPE_PRICE_PRO_YEARLY` | Pro | Yearly | Active — used in checkout |
| `STRIPE_PRICE_TEAM_MONTHLY` | Team | Monthly | Backend-ready — UI not yet exposed |
| `STRIPE_PRICE_TEAM_YEARLY` | Team | Yearly | Backend-ready — UI not yet exposed |

---

## Files Changed

### Created
- `src/lib/stripe/price-lookup.ts` — canonical plan + interval → price ID helper

  Exports:
  - `getPriceId(plan, interval)` — resolves price ID from env var; throws with env key name if missing
  - `resolvePlanFromPriceId(priceId)` — maps Stripe price ID back to internal plan (`"pro"` | `"team"` | `null`)

- `tests/stripe-price-lookup.test.ts` — 10 targeted tests for price-lookup helper

### Modified
- `src/app/api/checkout/route.ts`
  - Added import: `getPriceId`, `BillingInterval` from `@/lib/stripe/price-lookup`
  - Replaced inline `STRIPE_PRICE_ID` / `STRIPE_ANNUAL_PRICE_ID` env var reads with `getPriceId("pro", interval)`
  - Maps UI's `"annual"` → `"yearly"` interval for helper compatibility

- `.env.example`
  - Removed `STRIPE_PRICE_ID` and `STRIPE_ANNUAL_PRICE_ID`
  - Added all four plan-specific price ID vars with inline annotations

- `package.json`
  - Added `"test:stripe-price-lookup"` script

### Not Changed
- `src/app/api/webhooks/stripe/route.ts` — no change needed; webhook sets `pro: true/false` based on subscription status, not price ID. `resolvePlanFromPriceId` is available for future Team plan DB mapping.
- `src/app/api/billing/route.ts` — no price ID usage; billing portal only
- `src/app/upgrade/page.tsx` — no change; still sends `{ plan: "monthly" | "annual" }` for Pro checkout
- `docs/pricing.md` — no change; already correctly documents Pro and Team tiers

---

## Checkout Mapping Summary

| UI `plan` param | Internal interval | Helper call | Env var resolved |
|---|---|---|---|
| `"monthly"` | `"monthly"` | `getPriceId("pro", "monthly")` | `STRIPE_PRICE_PRO_MONTHLY` |
| `"annual"` | `"yearly"` | `getPriceId("pro", "yearly")` | `STRIPE_PRICE_PRO_YEARLY` |

Team checkout is not yet exposed in the UI. The backend helper supports it:

| Plan | Interval | Helper call | Env var |
|---|---|---|---|
| `"team"` | `"monthly"` | `getPriceId("team", "monthly")` | `STRIPE_PRICE_TEAM_MONTHLY` |
| `"team"` | `"yearly"` | `getPriceId("team", "yearly")` | `STRIPE_PRICE_TEAM_YEARLY` |

---

## Webhook / Plan Assignment Mapping

The webhook is unchanged. It resolves plan status from Stripe subscription lifecycle
events, not from price IDs. The internal mapping is:

| Stripe event | Subscription status | Internal `pro` flag |
|---|---|---|
| `checkout.session.completed` | — | `true` (pending) |
| `customer.subscription.created/updated` | `active`, `trialing` | `true` |
| `customer.subscription.created/updated` | anything else | `false` |
| `customer.subscription.deleted` | — | `false` |
| `invoice.payment_succeeded` | — | `true` (active) |

Both Pro and (future) Team subscriptions will set `pro: true`. A dedicated `plan`
column in the `users` table can be added when the Team tier is launched in UI.
`resolvePlanFromPriceId` is ready for that migration.

---

## Verification Results

```
pnpm typecheck → clean (0 errors)

pnpm test:stripe-price-lookup

getPriceId
  ✓ pro + monthly returns STRIPE_PRICE_PRO_MONTHLY
  ✓ pro + yearly returns STRIPE_PRICE_PRO_YEARLY
  ✓ team + monthly returns STRIPE_PRICE_TEAM_MONTHLY
  ✓ team + yearly returns STRIPE_PRICE_TEAM_YEARLY
  ✓ missing env var throws with key name in message

resolvePlanFromPriceId
  ✓ pro monthly price ID resolves to 'pro'
  ✓ pro yearly price ID resolves to 'pro'
  ✓ team monthly price ID resolves to 'team'
  ✓ team yearly price ID resolves to 'team'
  ✓ unknown price ID returns null

10 passed, 0 failed
```

---

## Remaining Gaps

| Gap | Disposition |
|---|---|
| Team checkout not exposed in UI | By design — Team tier is not yet launched |
| Webhook does not store billing interval | No DB column for it; acceptable for current Free/Pro model |
| `users.plan` column does not exist | Required when Team tier launches; `resolvePlanFromPriceId` is ready |
| No billing integration tests | Out of scope — no live Stripe test mode keys in CI |
