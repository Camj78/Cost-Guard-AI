# DEC_PRICING_REPORT — Launch: Pricing Tiers

**Sprint:** Launch Prep — Pricing Model
**Date:** 2026-03-06
**Status:** Complete

---

## Artifacts Created / Modified

| File | Action |
|---|---|
| `README.md` | Modified — pricing table + link to docs/pricing.md inserted before V2 ideas section |
| `docs/pricing.md` | Created — full pricing documentation |
| `DEC_PRICING_REPORT.md` | Created — this report |

**No core systems modified.** Risk engine, CI guardrails, observability schema, trust layer, API behavior, and routing are untouched.

---

## Tier Definitions

### Free — $0
- CLI analysis
- RiskScore + explainability
- Shareable reports
- 100 analyses per month
- Basic CI usage (output only)

### Pro — $29 / developer / month
- Everything in Free
- Unlimited analyses
- CI guardrails (`--fail-on-risk`)
- PR comments (GitHub)
- Observability dashboard
- Replay + trust verification

### Team — $99 / organization / month
- Everything in Pro
- Organization dashboard
- Team risk policies
- Repo-level thresholds
- Cross-project cost tracking
- Audit logs

---

## README Pricing Section

Inserted at `README.md` before the `## V2 ideas` section.
Content: Markdown comparison table (3 tiers × 15 features) with link to `docs/pricing.md`.

---

## docs/pricing.md Summary

Five sections:
1. **Tier Overview** — narrative description of each tier with use-case context
2. **Feature Comparison** — full table (15 rows, 3 tiers)
3. **Upgrade Path** — Free → Pro → Team with trigger conditions
4. **CI Guardrails value explanation** — ROI framing for the Pro tier gate feature
5. **Team Policies explanation** — concrete policy JSON example
6. **What CostGuard Prevents** — positioning statement for landing / sales context

---

## Positioning Confirmation

The docs communicate the four prevention categories:

- Runaway token costs
- Silent truncation
- Ambiguous prompts (high RiskScore = inconsistent outputs)
- Unsafe production prompts (score > threshold blocks deployment)

---

## Pricing Rationale

| Tier | Price | Benchmark |
|---|---|---|
| Free | $0 | Standard developer SaaS evaluation tier |
| Pro | $29/dev/mo | Aligns with comparable developer tools (e.g., DataDog, Snyk, Linear) |
| Team | $99/org/mo | Standard small-team org tier; well below per-seat Pro × 5 |

Pro at $29 is below the "impulse buy" threshold for a developer tool.
Team at $99 is a single-click upgrade for any team already on Pro × 2+.

---

## Core Systems — No Modifications Confirmed

| System | Modified |
|---|---|
| Risk engine (`src/lib/risk.ts`) | No |
| CI guardrails (`cli/index.js` ci command) | No |
| Observability schema (`ai_usage_events`) | No |
| Trust layer (`packages/core/src/`) | No |
| Public API (`/api/v1/analyze`) | No |
| Auth / billing flow | No |
| Data models | No |
| Routing | No |

---

## Remaining Risks

1. **Payment infrastructure not wired.** Pricing is documented but Stripe billing
   for Pro/Team is not implemented. This is intentional per task scope — pricing
   docs only.
2. **Analysis limit enforcement.** The 100/month Free tier limit must be enforced
   in the API route. Current implementation may not check against a hard monthly
   cap — confirm before launch.
3. **Team policy config file format.** The JSON policy schema shown in pricing.md
   is illustrative. The actual enforcement logic is a Team-tier feature not yet
   built (deferred to a future sprint).
