# SP-DEC 06 — CI / PR Guardrails: Evidence Report

Date: 2026-03-06
Status: Complete

---

## 1. Files Created / Modified

| File | Action |
|------|--------|
| `cli/index.js` | Modified — added `ci` command, `--fail-on-risk`, `--json`, exit code logic |
| `.github/workflows/costguard.yml` | Created — GitHub Actions workflow |
| `scripts/post-pr-comment.ts` | Created — PR comment generator |
| `DEC_CI_REPORT.md` | Created — this report |

---

## 2. CLI CI Command Usage

### Basic CI run (human-readable output)

```bash
costguard ci prompt.txt --api-key $COSTGUARD_API_KEY
```

Output:
```
CostGuardAI CI Report
─────────────────────────────────────────
RiskScore: 72 (HIGH)

Top Drivers:
  1. Injection Risk
  2. Cost Explosion
  3. Ambiguity

CI status: PASS
─────────────────────────────────────────
```

Exit code: `0`

---

### With threshold — PASS (score 72 < threshold 80)

```bash
costguard ci prompt.txt --api-key $COSTGUARD_API_KEY --fail-on-risk 80
```

Output:
```
CI status: PASS (below threshold 80)
```

Exit code: `0`

---

### With threshold — FAIL (score 72 >= threshold 70)

```bash
costguard ci prompt.txt --api-key $COSTGUARD_API_KEY --fail-on-risk 70
```

Output:
```
CI status: FAIL (threshold 70 exceeded)
```

Exit code: `1`

---

### JSON output mode

```bash
costguard ci prompt.txt --api-key $COSTGUARD_API_KEY --json
```

Output:
```json
{
  "score": 72,
  "risk_band": "HIGH",
  "score_version": "v1.0",
  "top_drivers": [
    "Injection Risk",
    "Cost Explosion",
    "Ambiguity"
  ],
  "share_url": null
}
```

Exit code: `0`

---

### JSON output with threshold exceeded

```bash
costguard ci prompt.txt --api-key $COSTGUARD_API_KEY --json --fail-on-risk 50
```

Outputs JSON to stdout (parseable by CI systems), exits with code `1`.

---

## 3. Exit Code Reference

| Code | Meaning |
|------|---------|
| `0` | Pass — risk below threshold or no threshold set |
| `1` | Risk threshold exceeded |
| `2` | CLI or runtime error (bad args, file not found, API error) |

---

## 4. GitHub Action Workflow

File: `.github/workflows/costguard.yml`

Trigger: `pull_request` on `main` / `master`

### Configuration

| Secret / Var | Description | Default |
|---|---|---|
| `COSTGUARD_API_KEY` (secret) | CostGuard API key | required |
| `COSTGUARD_PROMPT_FILE` (var) | Path to prompt file in repo | `prompt.txt` |
| `COSTGUARD_FAIL_ON_RISK` (var) | Risk threshold (0–100) | `80` |

### Steps

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node.js 20** — `actions/setup-node@v4`
3. **Run CostGuard analysis** — `node cli/index.js ci ... --json > costguard-result.json`
4. **Post PR comment** — `npx tsx scripts/post-pr-comment.ts costguard-result.json`
5. **Enforce threshold** — fails build if exit code was `1`

---

## 5. PR Comment Example

Posted automatically by `scripts/post-pr-comment.ts`.

Comment is **idempotent**: updates in place on subsequent runs via `<!-- costguard-ci -->` marker.

```markdown
## CostGuard Analysis

**RiskScore: 72 (HIGH)**

### Top Drivers
• Injection Risk
• Cost Explosion
• Ambiguity

---
_Analyzed by [CostGuard](https://costguardai.io) · Score Version: v1.0_
```

---

## 6. Verification Evidence

Local verification against mock API server:

```
=== costguard ci (no threshold) ===
CI status: PASS
Exit: 0   ✓

=== costguard ci --fail-on-risk 80 (score 72) ===
CI status: PASS (below threshold 80)
Exit: 0   ✓

=== costguard ci --fail-on-risk 70 (score 72) ===
CI status: FAIL (threshold 70 exceeded)
Exit: 1   ✓

=== costguard ci --json ===
{ "score": 72, "risk_band": "HIGH", ... }
Exit: 0   ✓

=== costguard ci --json --fail-on-risk 50 (score 72) ===
{ "score": 72, "risk_band": "HIGH", ... }
Exit: 1   ✓

=== bad usage ===
Exit: 2   ✓
```

TypeScript typecheck: `pnpm typecheck` — **clean** (0 errors).

---

## 7. Remaining Risks

| Risk | Mitigation |
|------|-----------|
| `COSTGUARD_PROMPT_FILE` may not exist in CI repo | Teams must commit their prompt file or set the var to an existing path |
| `npx tsx` cold-start in CI adds ~5–10s | Acceptable for a pre-merge gate; cached in practice with Node setup action |
| GitHub API rate limit for PR comments | Unlikely — one comment per PR run, idempotent updates |
| `--json` + `--fail-on-risk` both set: stdout is JSON, exit is 1 | Intentional; CI consumers parse JSON from stdout, check exit code separately |
