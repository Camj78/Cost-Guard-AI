# SP-DEC-07 Trust Layer Report
**Date:** 2026-03-06
**Status:** Complete
**TypeScript typecheck:** Clean (0 errors)

---

## 1. Files Created / Modified

### New Files
| File | Purpose |
|------|---------|
| `packages/core/src/version.ts` | `ANALYSIS_VERSION` constant |
| `packages/core/src/input-hash.ts` | `normalizePrompt()` + `hashInput()` (SHA-256, stable) |
| `packages/core/src/ruleset-hash.ts` | `RULESET_HASH` — SHA-256 of risk rule definitions |
| `src/lib/trust.ts` | Re-export layer for API routes |
| `supabase/migrations/add_trust_fields_to_analysis_history.sql` | DB migration: 4 trust columns |
| `docs/security.md` | Authentication, API key handling, replay guarantees |
| `docs/data-handling.md` | Storage, hashing, retention, redaction, privacy |

### Modified Files
| File | Change |
|------|--------|
| `packages/core/src/index.ts` | Export `version`, `input-hash`, `ruleset-hash` |
| `src/app/api/v1/analyze/route.ts` | Emit `analysis_id`, `analysis_version`, `ruleset_hash`, `input_hash` |
| `src/app/api/analyses/route.ts` | Accept + store trust fields on Pro inserts |
| `cli/index.js` | Trust fields in output, replay manifest save, `costguard replay` command |

---

## 2. Version Field Definitions

| Field | Type | Value | Definition |
|-------|------|-------|------------|
| `analysis_version` | `string` | `"1.0.0"` | Version of the analysis pipeline. Bump when pipeline logic or API contract changes. Defined in `packages/core/src/version.ts`. |
| `score_version` | `string` | `"v1.0"` | Risk scoring specification version. Bump minor for term additions; bump major for weight/bucket changes. Defined in `packages/core/src/risk.ts`. |
| `model_id` | `string` | e.g. `"gpt-4o"` | LLM model used for tokenization and cost calculation. |
| `ruleset_hash` | `string` (SHA-256 hex) | `6d1bb3a8...` | SHA-256 of `SCORING_WEIGHTS` + sorted `AMBIGUOUS_TERMS` + sorted `VOLATILITY_PHRASES`. Stable while risk constants are unchanged. |
| `input_hash` | `string` (SHA-256 hex) | computed | SHA-256 of normalized prompt text. Identical prompts always produce identical hashes. |
| `analysis_id` | `string` (UUID v4) | generated per call | Unique identifier for each analysis run. Returned in API response. Used as replay manifest filename. |

---

## 3. Input Hashing — Example

**Prompt:** `"Write a comprehensive guide to improving API performance."`

**Normalization steps:**
1. `trim()` — remove leading/trailing whitespace
2. `\r\n → \n` — normalize CRLF
3. `\r → \n` — normalize CR
4. `[ \t]+\n → \n` — strip trailing whitespace per line
5. `[ \t]+$ → ""` — strip trailing whitespace at end

**SHA-256 result:** `80c47362fd6491af18badc897da2593f31e0c280ed2e85d1d759e835f051d8b2`

**Implementation:** `packages/core/src/input-hash.ts → hashInput()`

---

## 4. Ruleset Hash — Current Value

Computed from:
```json
{
  "weights": { "length": 0.25, "context": 0.20, "ambiguity": 0.20, "structural": 0.20, "volatility": 0.15 },
  "ambiguous_terms": ["advanced","better","clean","efficient","fast","flexible","good","high quality","improve","modern","optimize","robust","scalable"],
  "volatility_phrases": ["as much as possible","comprehensive","in depth","thoroughly explain","write a detailed"]
}
```

**RULESET_HASH:** `6d1bb3a8c3993cf494f60ea38c80c9286199dc7c75041261c79553e013058a2d`

**Implementation:** `packages/core/src/ruleset-hash.ts → RULESET_HASH`

---

## 5. Replay Command — Usage & Proof

### Save a replay manifest
```bash
# After analyze or ci, a manifest is saved automatically:
costguard ci prompt.txt --api-key $KEY --json
# Output includes:
#   "analysis_id": "a1b2c3d4-...",
#   "replay_manifest": "/Users/dev/.costguard/replays/a1b2c3d4-....json"
```

### Run replay
```bash
costguard replay a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx --api-key $KEY
```

**Expected output (match):**
```
CostGuardAI Replay
─────────────────────────────────────────
Analysis ID:       a1b2c3d4-...
Analysis Version:  1.0.0
Score Version:     v1.0
Model:             gpt-4o-mini
Stored Score:      28 (low)

Re-running analysis...

Result comparison:
  risk_score:   stored=28  current=28  MATCH
  risk_level:   stored=low  current=low  MATCH
  top_drivers:  MATCH

Replay successful — outputs match
─────────────────────────────────────────
```
**Exit code:** `0`

**Expected output (version mismatch):**
```
Replay mismatch detected — version change
  Stored:  analysis_version=1.0.0  score_version=v1.0
  Current: analysis_version=1.1.0  score_version=v1.1
─────────────────────────────────────────
```
**Exit code:** `1`

### Replay manifest schema
```json
{
  "analysis_id": "uuid",
  "created_at": "2026-03-06T...",
  "analysis_version": "1.0.0",
  "score_version": "v1.0",
  "ruleset_hash": "6d1bb3a8...",
  "input_hash": "sha256hex...",
  "model_id": "gpt-4o-mini",
  "prompt_text": "...",
  "stored_result": {
    "risk_score": 28,
    "risk_level": "low",
    "explanation_summary": "RiskScore 28 (safe) ...",
    "top_risk_drivers": ["Structural Risk", "Ambiguity Risk"]
  }
}
```
Stored at: `~/.costguard/replays/<analysis_id>.json`

---

## 6. Trust Fields in API Response

`POST /api/v1/analyze` now returns:

```json
{
  "analysis_id": "uuid",
  "analysis_version": "1.0.0",
  "score_version": "v1.0",
  "ruleset_hash": "6d1bb3a8c3993cf494f60ea38c80c9286199dc7c75041261c79553e013058a2d",
  "input_hash": "sha256hex...",
  "risk": "LOW",
  "risk_score": 28,
  "model": "gpt-4o-mini",
  ...
}
```

CI JSON output (`--json`) includes all trust fields plus `replay_manifest` path.

---

## 7. Security Documentation Summary

**docs/security.md** covers:
- Session auth (Supabase JWT + RLS) vs API key auth (SHA-256 stored, raw never persisted)
- API key verification flow (hash lookup, revocation via `revoked_at`)
- Prompt hashing pipeline (normalize → SHA-256 → hex)
- `COSTGUARD_PROMPT_STORAGE` env var (`hash` | `redacted` | `full`)
- CI security (secrets management, HMAC webhook validation, distributed lock)
- Replay guarantees (version gate, ruleset gate, output comparison)

**docs/data-handling.md** covers:
- Complete `analysis_history` schema with trust fields
- `ai_usage_events` telemetry fields
- Local replay manifest schema and lifecycle
- Hashing strategy with code references
- Retention policy per table
- Redaction rules per `COSTGUARD_PROMPT_STORAGE` value
- Privacy guarantees (no prompt text server-side by default)
- End-to-end data flow diagram

---

## 8. Verification Results

| Gate | Status |
|------|--------|
| A — Version stamps in API response | PASS |
| B — `hashInput()` deterministic | PASS (same prompt → same hash) |
| C — DB migration additive, analyses route updated | PASS |
| D — `costguard replay` command implemented | PASS |
| E — `docs/security.md` + `docs/data-handling.md` created | PASS |
| F — `pnpm typecheck` (tsc --noEmit) | PASS — 0 errors |
| G — This report | PASS |

---

## 9. Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Free-tier RPC (`record_analysis`) does not populate trust fields | Low | Columns default to `'1.0.0'`/`'v1.0'`; replay manifests are locally authoritative |
| Replay requires local manifest (not server-side retrieval) | Low | This is by design (privacy-first); manifests are developer-owned |
| `analysis_id` not persisted in `analysis_history` | Low | The ID is in the local manifest; DB row has `input_hash` for correlation |
| `COSTGUARD_PROMPT_STORAGE=full` exposes prompt text in DB | Medium | Documented as opt-in only; default is `hash` |
