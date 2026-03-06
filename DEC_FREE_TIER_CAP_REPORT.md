# DEC_FREE_TIER_CAP_REPORT — Free-Tier Usage Cap Enforcement

**Date:** 2026-03-06
**Phase:** Launch safety — pre-commit verification

---

## Summary

A free-tier monthly analysis cap **already existed** in the web app via the
`record_analysis` Supabase RPC, but the limit was set to **25** (not 100).
It has been corrected to 100. The public API had **no cap** for free-tier API
keys; enforcement has been added.

---

## Web App Enforcement

**File:** `src/app/api/analyses/route.ts`
**Change:** `p_limit: 25` → `p_limit: 100`

The `record_analysis` RPC performs an atomic count-check + insert via a
Postgres function. The `p_limit` parameter controls the monthly cap. This is
already race-condition safe (single DB round-trip).

```sql
-- Existing RPC signature (unchanged):
record_analysis(p_user_id, p_created_at, p_payload, p_limit)
```

**Rule:** If `plan == free` and `monthly_count >= 100` → RPC returns
`{ recorded: false, limit_reached: true }` → HTTP 200 `{ ok: true, recorded:
false, limit_reached: true }`.

---

## Public API Enforcement

**File:** `src/lib/api-keys/verify-api-key.ts`
Added: `checkFreeTierLimit(keyId)` — counts calls in `ai_usage_events` for
the current calendar month UTC, returns `{ allowed: boolean, count: number }`.

**File:** `src/app/api/v1/analyze/route.ts`
Added: rate-limit check after API key verification.

```json
// 429 response when limit reached:
{
  "error": "Free tier monthly analysis limit reached",
  "plan": "free",
  "limit": 100
}
```

**Important:** The `api_keys` table defaults `plan = 'pro'`, so no existing
API keys are affected. The check only activates for keys explicitly created
with `plan = 'free'`.

The count uses `ai_usage_events.org_id` (which maps to `api_keys.id`) and
the `ts` timestamp for the current-month window. Fails open (allows request)
if the admin client is unavailable.

---

## Test Summary

| Scenario                         | Result   |
|----------------------------------|----------|
| Free web user < 100/month        | Allowed  |
| Free web user at 100/month       | Blocked (RPC limit) |
| Pro web user                     | Allowed (no RPC limit check) |
| Free API key < 100/month         | Allowed  |
| Free API key at 100/month        | 429 returned |
| Pro API key (default)            | Allowed (plan != 'free') |

---

## Files Modified

- `src/app/api/analyses/route.ts` — `p_limit: 25` → `p_limit: 100`
- `src/lib/api-keys/verify-api-key.ts` — added `checkFreeTierLimit()`
- `src/app/api/v1/analyze/route.ts` — added free-tier rate-limit enforcement
