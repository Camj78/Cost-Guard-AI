# CostGuardAI — Security Review Process

**Version:** 1.0
**Status:** Published
**Maintainer:** CostGuardAI

---

## 1. Methodology Transparency

The CostGuard Safety Score methodology is publicly documented at `/methodology` and in the
formal specification at `docs/SAFETYSCORE_SPEC.md`. The specification includes:

- Exact scoring formula (`CSS = 100 − risk_score`)
- Component weights and bucket thresholds (Section 3)
- Score band definitions and band stability rules (Section 4)
- Threat intelligence influence model and CVE adjustment bounds (Section 6)
- Versioning rules and change governance (Section 7)
- Benchmark calibration process and fixture format (Section 8)

All scoring constants are fingerprinted by `ruleset_hash` (SHA-256 of scoring constants).
The `ruleset_hash` is included in every API response and shareable report.

---

## 2. Benchmark Validation

CostGuard Safety Score is validated against a canonical benchmark suite before every release.

**Benchmark suite location:** `fixtures/benchmarks/`

**Benchmark categories:**

| Fixture | Risk Type | Expected CSS Range |
|---|---|---|
| safe-structured | structural_failure | 65–95 |
| injection-basic | prompt_injection | 35–70 |
| jailbreak-attempt | prompt_injection | 15–50 |
| token-explosion | token_explosion | 20–55 |
| tool-abuse | instruction_ambiguity | 40–75 |

**Benchmark pass requirements:**

- Every fixture's `risk_score` must fall within its `expected_risk_score_range`
- No fixture may cross a score band boundary unintentionally
- Overall pass rate must be 100% before release

Benchmark artifacts are persisted to `artifacts/benchmarks/` as versioned JSON summaries.
Historical artifacts provide a longitudinal calibration record.

---

## 3. Responsible Disclosure

CostGuardAI is committed to responsible disclosure for security issues affecting the
scoring engine, threat intelligence pipeline, or public API.

**Scope of responsible disclosure:**

- Scoring engine bugs that cause systematic bias or non-deterministic results
- Vulnerabilities in the public API (`/api/v1/analyze`)
- Privacy violations involving prompt data storage or exposure
- Authentication or authorization bypasses in the web application

**Out of scope:**

- Findings related to scoring methodology disagreements (use the public issue tracker)
- Theoretical attacks with no practical exploitability
- Issues in third-party infrastructure not controlled by CostGuardAI

---

## 4. Vulnerability Reporting Process

To report a security issue:

1. **Do not open a public GitHub issue** for sensitive security findings
2. Prepare a written description including:
   - The affected component (scoring engine, API, application)
   - Steps to reproduce or demonstrate the issue
   - Potential impact assessment
   - Any suggested mitigations
3. Allow reasonable time for acknowledgment and remediation before public disclosure
4. CostGuardAI commits to:
   - Acknowledging receipt within 5 business days
   - Providing a remediation timeline for confirmed issues
   - Crediting reporters in the public changelog (unless anonymity is requested)

**Prompt CVE reports:**

Structural prompt vulnerability patterns observed in the wild may be submitted for
consideration as new Prompt CVE entries. Include:

- Structural pattern description (no raw prompt content)
- Risk category (prompt_injection, token_explosion, instruction_ambiguity, etc.)
- Observed severity and estimated incident prevalence
- Mitigation guidance

---

## 5. Data Privacy Guarantees

CostGuard never stores raw prompts. Only anonymized structural fingerprints are retained.

**What is stored:**

| Field | Description |
|---|---|
| `pattern_hash` | SHA-256 of structural features — not reversible to prompt text |
| `structure_signature` | Token band + sorted risk factor names |
| `risk metadata` | Score, risk level, risk drivers (no text) |
| `incident metadata` | Count, timestamps, severity (no user identifiers) |

**What is never stored:**

- Raw prompt text
- Prompt token sequences
- User-reconstructable prompt structures
- User identifiers linked to prompt content
- Project or application names linked to prompt content

**Enforcement mechanism:**

The ingest pipeline (`src/lib/threat-intel/ingest-incident.ts`) accepts only
structural fields. The `pattern_hash` is computed from `token_band` and sorted
risk factor names — no raw text participates in the hash.

The `pattern_hash` is an internal opaque identifier. It is never exposed in any
public-facing UI or API response.

**Static audit scope:**

The following database tables have been reviewed to confirm no prompt text
storage path exists:

- `prompt_incidents` — stores `pattern_hash`, `risk_score`, `token_band`, timestamps only
- `incident_patterns` — stores aggregated structural stats only
- `prompt_pattern_examples` — stores structural descriptions, not raw prompts
- `prompt_cve_registry` — stores `cve_id`, severity, description, mitigation, counts

---

## 6. Academic Collaboration

CostGuardAI welcomes academic collaboration on prompt security research.

**Areas of interest:**

- Empirical validation of heuristic scoring against adversarial benchmarks
- Development of new structural vulnerability classes for the CVE registry
- Analysis of score band calibration across diverse prompt corpora
- Formal verification of scoring determinism

**Privacy constraints for research use:**

- No raw prompt data is available for research — only structural pattern statistics
- CVE registry data (incident counts, severity, first/last seen) is publicly accessible
- Benchmark fixtures are included in the open-source repository

Academic citations should reference the formal specification:

```
CostGuard Safety Score (CSS) v1.1 — CostGuardAI
https://costguardai.io/methodology
```
