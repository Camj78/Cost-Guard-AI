# SP-DEC 05 — Explainability Engine Report

**Date:** 2026-03-06
**Score Version:** v1.0
**Status:** COMPLETE

---

## 1. Files Created / Modified

| File | Action |
|------|--------|
| `packages/core/src/explanations.ts` | Created — `Explanation` interface + `DRIVER_EXPLANATIONS` static catalog |
| `packages/core/src/explanation-builder.ts` | Created — `buildExplanation()` pure function |
| `packages/core/src/risk.ts` | Modified — added `explanation: Explanation` to `RiskAssessment`, calls `buildExplanation` |
| `packages/core/src/index.ts` | Modified — re-exports `explanations` and `explanation-builder` |
| `src/lib/risk.ts` | Modified — re-exports `Explanation`, `DriverExplanationMeta`, `DRIVER_EXPLANATIONS`, `buildExplanation` |
| `src/lib/share-schema.ts` | Modified — rebuilds `explanation` server-side in `validateClientSnapshot` |
| `src/app/api/v1/analyze/route.ts` | Modified — `explanation` field added to JSON response |
| `cli/index.js` | Modified — explanation section printed in CLI output |
| `tests/explainability-test.ts` | Created — 59 determinism tests |
| `package.json` | Modified — added `test:explainability` script |

---

## 2. Explanation Schema

```typescript
interface Explanation {
  /** One-line summary: score, band, and top driver names. */
  summary: string;

  /** Names of risk drivers with non-trivial impact (impact > 5), sorted by impact desc. */
  top_risk_drivers: string[];

  /** Static contributing factors for each active driver, in driver priority order. */
  contributing_factors: string[];

  /**
   * Mitigation suggestions — dynamic (contextual) fixes from the engine first,
   * then static base mitigations as fallback when no dynamic fixes triggered.
   */
  mitigation_suggestions: string[];
}
```

`explanation` is a required field on `RiskAssessment`.
`assessRisk()` always populates it.
`validateClientSnapshot()` always rebuilds it server-side (client-provided values are ignored).

---

## 3. Driver Mapping Table

| Driver Name | Description | Contributing Factors | Base Mitigations |
|---|---|---|---|
| **Length Risk** | Prompt length consumes a high proportion of the available context window. | Input token count elevated relative to context window; insufficient remaining context for output | Shorten prompt; break into smaller requests; summarize background |
| **Context Saturation Risk** | Combined input and expected output tokens approach the model's context limit. | Input + output exceeds safe context threshold; truncation risk at boundary | Reduce expected output; shorten input; use larger-context model |
| **Ambiguity Risk** | Vague or subjective language produces unpredictable model outputs. | Subjective qualifiers detected ('better', 'optimize', 'high quality'); high density of unmeasurable terms | Replace vague terms with measurable requirements; add explicit success criteria; use examples |
| **Structural Risk** | Prompt lacks structural cues that guide model behavior and output format. | Missing output format spec; no section headers; no explicit output constraints | Add format instructions; add headers/delimiters; add 'max'/'limit'/'exactly' constraints |
| **Output Volatility Risk** | Open-ended output directives cause unpredictable token use and cost spikes. | Expansive directives ('comprehensive', 'in depth', 'as much as possible'); expected output >> input | Scope requests explicitly; set max_output_tokens cap; define exact item/step/word counts |

---

## 4. Sample Explanation Outputs

### Safe Prompt (score 3 — Safe)

Input: `"### Instructions\nList 3 items.\n- item one\n- item two\n- item three\nFormat: JSON. Max 50 words."`

```json
{
  "summary": "RiskScore 3 (Safe). No significant risk drivers detected.",
  "top_risk_drivers": [],
  "contributing_factors": [],
  "mitigation_suggestions": [
    "Shorten the prompt by removing redundant background context",
    "Break large prompts into smaller, focused requests"
  ]
}
```

### High Ambiguity Prompt (score 52 — Warning)

Input: `"Write a comprehensive, in depth analysis. Make it better, more efficient, and high quality. Optimize everything..."`

```json
{
  "summary": "RiskScore 52 (Warning) driven primarily by Ambiguity Risk and Context Saturation Risk.",
  "top_risk_drivers": ["Ambiguity Risk", "Context Saturation Risk"],
  "contributing_factors": [
    "Presence of subjective qualifiers such as 'better', 'optimize', or 'high quality'",
    "High density of terms without measurable success criteria",
    "Input tokens plus expected output tokens exceed a safe context threshold",
    "Risk of response truncation at the context window boundary"
  ],
  "mitigation_suggestions": [
    "High ambiguity density (2–4%). Rewrite requirements — remove: 'improve', 'optimize', 'better', 'high quality'.",
    "Combined token usage at 70–85% of context limit. Reduce prompt length or expected output tokens."
  ]
}
```

### Context Saturation (score 63 — Warning)

```json
{
  "summary": "RiskScore 63 (Warning) driven primarily by Context Saturation Risk and Length Risk.",
  "top_risk_drivers": ["Context Saturation Risk", "Length Risk"],
  "contributing_factors": [
    "Input tokens plus expected output tokens exceed a safe context threshold",
    "Risk of response truncation at the context window boundary",
    "Input token count is elevated relative to context window size",
    "Insufficient remaining context for the expected model output"
  ],
  "mitigation_suggestions": [
    "Combined token usage exceeds 85% of context limit. High truncation risk — reduce input or expected output.",
    "Prompt exceeds 70% of context window. Shorten significantly to reduce truncation risk."
  ]
}
```

---

## 5. Test Command and Results

```
pnpm test:explainability
```

```
CostGuardAI — Explainability Determinism Test
────────────────────────────────────────────────────────────

Tests: 59  Pass: 59  Fail: 0

PASS: All explainability determinism tests passed.
```

### Test Coverage

| Test Group | Count | Result |
|---|---|---|
| Schema completeness (all 4 fields present per fixture) | 25 | PASS |
| assessRisk() determinism (same inputs → identical explanation) | 5 | PASS |
| buildExplanation() determinism (same args → identical output) | 5 | PASS |
| Driver ordering stability | 5 | PASS |
| top_risk_drivers matches active riskDrivers | 5 | PASS |
| Summary encodes correct score + band | 5 | PASS |
| Mitigation suggestions non-empty when score > 10 | 4 | PASS |
| Explanation varies across risk profiles | 1 | PASS |
| Safe prompt summary appropriate | 1 | PASS |
| buildExplanation with explicit driver list | 3 | PASS |
| **Total** | **59** | **PASS** |

### Risk-Score Drift Harness (regression check)

```
pnpm test:risk-score
Fixtures: 12  Pass: 12  Fail: 0  Driver mismatches: 0
PASS: All 12 fixtures within tolerance.
```

**No scoring regression introduced.**

### TypeScript Typecheck

```
pnpm tsc --noEmit
(no errors)
```

---

## 6. Architecture Notes

### Circular Dependency Prevention

`explanation-builder.ts` does **not** import from `risk.ts`. It accepts `riskScore` (number), `riskLevel` (string), and `riskDrivers` (inline interface) as primitive parameters. This eliminates the `risk.ts → explanation-builder.ts → risk.ts` circular dependency.

```
explanations.ts          (no deps)
    ↑
explanation-builder.ts   (imports explanations.ts)
    ↑
risk.ts                  (imports explanations.ts + explanation-builder.ts)
```

### Security: Share Snapshot Validation

Client-provided `explanation` values are **never accepted**. `validateClientSnapshot()` always reconstructs `explanation` server-side from the validated `riskScore`, `riskLevel`, and `riskDrivers` fields. This prevents clients from submitting arbitrary explanation text into share links.

### Mitigation Priority

Dynamic engine fixes (contextual, prompt-specific) are always surfaced first in `mitigation_suggestions`. Static base mitigations from `DRIVER_EXPLANATIONS` are used only as fallback when no dynamic fixes were triggered (i.e., all driver buckets are at their minimum values).

---

## 7. Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| New driver names in future scoring updates will produce empty static metadata | Low | `DRIVER_EXPLANATIONS` must be updated when new driver names are introduced in `risk.ts` |
| Very long dynamic fix strings could inflate share snapshot size | Negligible | Each fix is bounded to 200 chars by share-schema validator; 16KB limit is not approached |
| Web UI does not yet render `explanation` block | Informational | Data is present in `RiskAssessment`; rendering is a future UI task within D6 scope |
