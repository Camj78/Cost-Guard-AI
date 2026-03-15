# CostGuardAI — Data Handling

## What Data Is Stored

### `analysis_history` (per-user, auth-gated)

Stored when a user saves an analysis run via the web dashboard or authenticated API.

| Field              | Type     | Value                                          |
|--------------------|----------|------------------------------------------------|
| `id`               | UUID     | Row identifier                                 |
| `user_id`          | UUID     | FK to `users.id` (RLS enforced)                |
| `prompt_hash`      | text     | SHA-256 of normalized prompt                   |
| `model_id`         | text     | e.g. `gpt-4o`, `claude-3-5-sonnet`             |
| `input_tokens`     | int      | Counted or estimated input tokens              |
| `output_tokens`    | int      | Expected output tokens                         |
| `cost_total`       | numeric  | Estimated cost per request (USD)               |
| `risk_score`       | int      | 0–100 risk score                               |
| `analysis_version` | text     | Engine version (e.g. `1.0.0`)                  |
| `score_version`    | text     | Scoring spec version (e.g. `v1.0`)             |
| `ruleset_hash`     | text     | SHA-256 of risk rule definitions               |
| `input_hash`       | text     | SHA-256 of normalized prompt (same as hash above, from trust layer) |
| `created_at`       | timestamptz | Insert time                                 |

**Prompt text is never stored server-side** in analysis_history. Only the SHA-256 hash.

### `ai_usage_events` (telemetry)

Aggregate telemetry for observability. Controlled by `COSTGUARD_PROMPT_STORAGE`.

| Field           | Value                                                    |
|-----------------|----------------------------------------------------------|
| `endpoint`      | API route path                                           |
| `model`         | Model ID                                                 |
| `tokens_in`     | Input token count                                        |
| `tokens_out`    | Output token count                                       |
| `latency_ms`    | Request latency                                          |
| `prompt_hash`   | SHA-256 of prompt (when `COSTGUARD_PROMPT_STORAGE=hash`) |
| `prompt_preview`| Null by default; truncated text if `full` mode enabled   |

### `github_pr_runs`

Stores one row per PR+commit analysis. Includes `score_version` and `input_hash` for audit.

### Local replay manifests (`~/.costguard/replays/`)

Stored on the developer's local machine. Includes:
- Full prompt text (required for replay)
- All trust fields
- Stored result snapshot

**Never transmitted to the server.** Deleted by removing the directory.

## Hashing Strategy

**Input hash (prompt)**:
```
input → trim() → normalize CRLF → strip trailing spaces → SHA-256(utf-8) → hex
```

Implementation: `packages/core/src/input-hash.ts → hashInput()`

**Ruleset hash**:
```
SCORING_WEIGHTS + sorted(AMBIGUOUS_TERMS) + sorted(VOLATILITY_PHRASES)
→ JSON.stringify() → SHA-256(utf-8) → hex
```

Changes only when risk engine constants change. Implementation: `packages/core/src/ruleset-hash.ts`

**API key hash**:
```
raw_key → SHA-256 → stored in api_keys.key_hash
```

## Retention Policy

| Data                | Retention                              |
|---------------------|----------------------------------------|
| `analysis_history`  | Until user deletes account             |
| `ai_usage_events`   | No automatic purge (aggregated for observability) |
| `github_pr_runs`    | Indefinite (lightweight rows)          |
| Local replay manifests | User-controlled; no automatic expiry |
| `users` table       | Until account deletion requested       |

No automated data deletion is currently implemented. Users may contact support for account deletion.

## Redaction Rules

If `COSTGUARD_PROMPT_STORAGE=redacted`:
- `prompt_hash` field in `ai_usage_events` is set to `null`
- `prompt_preview` field is set to `null`
- No prompt content reaches the database

If `COSTGUARD_PROMPT_STORAGE=hash` (default):
- Only SHA-256 stored; original text is not recoverable from hash

If `COSTGUARD_PROMPT_STORAGE=full` (opt-in):
- Truncated preview stored in `prompt_preview` (for debugging)
- Not recommended for prompts containing PII or secrets

## Privacy Guarantees

1. Prompt text is not stored server-side under default configuration.
2. All database rows are scoped to `user_id` via Supabase RLS — users cannot access other users' data.
3. API key lookup uses SHA-256; raw key is never stored or logged.
4. Local replay manifests are under full user control.
5. No prompt data is shared with third-party analytics providers (PostHog receives only event metadata, not prompt content).

## Data Flow Diagram

```
Developer → POST /api/v1/analyze (prompt text, model)
         ↓
    API route:
    - countTokens(prompt)
    - assessRisk(inputs)         ← no storage
    - hashInput(prompt)          → input_hash (stored in response + DB)
    - createShareReport()        → share_reports table (no prompt text)
    - recordAiUsageEvent()       → ai_usage_events (prompt_hash only)
         ↓
    Response: risk score, explanation, trust fields
         ↓
CLI: saveReplayManifest()        → ~/.costguard/replays/<id>.json (LOCAL ONLY)
```
