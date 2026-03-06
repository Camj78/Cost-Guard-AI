# DEC: Free Tier Cap Alignment Report

**Date:** 2026-03-06
**Status:** Complete
**Canonical Free Cap:** 25 analyses / month

---

## Problem

Pre-launch audit revealed a misalignment between the intended Free tier cap (25/month)
and the implemented cap (100/month) across enforcement code and docs.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/api-keys/verify-api-key.ts` | `FREE_TIER_MONTHLY_LIMIT`: `100` → `25` |
| `src/app/api/v1/analyze/route.ts` | Error response `limit`: `100` → `25` |
| `src/app/api/analyses/route.ts` | RPC `p_limit`: `100` → `25` |
| `docs/pricing.md` | All `100` free-tier references → `25` (3 occurrences) |
| `README.md` | Pricing table `100` → `25` |

**Unchanged (already correct):**
- `src/app/upgrade/page.tsx` — already showed `25 / month`

---

## Enforcement Locations

### Web App (`/api/analyses` POST)
- Path: `src/app/api/analyses/route.ts:175`
- Mechanism: Supabase RPC `record_analysis(p_limit)` — atomic count-check + insert
- Behavior: `monthly_count >= 25 AND plan=free` → `{ recorded: false, limit_reached: true }`

### Public API (`/api/v1/analyze` POST)
- Path: `src/app/api/v1/analyze/route.ts:40`
- Mechanism: `checkFreeTierLimit()` → if not allowed → HTTP 429
- Response:
  ```json
  { "error": "Free tier monthly analysis limit reached", "plan": "free", "limit": 25 }
  ```

### API Key Free-Tier Check (`verify-api-key.ts`)
- Path: `src/lib/api-keys/verify-api-key.ts:23`
- Constant: `FREE_TIER_MONTHLY_LIMIT = 25`
- Mechanism: Counts rows in `ai_usage_events` for current calendar month (UTC) scoped to `org_id = keyId`
- Returns: `{ allowed: n < 25, count: n }`

---

## Verification

| Scenario | Expected | Result |
|---|---|---|
| Free, count < 25 | Allowed | ✓ |
| Free, count >= 25 | Blocked (HTTP 429 / `limit_reached: true`) | ✓ |
| Pro | Allowed (no limit check) | ✓ |
| Team | Allowed (no limit check) | ✓ |

TypeScript: **clean** (`pnpm typecheck` — 0 errors)

---

## Enforcement Flow Summary

```
POST /api/analyses  (web app)
  └── isPro? → no  → supabase.rpc("record_analysis", { p_limit: 25 })
                        └── count >= 25 → limit_reached: true (no insert)
                        └── count < 25  → insert → recorded: true

POST /api/v1/analyze  (public API)
  └── keyRecord.plan === "free"
        └── checkFreeTierLimit(keyId)  → FREE_TIER_MONTHLY_LIMIT = 25
              └── allowed: false → HTTP 429 { error, plan, limit: 25 }
              └── allowed: true  → proceed
```

Pro and Team are unaffected. No limit check is applied to those plans.
