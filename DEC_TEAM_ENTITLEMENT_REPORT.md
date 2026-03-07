# DEC_TEAM_ENTITLEMENT_REPORT

Date: 2026-03-06
Sprint: SP-DEC TEAM-ENTITLEMENT

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/add_plan_to_users.sql` | New — adds `plan` text column, backfills Pro users |
| `src/lib/entitlement.ts` | New — `AppPlan` type + `hasProAccess()` + `isTeam()` helpers |
| `src/app/api/checkout/route.ts` | Updated — accepts `tier` param, passes `plan` metadata to Stripe |
| `src/app/api/webhooks/stripe/route.ts` | Updated — resolves plan from price ID / metadata, writes `plan` column |
| `src/app/api/me/route.ts` | Updated — selects and returns `plan` field |

---

## Internal Plan Model

```
AppPlan = "free" | "pro" | "team"
```

Stored in `public.users.plan` (text, NOT NULL, DEFAULT 'free').

| plan  | pro boolean | Access                              |
|-------|------------|-------------------------------------|
| free  | false      | 25 analyses/month                   |
| pro   | true       | Unlimited + history + compare + CI  |
| team  | true       | All Pro features (Team superset)    |

`hasProAccess(plan)` — true for "pro" and "team"
`isTeam(plan)` — true for "team" only

---

## Checkout Mapping

Request body:
```json
{ "tier": "pro" | "team", "plan": "monthly" | "annual" }
```

| tier | plan     | Stripe Price Env Var          |
|------|----------|-------------------------------|
| pro  | monthly  | STRIPE_PRICE_PRO_MONTHLY      |
| pro  | annual   | STRIPE_PRICE_PRO_YEARLY       |
| team | monthly  | STRIPE_PRICE_TEAM_MONTHLY     |
| team | annual   | STRIPE_PRICE_TEAM_YEARLY      |

`tier` defaults to "pro" if absent (preserves existing Pro-only UI behavior).

Stripe session carries `metadata.plan` and `subscription_data.metadata.plan` for webhook resolution.

---

## Webhook Entitlement Mapping

| Stripe Event                         | plan written              | Notes |
|--------------------------------------|---------------------------|-------|
| `checkout.session.completed`         | `session.metadata.plan`   | Fallback: "pro" |
| `customer.subscription.created`      | `sub.metadata.plan` or price ID lookup | |
| `customer.subscription.updated`      | same as above             | handles upgrades/downgrades |
| `customer.subscription.deleted`      | "free"                    | also sets `pro: false` |
| `invoice.payment_succeeded`          | unchanged (plan set by subscription events) | |

Price ID resolution uses `resolvePlanFromPriceId()` from `src/lib/stripe/price-lookup.ts`:
- `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY` → "pro"
- `STRIPE_PRICE_TEAM_MONTHLY` / `STRIPE_PRICE_TEAM_YEARLY` → "team"

---

## Entitlement Helper Behavior

```ts
// src/lib/entitlement.ts
hasProAccess("free")  // false
hasProAccess("pro")   // true
hasProAccess("team")  // true

isTeam("pro")         // false
isTeam("team")        // true
```

---

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS — 0 errors |
| Pro checkout resolves `STRIPE_PRICE_PRO_MONTHLY/YEARLY` | Verified via getPriceId("pro", interval) |
| Team checkout resolves `STRIPE_PRICE_TEAM_MONTHLY/YEARLY` | Verified via getPriceId("team", interval) |
| Webhook maps Team price to plan = "team" | Via resolvePlanFromPriceId() |
| Existing Pro users backfilled to plan = "pro" | Via migration UPDATE WHERE pro = true |
| Subscription deleted resets plan to "free" | Confirmed in webhook handler |
| /api/me returns `plan` field | Confirmed |
| No Team self-serve UI exposed prematurely | Confirmed — upgrade page Pro-only |

---

## Remaining Gaps

- Team self-serve checkout UI not exposed (intentional — backend-ready only)
- Team-specific features (shared history, exports) not yet implemented (planned)
- Billing portal does not yet surface Team plan name in portal (Stripe product naming — out of scope)
