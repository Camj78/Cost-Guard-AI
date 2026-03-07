# DEC_FINAL_BILLING_LAUNCH_REPORT

Date: 2026-03-06
Pass: SP-DEC FINAL-BILLING-LAUNCH

---

## 1. Chosen Team Launch Mode

**MODE B — Team backend-ready, contact sales / coming soon**

Rationale:
- `/upgrade` page renders Free vs Pro comparison only
- `handleUpgrade()` sends `{ plan }` (monthly/annual), never `{ tier: "team" }`
- No Team pricing card on landing page (`/`)
- `.env.example` explicitly stated: "backend-ready; UI not yet exposed"
- Self-serve Team checkout would require UI changes not approved for this pass

---

## 2. Files Changed

| File | Change |
|------|--------|
| `docs/pricing.md` | Team header updated: added "_(available on request)_" note + contact email; upgrade path changed from UI flow to contact email |
| `README.md` | Team column price updated: "$99 / month _(on request)_"; added note below table directing to contact email |

**Files verified unchanged (no action needed):**
| File | Status |
|------|--------|
| `docs/launch/producthunt.md` | No Team references — clean |
| `docs/launch/hn-post.md` | No Team references — mentions Free + Pro only — clean |
| `src/app/upgrade/page.tsx` | Correctly exposes Pro only — no change |
| `src/app/page.tsx` | Landing pricing shows Free + Pro only — no change |
| `src/app/api/checkout/route.ts` | Defaults to `tier: "pro"`; accepts `tier: "team"` from body only — backend-ready, no UI path — no change |
| `src/app/api/me/route.ts` | Returns `plan: row.plan ?? (isPro ? "pro" : "free")` — correctly returns "team" for team users — no change |
| `src/lib/entitlement.ts` | `hasProAccess("team") = true`, `isTeam("team") = true` — correct — no change |

---

## 3. Where Team Is Exposed vs Hidden

### Hidden (UI)
- `/upgrade` page — no Team tier selector, no Team checkout button
- `/` landing page — no Team pricing card
- `handleUpgrade()` — never sends `tier: "team"` to `/api/checkout`

### Backend-ready (not user-reachable from UI)
- `/api/checkout` — accepts `{tier: "team"}` from POST body; resolves STRIPE_PRICE_TEAM_MONTHLY / YEARLY env vars
- `/api/me` — returns `plan: "team"` if user row has `plan = "team"`
- `entitlement.ts` — `hasProAccess("team")`, `isTeam("team")` both implemented
- Stripe webhook — maps Team price IDs to `plan: "team"` in DB

### Contact path for Team
- `docs/pricing.md` now directs to `team@costguardai.io`
- `README.md` notes "available on request" with same contact

---

## 4. Final User-Facing Pricing Copy

**README.md (pricing table):**
```
| | Free | Pro | Team |
| Price | $0 | $29 / month | $99 / month (on request) |
...
> Team plan is backend-ready. Self-serve checkout coming soon —
> contact team@costguardai.io to activate.
```

**docs/pricing.md (Team section):**
```
### Team — $99 / organization / month (available on request)

Backend infrastructure is complete. Self-serve checkout is coming soon.
Contact team@costguardai.io to activate a Team plan.
```

**docs/pricing.md (upgrade path):**
```
Pro → Team
  When: multiple developers need a shared policy layer
  How:  Contact team@costguardai.io — self-serve checkout coming soon
```

**docs/launch/producthunt.md:** No Team references — unchanged.
**docs/launch/hn-post.md:** No Team references — unchanged.

---

## 5. Entitlement Verification

| Scenario | `/api/me` returns | `hasProAccess()` | `isTeam()` |
|----------|------------------|-----------------|------------|
| Free user | `plan: "free"`, `pro: false` | false | false |
| Pro user | `plan: "pro"`, `pro: true` | true | false |
| Team user | `plan: "team"`, `pro: true` | true | true |

All three paths correctly modeled. Team users inherit all Pro features.
`usage_limit: null` for Pro/Team users (isPro covers both via `row.pro = true`).

---

## 6. Checkout Truthfulness

The public upgrade flow:
1. User visits `/upgrade`
2. Selects monthly or annual toggle
3. Clicks "Upgrade to Pro"
4. `handleUpgrade()` posts `{ plan: "monthly" | "annual" }` to `/api/checkout`
5. Backend creates Stripe session for `tier: "pro"`

No UI path to Team checkout exists. The backend is ready to accept `{tier: "team"}` but no surface sends it. This is correct for Mode B.

---

## 7. Verification Results

```
pnpm typecheck → clean (0 errors)
```

- No broken Team references in UI
- No misleading self-serve Team language remaining
- No UI path to non-functional Team checkout
- Existing Pro flow unmodified

---

## 8. Commit

```
launch: finalize billing surfaces for Team readiness
```

Staged: docs/pricing.md, README.md
