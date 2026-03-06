# SP-DEC COST-PR — Cost Impact in PR Comments
**Date:** 2026-03-06
**Status:** Complete

---

## Modified Files

| File | Change |
|---|---|
| `scripts/post-pr-comment.ts` | Added `fmtCost` helper; extended `CiJson` interface; extended `buildComment` with Cost Impact section |
| `cli/index.js` | Added `estimated_cost_per_1k_calls` and `estimated_monthly_cost` to `--json` CI output object |

---

## Changes Summary

### `scripts/post-pr-comment.ts`
- `CiJson` interface: added `estimated_cost_per_1k_calls?: number | null` and `estimated_monthly_cost?: number | null`
- Added `fmtCost(n)` helper (mirrors CLI logic: 2 decimals ≥ $0.01, 4 decimals below)
- `buildComment`: renders **Estimated Cost Impact** block when cost fields are present; omits block gracefully when fields are absent

### `cli/index.js`
- `--json` output object now includes:
  - `estimated_cost_per_1k_calls` (number | null) — sourced from API response
  - `estimated_monthly_cost` (number | null) — sourced from API response

No scoring logic, risk logic, cost calculation logic, or CI threshold logic was modified.

---

## Final Comment Template

```markdown
<!-- costguard-ci -->
## CostGuard Analysis

**RiskScore: {{score}} ({{risk_band}})**

**Estimated Cost Impact**
{{estimated_cost_per_1k_calls}} per 1k calls
{{estimated_monthly_cost}} / month at 100k calls

### Top Drivers
• {{driver_1}}
• {{driver_2}}
• {{driver_3}}

---
_Analyzed by [CostGuard](https://costguardai.io)_
_Score Version: {{score_version}}_

[View full report ↗]({{share_url}})
```

**Notes:**
- Cost Impact section is omitted entirely if both fields are `null`/absent
- Top Drivers capped at 3, deterministic ordering from `RiskAssessment`
- Idempotency marker `<!-- costguard-ci -->` preserved
- Share URL block is optional (omitted when `share_url` is null)

---

## Example Rendered Comment

```
<!-- costguard-ci -->
## CostGuard Analysis

**RiskScore: 72 (HIGH)**

**Estimated Cost Impact**
$0.0048 per 1k calls
$0.48 / month at 100k calls

### Top Drivers
• Prompt exceeds 3000 tokens
• Ambiguous instruction structure
• Missing output format specification

---
_Analyzed by [CostGuard](https://costguardai.io)_
_Score Version: v1.0_

[View full report ↗](https://costguardai.io/s/abc123)
```

---

## Fallback (No Cost Fields)

```
<!-- costguard-ci -->
## CostGuard Analysis

**RiskScore: 35 (MEDIUM)**

### Top Drivers
• Long prompt

---
_Analyzed by [CostGuard](https://costguardai.io)_
_Score Version: v1.0_
```

---

## Error Case

```
<!-- costguard-ci -->
## CostGuard Analysis

> **Error:** CostGuard could not complete analysis.
> Check the CI run log for details.

---
_Analyzed by [CostGuard](https://costguardai.io)_
_Score Version: v1.0_
```

---

## Verification Result

| Check | Result |
|---|---|
| TypeScript typecheck (`pnpm typecheck`) | PASS — no errors |
| RiskScore in output | PASS |
| Cost Impact section in output | PASS |
| Top Drivers (max 3) in output | PASS |
| CostGuard attribution footer | PASS |
| Idempotency marker preserved | PASS |
| Fallback when cost fields absent | PASS — section omitted, no crash |
| Error case (null analysis) | PASS — error block, no cost section |
| GitHub markdown renders correctly | PASS — bold, bullet, link syntax valid |

---

## Gates

| Gate | Status |
|---|---|
| A — Locate PR comment generator | PASS — `scripts/post-pr-comment.ts` |
| B — Add Cost Impact fields | PASS — extended CLI JSON output + `CiJson` interface |
| C — Comment format | PASS — matches specified structure |
| D — Driver limit (top 3) | PASS — `.slice(0, 3)` preserved |
| E — Error case | PASS — graceful omission |
| F — Verification | PASS — simulated output verified |
| G — Evidence artifact | PASS — this document |
