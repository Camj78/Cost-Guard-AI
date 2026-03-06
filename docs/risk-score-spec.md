# RiskScore Specification — v1.0

**Status:** Canonical
**Version:** `v1.0`
**Owner:** packages/core/src/risk.ts
**Last updated:** 2026-03-06

---

## 1. Overview

The CostGuardAI RiskScore is a deterministic integer in the range **0–100** that
quantifies the probability of LLM prompt failure, cost explosion, or output
degradation before a request is sent. It is computed from five weighted heuristic
components. The score is **not** stochastic — the same inputs always produce the
same score.

---

## 2. score_version Format

```
v<major>.<minor>
```

Examples: `v1.0`, `v1.1`, `v2.0`

### Compatibility Rules

| Change type | Version bump required |
|---|---|
| New heuristic component | **Major** (v1.x → v2.0) |
| Weight adjustment | **Major** (v1.x → v2.0) |
| Bucket boundary change | **Major** (v1.x → v2.0) |
| New term added to AMBIGUOUS_TERMS | **Minor** (v1.0 → v1.1) |
| New phrase added to VOLATILITY_PHRASES | **Minor** (v1.0 → v1.1) |
| Bug fix (wrong regex, off-by-one) | **Minor** |
| Documentation update only | **None** |

The drift harness (`pnpm test:risk-score`) passes if a produced score lands within
**±5 points** of the expected range center. Any refactor that shifts scores beyond
±5 points **must** bump the major version and update all fixture expected ranges.

---

## 3. Inputs

| Field | Type | Description |
|---|---|---|
| `promptText` | `string` | Raw prompt text (used for structural/ambiguity/volatility analysis) |
| `inputTokens` | `number` | Exact or estimated token count of the prompt |
| `contextWindow` | `number` | Model context window in tokens |
| `expectedOutputTokens` | `number` | Expected response length in tokens |
| `maxOutputTokens` | `number` | Model hard cap on output tokens |
| `compressionDelta` | `number` | Token delta from compression (unused in scoring, reserved) |
| `tokenStrategy` | `"exact" \| "estimated"` | Whether tokenization is exact or estimated |
| `inputPricePer1M` | `number` | Input cost per 1M tokens (USD) |
| `outputPricePer1M` | `number` | Output cost per 1M tokens (USD) |

---

## 4. Scoring Components

The final score is the **weighted sum** of five component bucket scores, clamped
to [0, 100] and rounded to the nearest integer.

```
finalScore = round(min(100,
  length    × 0.25 +
  context   × 0.20 +
  ambiguity × 0.20 +
  structural× 0.20 +
  volatility× 0.15
))
```

### 4.1 Weight Table

| Component | Weight | Max contribution |
|---|---|---|
| Length Risk | 0.25 | 22.5 |
| Context Saturation Risk | 0.20 | 19.0 |
| Ambiguity Risk | 0.20 | 18.0 |
| Structural Risk | 0.20 | 20.0 |
| Output Volatility Risk | 0.15 | 15.0 |
| **Total** | **1.00** | **94.5** |

Note: the theoretical maximum before clamping is 94.5 (all buckets at 95–100).
In practice critical prompts reach 85–94 before the min(100) clamp applies.

---

### 4.2 Component: Length Risk (weight 0.25)

Measures how much of the context window the input prompt consumes alone.

```
lengthRatio = inputTokens / contextWindow
```

| lengthRatio | bucket | weighted |
|---|---|---|
| < 0.15 | 5 | 1.25 |
| < 0.30 | 15 | 3.75 |
| < 0.50 | 30 | 7.50 |
| < 0.70 | 60 | 15.00 |
| ≥ 0.70 | 90 | 22.50 |

---

### 4.3 Component: Context Saturation Risk (weight 0.20)

Measures how much of the context window is consumed by input + expected output
combined.

```
saturation = (inputTokens + expectedOutputTokens) / contextWindow
```

| saturation | bucket | weighted |
|---|---|---|
| < 0.50 | 5 | 1.00 |
| < 0.70 | 30 | 6.00 |
| < 0.85 | 65 | 13.00 |
| ≥ 0.85 | 95 | 19.00 |

---

### 4.4 Component: Ambiguity Risk (weight 0.20)

Measures the density of vague or underspecified terms in the prompt.

**Detected terms (AMBIGUOUS_TERMS v1.0):**
```
"improve", "optimize", "better", "good", "high quality",
"fast", "efficient", "robust", "flexible", "clean",
"scalable", "advanced", "modern"
```

Matching is case-insensitive substring (e.g., "improvements" triggers "improve").
Each term occurrence is counted independently.

```
ambiguityDensity = totalMatches / totalWords
```

| condition | bucket | weighted |
|---|---|---|
| 0 matches | 5 | 1.00 |
| density < 0.01 | 20 | 4.00 |
| density < 0.02 | 45 | 9.00 |
| density < 0.04 | 70 | 14.00 |
| density ≥ 0.04 | 90 | 18.00 |

---

### 4.5 Component: Structural Risk (weight 0.20)

Measures absence of prompt engineering best practices. Each missing pattern adds
to the bucket score independently. Bucket is clamped to 100.

| Missing pattern | Points added |
|---|---|
| No line breaks (`\n`) | +20 |
| No bullet/numbered list (`-`, `*`, or leading digit) | +20 |
| No explicit output format instruction (format/return/output + json/xml/markdown/etc.) | +25 |
| No constraint keyword (`max`, `limit`, `exactly`, `at most`, `no more than`) | +20 |
| No section header (`###`, `---`, `**word`) | +15 |

Maximum bucket: **100** (all 5 patterns missing = 20+20+25+20+15 = 100).

---

### 4.6 Component: Output Volatility Risk (weight 0.15)

Measures open-ended output directives that invite unbounded responses.

**Detected phrases (VOLATILITY_PHRASES v1.0):**
```
"write a detailed", "comprehensive", "in depth",
"as much as possible", "thoroughly explain"
```

Each phrase present: **+25 points**
`expectedOutputTokens > 2 × inputTokens`: **+30 points**
Bucket clamped to **100**.

---

## 5. Risk Bands

| Score range | Band | Level key |
|---|---|---|
| 0–24 | **Safe** | `"safe"` |
| 25–49 | **Low** | `"low"` |
| 50–69 | **Warning** | `"warning"` |
| 70–84 | **High** | `"high"` |
| 85–100 | **Critical** | `"critical"` |

---

## 6. Risk Driver Derivation

All five components produce an unweighted `impact` (their bucket score 0–100).
The top 3 components sorted by impact descending are surfaced as `riskDrivers`.
Ties are broken by original component order (Length → Context → Ambiguity →
Structural → Volatility).

Each driver includes:
- `name`: component label
- `impact`: unweighted bucket score
- `fixes`: deterministic remediation strings for each triggered heuristic

---

## 7. Output Fields

```ts
interface RiskAssessment {
  riskScore: number;        // 0–100 integer
  score_version: string;    // e.g. "v1.0"
  riskLevel: RiskLevel;     // "safe"|"low"|"warning"|"high"|"critical"
  riskDrivers: RiskDriver[]; // top 3, sorted by impact desc
  riskFactors: RiskFactor[]; // all 5 components (backward compat)
  riskExplanation: string;  // human-readable summary
  // ... cost and token fields
}
```

---

## 8. Example Scoring Walkthrough

**Prompt:** `"Write a detailed comprehensive summary. Thoroughly explain every aspect."`
**Model:** GPT-4o Mini (contextWindow=128000)
**inputTokens:** 30
**expectedOutputTokens:** 256

| Component | Calculation | Bucket | Weighted |
|---|---|---|---|
| Length | 30/128000 = 0.00023 → < 0.15 | 5 | 1.25 |
| Context Saturation | (30+256)/128000 = 0.0022 → < 0.50 | 5 | 1.00 |
| Ambiguity | 0 terms matched → 0 matches | 5 | 1.00 |
| Structural | No \n, no bullets, no format, no constraint, no headers → 100 | 100 | 20.00 |
| Volatility | "write a detailed"(+25) + "comprehensive"(+25) + "thoroughly explain"(+25) + 256>60(+30) → 105 → capped | 100 | 15.00 |

**Total:** 1.25 + 1.00 + 1.00 + 20.00 + 15.00 = **38.25 → score = 38 → Low**

---

## 9. Determinism Requirements

- No timestamps, random seeds, or external state
- Scoring must be pure function: same inputs → same outputs
- Term matching is case-insensitive, left-to-right substring scan
- All string comparisons use `.toLowerCase()` on the full prompt
- Word count is `prompt.trim().split(/\s+/).length`
- Sort is stable (ECMAScript 2019+)

---

## 10. Adding New Golden Cases

1. Create `fixtures/risk-score/<name>.json`
2. Compute the expected score manually using this spec
3. Set `expected.score_range` to `[computed - 5, computed + 5]`
4. List `expected.top_risk_drivers` in impact-descending order
5. Run `pnpm test:risk-score` to verify PASS
6. If the test fails, recheck your manual calculation against the engine
