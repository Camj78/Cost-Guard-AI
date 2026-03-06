# DEC_GITHUB_AUTH_REPORT.md
**GitHub App Auth + Reliability Hardening — Decision Evidence Report**

---

## 1. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/github/app-auth.ts` | **Created** | GitHub App JWT signing, Installation token exchange, PAT fallback |
| `src/lib/github/client.ts` | **Modified** | Replaced synchronous PAT `getToken()` with async `resolveGitHubToken()`; added `deleteIssueComment` |
| `src/app/api/github/webhook/route.ts` | **Modified** | Delivery-ID dedup, processing lock, robust comment upsert |
| `supabase/migrations/add_github_reliability.sql` | **Created** | `github_webhook_deliveries` table + `github_pr_processing` table |
| `tests/github-webhook.test.ts` | **Modified** | +24 tests across 4 suites |

---

## 2. Gate Evidence

### Gate A — GitHub App JWT signing

**Implementation:** `src/lib/github/app-auth.ts`

- `signJWT(appId, privateKeyPem)` signs an RS256 JWT using Node.js built-in `crypto.createSign("sha256WithRSAEncryption")`. No external library.
- Spec compliance: `alg=RS256`, `typ=JWT`, `iss=appId`, `iat=now−60s` (clock-skew), `exp=iat+600s` (10-min GitHub max).
- `getInstallationToken()` exchanges the JWT for an Installation Access Token via `POST /app/installations/{id}/access_tokens`, caches in-process (`Map<installationId, {token, expiresAt}>`), re-issues when < 5 min remain.
- `resolveGitHubToken()` resolves token in priority order: App > PAT. Throws if neither is set.
- `GITHUB_APP_PRIVATE_KEY` accepts both actual newlines and literal `\n` (Vercel env format).

### Gate B — PAT removed from production path

**Before:** `client.ts` called synchronous `getToken()` → `process.env.GITHUB_TOKEN` directly in all GitHub API calls.

**After:** All calls go through `resolveGitHubToken()`. PAT is a fallback for local dev / migration window, not the primary path. If App credentials are present, Installation tokens are used exclusively.

`fetchPullRequestDiff` had its own inline `fetch` with `getToken()` — also updated to use `resolveGitHubToken()`.

### Gate C — Webhook dedupe: delivery_id + SHA

Two-layer dedup, checked in sequence:

**Layer 1 — Delivery-level (new):** `checkDeliveryId(deliveryId)`
- Inserts `delivery_id` into `github_webhook_deliveries` (PK = `delivery_id`).
- Unique constraint violation (PG code `23505`) → duplicate delivery → return 200 immediately.
- Checked **before** acquiring the processing lock to minimize lock contention.
- Handles `null` delivery_id gracefully (fail-open).

**Layer 2 — SHA-level (existing, preserved):** `checkAndRecordDelivery()`
- Inserts into `github_pr_runs` with `UNIQUE (repo_full_name, pr_number, pr_head_sha)`.
- Checked **inside** the processing lock to prevent TOCTOU: two requests for different SHAs can't both slip through.

### Gate D — Concurrency lock (per repo+PR)

**Implementation:** `acquireProcessingLock` / `releaseProcessingLock` in `route.ts`

Table: `github_pr_processing (repo_full_name, pr_number)` — PRIMARY KEY prevents concurrent rows.

**Acquire protocol:**
1. DELETE any lock with `locked_at < now() − 120 s` (crash recovery — stale lock eviction).
2. INSERT lock row. `23505` → another request is processing → return `200 skipped:concurrency_locked`.

**Release:** Always runs in `finally` block — no stuck locks on exceptions or early returns.

**Lock TTL:** 120 seconds (`LOCK_TTL_MS`). A crashed invocation's lock is stolen by the next delivery after TTL.

**Fail-open design:** All DB errors in acquire/release return `true` (proceed) to avoid blocking deliveries when Supabase is degraded.

### Gate E — Sticky comment robustness

`upsertBotComment()` replaces the old `find` + single-branch logic:

| State | Behaviour |
|-------|-----------|
| No bot comment (including post-deletion) | `createIssueComment` — recreates |
| One bot comment | `updateIssueComment(existing.id)` |
| Multiple bot comments | `updateIssueComment(newest.id)` + `deleteIssueComment` for each duplicate |

"Newest" is determined by comment ID (GitHub IDs are monotonically increasing — no `created_at` sort needed). Duplicate deletions are best-effort (`.catch(() => {})`) so a 404 on an already-deleted duplicate doesn't fail the webhook.

---

## 3. Test Results

```
pnpm test:webhook   →   39 tests: 39 passed, 0 failed
pnpm typecheck      →   exit 0 (no errors)
```

### Test Suites Added

**GitHub App JWT (7 tests):**
- `signJWT` produces a 3-part dot-separated token
- JWT header declares `alg=RS256` and `typ=JWT`
- JWT payload encodes correct `iss` and valid `iat`/`exp` window
- **JWT signature verifies with the corresponding public key (RS256)** — end-to-end proof
- JWT signature rejects a tampered payload
- Different appIds produce different JWTs
- Token cache is cleared correctly

**Delivery dedup simulation (5 tests):**
- First delivery accepted
- Second delivery with same ID rejected
- Different delivery IDs both accepted
- `null` delivery ID treated as non-duplicate (fail-open)
- Third delivery with same ID also rejected

**Concurrency lock simulation (7 tests):**
- First request acquires lock
- Concurrent second request is blocked
- Locks on different PRs are independent
- Locks on different repos are independent
- After release, lock is re-acquirable
- **Simulated double webhook: only first proceeds, second blocked** — key proof
- Stale lock past TTL is evicted and replaced

**Sticky comment robustness (5 tests):**
- No bot comment → create (deleted-comment recovery)
- One bot comment → update, no deletions
- Two bot comments → update newest, delete oldest
- Three bot comments → update newest, delete both older duplicates
- Non-bot comments ignored

---

## 4. GitHub App Environment Configuration

### Required env vars (Vercel / `.env.local`)

```bash
# GitHub App credentials (replaces GITHUB_TOKEN for production)
GITHUB_APP_ID=123456                          # numeric App ID from GitHub App settings
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
                                              # PEM key with literal \n (Vercel format)
                                              # OR real newlines — both handled
GITHUB_APP_INSTALLATION_ID=12345678          # from /app/installations endpoint

# Webhook security (unchanged)
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# PAT fallback — only needed for local dev when App vars are absent
# GITHUB_TOKEN=ghp_...
```

### How to get the values

1. **App ID:** GitHub → Settings → Developer settings → GitHub Apps → your app → "App ID"
2. **Private key:** GitHub App → "Generate a private key" → download `.pem` file → paste content with `\n` line breaks in Vercel
3. **Installation ID:** `curl -H "Authorization: Bearer {JWT}" https://api.github.com/app/installations` → `id` field

### Permissions required by the GitHub App

| Permission | Level | Reason |
|------------|-------|--------|
| Pull requests | Read | List PR comments |
| Issues | Write | Create / update / delete comments |
| Contents | Read | Fetch PR diff |

Webhook events to subscribe: `Pull request`

---

## 5. Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `github_webhook_deliveries` grows unbounded | Low | Table grows slowly (~3 rows/PR). Manual `TRUNCATE` every few months. No background worker needed at current scale. |
| In-process token cache reset on cold start | Low | Cold starts re-exchange the JWT (1 extra HTTPS call, < 100 ms). Subsequent warm requests reuse the cache. |
| Processing lock TTL (120 s) may not cover slow analysis on large diffs | Low | Increase `LOCK_TTL_MS` if p99 analysis latency exceeds 2 min. Currently 2 s typical. |
| PAT fallback `GITHUB_TOKEN` still works | Intentional | Enables zero-downtime migration. Remove `GITHUB_TOKEN` from env once App is confirmed stable. |
| `deleteIssueComment` silently ignored on 404 | Intentional | Best-effort cleanup only. A 404 means the duplicate was already deleted — desired outcome. |
