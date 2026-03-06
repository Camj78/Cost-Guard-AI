# DEC_COST_IMPACT_REPORT — Deterministic Cost Impact Estimation

**Date:** 2026-03-06
**Phase:** Launch safety — pre-commit verification

---

## Summary

Added a deterministic, static-pricing cost impact estimator. No runtime
pricing fetches. All outputs are computed from the existing `MODEL_CATALOG`
single source of truth.

---

## Pricing Table

Derived from `MODEL_CATALOG` (`inputPricePer1M / 1000`, `outputPricePer1M / 1000`):

| Model                  | Input per 1k tokens | Output per 1k tokens |
|------------------------|--------------------:|---------------------:|
| gpt-4o                 | $0.0025             | $0.0100              |
| gpt-4o-mini            | $0.00015            | $0.0006              |
| claude-sonnet-4-6      | $0.003              | $0.015               |
| claude-haiku-4-5       | $0.0008             | $0.004               |
| gemini-2.5-flash-lite  | $0.000075           | $0.0003              |
| llama-3.3-70b          | $0.00059            | $0.00079             |

---

## Formula

```
cost_per_call = (tokens_in / 1000) × input_per_1k
              + (tokens_out / 1000) × output_per_1k

cost_per_1k_calls = cost_per_call × 1,000

estimated_monthly_cost = cost_per_call × 100,000   (baseline: 100k calls/month)
```

---

## Files Created / Modified

| File | Action |
|------|--------|
| `packages/core/src/model-pricing.ts` | Created — MODEL_PRICING table + estimateModelCost() |
| `packages/core/src/cost-estimator.ts` | Created — estimateCostImpact() + MONTHLY_CALL_BASELINE |
| `packages/core/src/index.ts` | Updated — re-exports new modules |
| `src/lib/cost-estimator.ts` | Created — web app re-export shim |
| `src/app/api/v1/analyze/route.ts` | Updated — added estimated_cost_per_1k_calls, changed default requests_per_month from 1,000 → 100,000 |
| `cli/index.js` | Updated — Cost Impact section in analyze output |
| `src/app/report/[id]/page.tsx` | Updated — Cost Impact card |
| `tests/cost-impact.test.ts` | Created — 12 determinism tests |
| `package.json` | Updated — added test:cost-impact script |

---

## Example Output

**API Response (`/api/v1/analyze`):**
```json
{
  "risk_score": 72,
  "risk": "HIGH",
  "estimated_cost_per_request": 0.003,
  "estimated_cost_per_1k_calls": 3.0,
  "estimated_monthly_cost": 300.0
}
```

**CLI Output (`costguard analyze`):**
```
Risk:                HIGH
Risk Score:          72

Estimated Cost Impact
  Per 1k calls:      $3.00
  Monthly (100k):    $300.00
```

**Report page:** Estimated Cost Impact card added with per-1k and monthly rows.

---

## Determinism Verification

All 12 tests pass (`pnpm test:cost-impact`):

- MODEL_PRICING derived from single source of truth (MODEL_CATALOG)
- MONTHLY_CALL_BASELINE == 100,000
- Same inputs → same outputs (10 identical-call verification)
- Formula integrity verified by spot-check
- All 6 catalog models return finite, non-negative values
- Zero tokens → zero cost
- gemini-2.5-flash-lite is cheapest across catalog

**Typecheck:** clean (`pnpm typecheck`, 0 errors)
