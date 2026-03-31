# CostGuardAI — Security Model

## Authentication Model

CostGuardAI uses two authentication paths:

**Session Auth (web dashboard)**
- Supabase JWT sessions via email or OAuth.
- All database writes are scoped to `user_id` via Row-Level Security (RLS).
- Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`.

**API Key Auth (public API + CLI)**
- Keys are generated per user and stored as SHA-256 hashes (`api_keys.key_hash`).
- The raw key is shown once at creation and never stored.
- Key verification: `verifyApiKey()` hashes the incoming key and performs a constant-time lookup against `api_keys.key_hash`.
- Revocation: setting `revoked_at` on the key row immediately blocks access.

## API Key Handling

```
User creates key  →  Raw key shown once (client-side)
                  →  SHA-256 hash stored in api_keys table
                  →  key_hash is indexed, revoked_at is NULL

Incoming request  →  x-api-key header extracted
                  →  SHA-256(key) computed server-side
                  →  Lookup: WHERE key_hash = hash AND revoked_at IS NULL
                  →  Match = authorized; no match = 401
```

API keys never appear in logs. Prompt content is never logged in production (see `COSTGUARD_PROMPT_STORAGE`).

## Prompt Hashing

Prompt text submitted to `/api/v1/analyze` is processed as follows:

1. **Normalization**: trim whitespace, normalize line endings (CRLF → LF), strip trailing spaces per line.
2. **Hashing**: SHA-256 of the normalized UTF-8 text.
3. **Storage**: Only the hash (`input_hash`) is stored in `analysis_history`. Prompt text is never persisted server-side by default.

The `COSTGUARD_PROMPT_STORAGE` environment variable controls telemetry behavior:
- `hash` (default): SHA-256 of prompt stored in `ai_usage_events.prompt_hash`
- `redacted`: prompt field omitted
- `full`: raw prompt stored (opt-in only; not recommended for production)

## Data Storage Boundaries

| Data Type            | Stored Server-Side | Notes                                     |
|----------------------|--------------------|-------------------------------------------|
| Prompt text          | No (default)       | Only hash stored; text in local manifests |
| Safety Score         | Yes                | Stored as internal `risk_score` in `analysis_history` |
| Token counts         | Yes                | In `analysis_history`                     |
| Cost estimate        | Yes                | In `analysis_history`                     |
| Trust fields         | Yes                | `analysis_version`, `score_version`, `ruleset_hash`, `input_hash` |
| API key (raw)        | Never              | Only SHA-256 hash stored                  |
| User email           | Yes                | In `users` table, used for auth only      |

## CI Security Considerations

When using `costguard ci` in GitHub Actions:

- Pass `COSTGUARD_API_KEY` as a repository secret, never hardcoded.
- The CI workflow posts a comment to the PR using `GITHUB_TOKEN` with minimal scope (`pull-requests: write`).
- The webhook receiver (`/api/github/webhook`) validates the `X-Hub-Signature-256` HMAC before processing any payload.
- PR processing uses a distributed lock (`github_pr_processing` table) to prevent duplicate analyses.

## Replay Guarantees

The `costguard replay <analysis_id>` command verifies reproducibility:

- **Local manifest**: Stored in `~/.costguard/replays/<id>.json`. Contains prompt text, trust fields, and stored result. Never transmitted to the server.
- **Version check**: If `analysis_version` or `score_version` changes between runs, replay exits 1 immediately (mismatch, not error).
- **Ruleset check**: If `ruleset_hash` changes, replay exits 1 (rule definitions changed).
- **Output check**: Compares `risk_score`, `risk_level`, and `top_risk_drivers`. Identical → exit 0. Any difference → exit 1.

Replay manifests are owned by the developer's machine. Delete `~/.costguard/replays/` to clear them.

## Transport Security

- All API endpoints require HTTPS in production (Vercel enforces TLS 1.2+).
- `x-api-key` header is only accepted over encrypted connections.
- No sensitive data is embedded in URL parameters or query strings.

## Dependency Security

- `pnpm` lockfile is committed and verified on CI.
- `@fastify/otel>minimatch` is pinned to `^10.2.4` (ReDoS fix, CVE-2022-3517).
- Sentry DSN is public-safe (event-ingest only, no admin access).

## Scope

CostGuardAI does not:
- Store prompt text server-side (default config)
- Provide multi-tenant organization isolation
- Implement SOC 2 controls
- Support enterprise SSO
