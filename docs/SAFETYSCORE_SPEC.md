# CostGuard Safety Score — Formal Specification

**Version:** 1.2.0
**Status:** Published
**Maintainer:** CostGuardAI

---

## Overview

The **CostGuard Safety Score (CSS)** is a deterministic, heuristic-based measure of how resistant
a prompt is to adversarial exploitation and operational failure. It is produced by the CostGuard
preflight analysis engine and is designed to be stable, auditable, and publishable as a
developer-facing industry reference.

**Range:** 0–100
**Direction:** Higher score = safer, more hardened prompt
**Formula:** `CSS = 100 − weighted_risk_total`

---

## 1. Score Definition

```
CostGuard Safety Score (CSS)
Range:     0–100 (integer)
Direction: Higher = safer
Formula:   CSS = 100 − risk_score
           risk_score = weighted sum of 5 risk components (see Section 3)
```

The internal `risk_score` is computed first; CSS is its complement. The internal field is never
exposed to end users but is retained in audit records for traceability.

---

## 2. The Five Scoring Components

The scoring engine evaluates five structural risk categories. Each maps directly to a class of
real-world exploitation or operational failure.

### 2.1 Prompt Injection

**What it measures:** Structural susceptibility to authority confusion or role override via
untrusted input paths. A prompt with no boundary between system instructions and user-provided
content is exploitable through crafted user inputs.

**Why it matters:** Prompt injection is the leading attack vector in production LLM deployments.
Unmitigated injection allows adversarial content to redirect model behavior, exfiltrate context,
or bypass application-level safeguards.

**Typical structural indicators:**
- No separator between system instructions and user input
- Absence of explicit role or boundary markers
- Open-ended instruction blocks that accept raw user content

**Effect on CSS:** Structural exposure increases the `structural` risk component bucket score.
Each absent safety element adds 15–25 penalty points before weighting.

---

### 2.2 System Override

**What it measures:** Susceptibility to instruction hijacking — the ability of embedded content
to override or supersede system-level directives.

**Why it matters:** Without explicit output constraints and section delimiters, adversarial
content can inject instructions that the model treats as authoritative, overriding intended
behavior.

**Typical structural indicators:**
- No output format instruction
- No explicit output constraints (`max`, `limit`, `exactly`)
- No section headers or delimiters isolating system context

**Effect on CSS:** Absence of these elements contributes directly to the `structural` risk bucket.

---

### 2.3 Jailbreak Behavior

**What it measures:** Open-ended output directives and underspecified constraint language that
enable constraint bypass. Vague qualitative instructions cannot be enforced reliably.

**Why it matters:** Underspecified prompts allow models to interpret instructions permissively.
Jailbreak attempts exploit ambiguity to bypass content policy, format requirements, or scope limits.

**Typical structural indicators:**
- Qualitative terms without concrete definitions (e.g., `improve`, `optimize`, `better`, `high quality`)
- Missing refusal boundaries
- Absence of explicit format requirements

**Effect on CSS:** Ambiguous term density drives the `ambiguity` risk component bucket score.

---

### 2.4 Token Cost Explosion

**What it measures:** Risk that a prompt will trigger unbounded or disproportionate token
generation, causing runaway API cost.

**Why it matters:** Unconstrained output directives and high context saturation create
unpredictable token spend. At scale, a single overlong prompt template can multiply monthly
costs by 2–10x.

**Typical structural indicators:**
- Phrases: `write a detailed`, `comprehensive`, `in depth`, `as much as possible`, `thoroughly explain`
- Expected output tokens more than 2× input tokens
- Prompt length exceeding 50% of the model's context window
- Combined input + output exceeding 70% of context window

**Effect on CSS:** These indicators drive the `length`, `context`, and `volatility` risk component
bucket scores.

---

### 2.5 Tool Abuse

**What it measures:** Structural ambiguity that leads to unpredictable tool invocations in
agentic systems. Vague instructions combined with tool access create hallucinated or
unintended tool calls.

**Why it matters:** In agentic deployments, ambiguous instructions result in incorrect tool
selection, excessive tool calls, or unintended side effects with real operational impact.

**Typical structural indicators:**
- High instruction ambiguity density
- No explicit output format instruction
- Absence of scope constraints on tool use

**Effect on CSS:** Ambiguity and structural components both contribute.

---

## 3. Component Scoring Model

Each component produces a bucket score (0–100) representing raw severity. The weighted sum
of bucket scores forms the internal `risk_score`.

**CostGuard Safety Score weights are versioned and may evolve by `analysis_version`.
Scores are benchmark-calibrated so score bands remain stable across versions.**

| Category | Internal Name | Weight |
|---|---|---|
| Prompt Length Risk | `length` | 25% |
| Context Saturation Risk | `context` | 20% |
| Instruction Ambiguity Risk | `ambiguity` | 20% |
| Structural Failure Risk | `structural` | 20% |
| Token Output Volatility Risk | `volatility` | 15% |

### 3.1 Length Risk (weight: 0.25)

Measures prompt token count as a fraction of the model's context window.

| Token / Context Ratio | Bucket Score |
|---|---|
| < 15% | 5 |
| 15–30% | 15 |
| 30–50% | 30 |
| 50–70% | 60 |
| ≥ 70% | 90 |

### 3.2 Context Saturation Risk (weight: 0.20)

Measures combined input + expected output tokens against the context window.

| (Input + Output) / Context | Bucket Score |
|---|---|
| < 50% | 5 |
| 50–70% | 30 |
| 70–85% | 65 |
| ≥ 85% | 95 |

### 3.3 Instruction Ambiguity Risk (weight: 0.20)

Counts occurrences of vague qualitative terms. Density = matches / total words.

**Ambiguous term catalog (v1.0):**
`improve`, `optimize`, `better`, `good`, `high quality`, `fast`, `efficient`,
`robust`, `flexible`, `clean`, `scalable`, `advanced`, `modern`

| Ambiguity Density | Bucket Score |
|---|---|
| 0 matches | 5 |
| < 1% | 20 |
| 1–2% | 45 |
| 2–4% | 70 |
| ≥ 4% | 90 |

### 3.4 Structural Failure Risk (weight: 0.20)

Penalizes absence of structural elements that define safe, predictable prompts.

| Missing Element | Points |
|---|---|
| No line breaks | +20 |
| No bullet or numbered list | +20 |
| No explicit output format instruction | +25 |
| No output constraints (`max`, `limit`, `exactly`) | +20 |
| No section headers or delimiters | +15 |

Bucket score = `min(100, sum of triggered penalties)`

### 3.5 Output Volatility Risk (weight: 0.15)

Penalizes directives that produce unbounded or unscoped output.

**Volatility phrase catalog (v1.0):**
`write a detailed`, `comprehensive`, `in depth`, `as much as possible`, `thoroughly explain`

Each phrase match: +25 points.
If `expected_output_tokens > 2 × input_tokens`: +30 points.

Bucket score = `min(100, sum of triggered penalties)`

### 3.6 Final Score Formula

```
risk_score = round(
  length_bucket × 0.25
  + context_bucket × 0.20
  + ambiguity_bucket × 0.20
  + structural_bucket × 0.20
  + volatility_bucket × 0.15
)

CSS = 100 − min(100, risk_score)
```

### 3.7 Scoring Architecture — Base Score and Threat Intelligence Adjustment

The CostGuard scoring model separates two distinct risk signals. This separation
improves auditability and is consistent with how security-oriented scoring systems
(e.g., CVSS) distinguish base severity from environmental adjustments.

**Component → Attack Category Mapping**

| Engine Component | Weight | Attack Category |
|---|---|---|
| Structural Failure Risk | 20% | Prompt Injection + System Override |
| Instruction Ambiguity Risk | 20% | Jailbreak Behavior + Tool Abuse |
| Output Volatility Risk | 15% | Token Cost Explosion (unbounded output) |
| Prompt Length Risk | 25% | Token Cost Explosion (input size) |
| Context Saturation Risk | 20% | Token Cost Explosion (combined saturation) |

**Score layering**

```
weighted_risk_total  = Σ (component_bucket × component_weight)
base_risk_score      = clamp(round(weighted_risk_total), 0, 100)
threat_intel_adj     = CVE severity adjustment if pattern match found (Section 6.4)
risk_score           = clamp(base_risk_score + threat_intel_adj, 0, 100)
safety_score (CSS)   = 100 − risk_score
```

`base_risk_score` reflects only structural analysis — what can be determined from the
prompt's text and token properties alone. `threat_intel_adj` reflects empirical incident
data from the Prompt CVE registry. The final `risk_score` is always clamped to [0, 100].

`assessRisk()` computes and returns `base_risk_score`. Threat intelligence adjustments
are applied externally by API routes and stored separately in analysis records, making
each layer independently auditable.

---

## 4. Score Interpretation Bands

| CSS Range | Band | Meaning |
|---|---|---|
| 91–100 | **Hardened** | Prompt is structurally isolated, explicit, and resistant to exploitation |
| 71–90 | **Safe** | Prompt meets baseline safety requirements for production deployment |
| 41–70 | **Needs Hardening** | Prompt has structural weaknesses that should be addressed before deployment |
| 0–40 | **Unsafe** | Prompt exhibits high exploitation risk; do not deploy without remediation |

Score bands are defined by benchmark-calibrated thresholds and are preserved across
`analysis_version` updates. A weight or threshold change that would shift more than 5% of
historical benchmark fixtures across a band boundary requires a `major` version increment and
a full benchmark suite review before release.

---

## 5. Score Interpretation — Why One Score Differs From Another

**Example: Why did this prompt score 62 instead of 71?**

A CSS of 62 versus 71 represents a difference of 9 points on the internal `risk_score`. This
difference originates from one or more of the following sources:

### 5.1 Component Risk Weights

Each risk component contributes differently to the final score. A prompt with high structural
deficiency (weight 0.20) and high volatility (weight 0.15) can accumulate more points than a
prompt with moderate length risk alone (weight 0.25).

Example: A prompt with no output format instruction (+25 structural), two volatility phrases
(+50 before cap), and a comprehensive context saturation achieves a higher `risk_score` than
a long-but-well-structured prompt.

### 5.2 Threat Intelligence Adjustments

When a prompt's structural signature matches a known Prompt CVE, a bounded additive adjustment
is applied to the `risk_score`. This adjustment can shift the CSS up or down within defined
limits (see Section 6.4).

### 5.3 Structural Patterns

Specific structural configurations interact non-linearly. For example, a prompt that is both
long (length bucket: 60) and missing output format instructions (structural bucket: +25) will
score higher than the same prompt with either deficiency alone.

### 5.4 Benchmark-Calibrated Scoring Bands

The five bucket thresholds (Section 3.1–3.5) were calibrated against the canonical benchmark
suite so that a structurally safe prompt reliably scores in the "Safe" or "Hardened" band. The
calibration ensures band semantics remain stable across versions.

### 5.5 Analysis Version

Scores computed under different `analysis_version` values may differ if weights, bucket
thresholds, or term catalogs changed between versions. Each score is traceable to its specific
`analysis_version` and `ruleset_hash` for independent verification.

---

## 6. Threat Intelligence Integration

CostGuardAI maintains a global Prompt CVE registry (`prompt_cve_registry`) that augments
CSS with empirical incident data.

### 6.1 Pattern Hashing

No raw prompt text is ever stored. All incident records use a structural hash:

```
structure_signature = "band:{token_band}|{sorted risk factor name:points}"
pattern_hash = SHA-256(structure_signature)
```

Token bands (`xs`, `sm`, `md`, `lg`, `xl`, `xxl`) group prompts by size class without
revealing exact token counts.

### 6.2 CVE Generation

When a structural pattern accumulates 25 or more incidents, a Prompt CVE is automatically
generated:

- **CVE ID format:** `PCVE-YYYY-XXXX` (sequential per year)
- **Severity mapping:**
  - `avg_risk ≥ 80` → `critical`
  - `avg_risk ≥ 65` → `high`
  - `avg_risk ≥ 50` → `medium`

CVEs are publicly readable and appear on safety reports when a pattern hash matches a
known vulnerability.

### 6.3 Threat Intelligence Influence Model

Threat intelligence may adjust the score when a prompt structure matches known incident
patterns or Prompt CVEs. This influence is **additive but band-limited**.

> A matching Prompt CVE may increase weighted risk contribution through a bounded
> adjustment. Threat intelligence adjustments are capped to prevent disproportionate
> score swings from any single signal.

Influence is additive: the adjustment is added to the base `risk_score` before computing CSS.
Influence is band-limited: the total threat intelligence adjustment from a single CVE match is
bounded by severity tier (see Section 6.4).

### 6.4 CVE Influence Model

When a CVE match is found, the base `risk_score` receives a bounded additive adjustment before
CSS is computed:

| CVE Severity | Risk Score Adjustment | CSS Impact |
|---|---|---|
| Critical | +10 points (max) | CSS decreases by up to 10 |
| High | +7 points (max) | CSS decreases by up to 7 |
| Medium | +3 points (max) | CSS decreases by up to 3 |

The final adjusted `risk_score` is capped at 100 before computing `CSS = 100 − risk_score`.
No single CVE match can push a prompt's score below the Unsafe band boundary on its own.

### 6.5 CVE Adjustment Stability

The CVE adjustment values defined above are **versioned by `analysis_version`**. The current
adjustments apply to all scores computed under `analysis_version` 1.x:

| Severity | Adjustment | Versioned Since |
|---|---|---|
| Critical | +10 risk_score | 1.0.0 |
| High | +7 risk_score | 1.0.0 |
| Medium | +3 risk_score | 1.0.0 |

These values were calibrated against the canonical benchmark suite to ensure that the worst-case
CVE adjustment does not alter a prompt's score band on its own. Future versions may modify
these values, but benchmark calibration ensures score bands remain stable across versions.

**Comparison rule:** All score comparisons across versions must reference the `analysis_version`
used to compute each score. A Critical CVE adjustment of +10 under v1.x is not directly
comparable to a hypothetical future adjustment under v2.x unless the scores share the same
`analysis_version`.

### 6.5 Privacy Guarantees

Threat intelligence is derived from structural pattern hashes. No raw prompt text, project
identifiers, or user-identifying data is used in pattern matching or CVE generation.

---

## 7. Versioning Model

Every change to scoring weights, bucket thresholds, or term catalogs must increment
`analysis_version` (format: `major.minor.patch`) to maintain scoring traceability.

| Version Field | Purpose |
|---|---|
| `analysis_version` | Identifies the analysis engine release (e.g., `1.0.0`) |
| `score_version` | Identifies the scoring specification version (e.g., `v1.0`) |
| `ruleset_hash` | SHA-256 of all scoring constants — detects silent drift |
| `input_hash` | SHA-256 of normalized prompt text — enables replay |

**Versioning rules:**

- `patch` bump: bug fix with no scoring behavior change
- `minor` bump: new ambiguity term or volatility phrase added to catalogs
- `major` bump: weight or bucket threshold change (scoring behavior change)

Every report and API response includes `analysis_version`, `score_version`, and
`ruleset_hash` so any score can be independently verified against the published spec.

---

## 8. Benchmark Validation Process

To ensure scoring stability across algorithm updates, CostGuardAI maintains a canonical
benchmark suite at `fixtures/benchmarks/`.

### Fixture Format

```json
{
  "id": "fixture-id",
  "description": "...",
  "risk_type": "prompt_injection | token_explosion | instruction_ambiguity | ...",
  "prompt": "...",
  "model": "gpt-4o",
  "expected_output_tokens": 500,
  "expected_risk_score_range": [30, 65],
  "expected_safety_score_range": [35, 70]
}
```

### Benchmark Categories

| Fixture | Risk Type | Expected CSS Range |
|---|---|---|
| `safe-structured` | structural_failure | 65–95 |
| `injection-basic` | prompt_injection | 35–70 |
| `jailbreak-attempt` | prompt_injection | 15–50 |
| `token-explosion` | token_explosion | 20–55 |
| `tool-abuse` | instruction_ambiguity | 40–75 |

### Running Benchmarks

```bash
pnpm benchmark
```

The runner:
1. Loads all fixtures from `fixtures/benchmarks/`
2. Runs `assessRisk()` against each prompt with specified model parameters
3. Validates that `risk_score` falls within `expected_risk_score_range`
4. Persists a versioned summary to `artifacts/benchmarks/{analysis_version}-summary.json`
5. Exits `0` if all pass, `1` if any drift outside range, `2` on runtime error

A benchmark failure signals unintended scoring regression. If a scoring change is intentional,
update the fixture ranges and increment `analysis_version`.

### Benchmark Summary Artifacts

Each benchmark run persists a summary JSON to `artifacts/benchmarks/`:

```json
{
  "analysis_version": "1.0.0",
  "timestamp": "2026-03-09T00:00:00.000Z",
  "pass_rate": 1.0,
  "fixture_count": 5,
  "fixture_results": [...],
  "score_band_distribution": {
    "Hardened": 1,
    "Safe": 1,
    "Needs Hardening": 2,
    "Unsafe": 1
  }
}
```

These artifacts form the longitudinal calibration record used to verify that score bands
remain stable across `analysis_version` updates.

---

## 9. Score Governance

### 9.1 Change Protocol

Score changes follow a formal versioning and governance protocol:

1. **Scoring changes are versioned.** Every change to weights, thresholds, or term catalogs
   must increment `analysis_version` using the semantic versioning rules in Section 7.

2. **Benchmark suite must pass before release.** No version with a failing benchmark fixture
   may be released as a stable version.

3. **Band semantics must remain stable.** The four score bands (Hardened / Safe / Needs
   Hardening / Unsafe) and their range boundaries (91–100 / 71–90 / 41–70 / 0–40) are fixed
   until a `major` version increment. A band boundary change requires documented rationale and
   a full benchmark review.

4. **Methodology changes require spec updates.** Any change to scoring logic must be reflected
   in a corresponding update to this specification before or concurrent with release.

5. **CVE influence must remain bounded.** Threat intelligence adjustments are capped per
   Section 6.4. No change may remove or increase these bounds without a `major` version increment.

6. **Historical scores remain traceable.** Every score is keyed by `analysis_version` and
   `ruleset_hash`. Historical scores computed under previous versions must remain verifiable
   against the corresponding archived spec version.

### 9.2 Authority

The CostGuardAI scoring methodology is maintained by CostGuardAI. External contributors may
propose changes to the ambiguous term catalog or volatility phrase catalog via the public
issue tracker. Weight and threshold changes require internal benchmark review.

### 9.3 Audit Trail

Every API response and shareable report includes:
- `analysis_version` — identifies the engine version
- `score_version` — identifies the specification version
- `ruleset_hash` — a SHA-256 fingerprint of all scoring constants
- `input_hash` — a SHA-256 of the normalized prompt (enables replay without storing the prompt)

These four fields together constitute a complete audit record for any score.

---

## 10. Citation and Adoption

The CostGuard Safety Score specification is designed to be publicly cited, audited, and
adopted as a standard preflight check for LLM prompt security.

Recommended citation format:

```
CostGuard Safety Score (CSS) v1.1 — CostGuardAI
https://costguardai.io/methodology
```

Teams integrating CSS into their CI pipelines or tooling may use:

```bash
# Install CostGuard CLI
npm install -g @costguardai/cli

# Analyze a prompt file
costguard analyze prompt.txt --model gpt-4o

# Fail CI if safety score below threshold
costguard ci --fail-on-risk 60
```

---

## Changelog

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-03-09 | Initial published specification |
| 1.1.0 | 2026-03-09 | Added five component definitions; versioned weight declaration; threat intelligence influence model; CVE bounded adjustment values; score interpretation section; score governance section |
| 1.2.0 | 2026-03-09 | Added Section 3.7: scoring architecture separating base_risk_score from threat_intel_adjustment; CVSS-style component-to-attack-category mapping; explicit clamp formula; example verification_prompt documentation |
