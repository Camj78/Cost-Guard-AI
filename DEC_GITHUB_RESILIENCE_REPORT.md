# DEC_GITHUB_RESILIENCE_REPORT

## GitHub Webhook Fail-Soft + Outage Resilience

Date: 2026-03-04
Status: Implemented and verified

---

## Failure-Mode Description

### Failure scenario: Supabase/DB unavailable

The webhook pipeline requires Supabase for:
- Delivery-level dedup (`github_webhook_deliveries`)
- Per-PR processing lock (`github_pr_processing`)
- SHA-level semantic dedup + results (`github_pr_runs`)
- Share report generation (`share_reports`)

**Without fail-soft mode**, a DB outage causes all four operations to silently fail-open, which means:
- Duplicate analyses may run
- Duplicate comments may be posted
- GitHub may retry deliveries (non-2xx or slow responses trigger retries)

**With fail-soft mode (RESILIENCE_MODE=fail-soft, default on)**, the handler:
1. Probes DB health before any DB-dependent work (timeout: `DB_DEGRADED_MAX_MS`, default 3000ms)
2. If degraded: writes a minimal deferred record to `github_webhook_inbox` (best effort)
3. Returns HTTP 202 immediately — GitHub does not auto-retry 202 responses
4. Does NOT call the analyzer
5. Does NOT call GitHub APIs (no comment posted)

---

## What Counts as DB Degraded

Defined in `src/lib/github/resilience.ts`:

| Condition | Classification |
|---|---|
| Probe query takes > `DB_DEGRADED_MAX_MS` (default 3000ms) | Degraded |
| Probe query throws a network/connection error | Degraded |
| Probe query returns an error object from Supabase | Degraded |
| `RESILIENCE_MODE=disabled` | Always healthy (bypasses probe) |

---

## Implementation: Key Files

| File | Role |
|---|---|
| `src/lib/github/resilience.ts` | Contract definitions, `probeDbHealth()`, `nextBackoffSeconds()`, `InboxRow` type |
| `src/app/api/github/webhook/route.ts` | Modified: fail-soft path added before delivery dedup |
| `src/app/api/github/recover/route.ts` | New: recovery worker, drains inbox |
| `supabase/migrations/create_github_webhook_inbox.sql` | New: `github_webhook_inbox` table |
| `tests/github-webhook-resilience.test.ts` | New: 27 deterministic resilience tests |

---

## Test Evidence: DB-Down Scenario

```
Test 1: DB-down — ACK, inbox write, no analyzer/comment

  PASS  DB-down: webhook returns 202 (deferred)
  PASS  DB-down: analyzer is NOT called
  PASS  DB-down: no comment posted to GitHub
  PASS  DB-down: inbox row is written with correct SHA
  PASS  DB-down + inbox also down: ACK safely with no side effects
  PASS  non-handled action while degraded: return 200, no inbox write
```

**Guarantee:** When DB is unavailable, the webhook handler returns 202 in all cases and never calls the CostGuard analyzer or posts a GitHub comment.

---

## Test Evidence: Recovery Processing

```
Test 2: DB recovers — recovery processes, exactly-once

  PASS  recovery: processes pending inbox item and marks done
  PASS  recovery: github_pr_run is recorded for the processed SHA
  PASS  recovery: sticky comment is posted exactly once
  PASS  recovery: second run for same SHA is skipped (idempotent)
```

**Guarantee:** When the recovery worker (`POST /api/github/recover`) runs after DB returns, it processes each inbox item exactly once. If the recovery worker is invoked multiple times, subsequent calls detect the SHA is already in `github_pr_runs` and skip with no side effects.

---

## Test Evidence: Latest SHA Wins

```
Test 3: Latest SHA wins

  PASS  sha1 then sha2 while degraded → inbox holds sha2 only
  PASS  on recovery, only sha2 is processed (sha1 is never seen)
  PASS  three SHAs while degraded → only sha3 processed on recovery
```

**Mechanism:** The `github_webhook_inbox` table has `unique(repo_full_name, pr_number)`. Every webhook event for the same PR upserts this row, replacing `pr_head_sha` with the most recently received SHA. When DB recovers, the inbox holds exactly one row per PR — the latest SHA. Stale SHAs are never inserted into `github_pr_runs` and never commented on.

**Scenario 3 SHAs (sha1 → sha2 → sha3, all while degraded):**
- sha1 arrives → inbox row created: pr_head_sha = sha1
- sha2 arrives → inbox row upserted: pr_head_sha = sha2
- sha3 arrives → inbox row upserted: pr_head_sha = sha3
- DB recovers → recovery worker picks up single row with sha3
- sha3 inserted into github_pr_runs → comment posted for sha3
- sha1 and sha2 are never processed

---

## Test Evidence: Duplicate Delivery Handling

```
Test 4: Duplicate delivery ID in degraded mode

  PASS  same delivery_id twice while degraded → one inbox row (upsert)
  PASS  duplicate delivery → recovery processes it exactly once
```

**Mechanism:** In degraded mode, `github_webhook_deliveries` (the delivery dedup table) is also unavailable. Duplicate deliveries write the same data to the inbox via upsert — still producing one row. Recovery uses `github_pr_runs` unique constraint to prevent double-analysis.

---

## Test Evidence: Concurrency

```
Test 5: Concurrency — two webhooks same PR in parallel while degraded

  PASS  two concurrent webhooks same PR → one pending inbox row (latest SHA)
  PASS  concurrency: recovery processes only the latest SHA
```

**Mechanism:** Two concurrent webhook deliveries for the same PR both attempt to upsert the inbox row. The database serializes them atomically due to the unique constraint — the second upsert wins. Recovery processes whichever SHA landed last.

---

## Spam Prevention Guarantees

| Scenario | Behavior |
|---|---|
| DB degraded → delivery arrives | 202 returned, NO comment posted |
| DB degraded → duplicate delivery arrives | 202 returned, NO comment posted, inbox row overwritten |
| DB recovers → recovery runs for sha N | Exactly one comment posted/updated for sha N |
| Recovery runs twice for same item | Second run detects sha already in github_pr_runs → skipped, no second comment |
| Multiple SHAs while degraded | Only latest SHA comment is ever posted |

The sticky comment mechanism (`upsertBotComment`) ensures at most one `<!-- costguardai:pr-bot -->` comment exists per PR regardless of how many recovery runs occur.

---

## How to Simulate DB Outage and Verify Fail-Soft

### Local simulation

1. Start the dev server: `pnpm dev`
2. Set `RESILIENCE_MODE=fail-soft` and `DB_DEGRADED_MAX_MS=100` in `.env.local`
3. Point `SUPABASE_URL` to an unreachable host (e.g., `http://localhost:9999`)
4. Send a test webhook:

```bash
SECRET="your-webhook-secret"
PAYLOAD='{"action":"opened","pull_request":{"number":1,"node_id":"PR_1","title":"Test PR","body":"Test.","updated_at":"2026-01-01T00:00:00Z","head":{"sha":"test-sha-001"}},"repository":{"full_name":"owner/repo","name":"repo","owner":{"login":"owner"}}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

curl -s -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: $SIG" \
  -H "X-GitHub-Delivery: test-delivery-001" \
  -d "$PAYLOAD"
```

5. Expected response: `{"ok":true,"deferred":true}` with HTTP 202
6. Verify: no GitHub comment was posted, no analysis ran

### Disable fail-soft (verify normal behavior still works)

Set `RESILIENCE_MODE=disabled` and confirm normal analysis + comment pipeline runs.

---

## How to Run Recovery and Verify Latest-SHA-Wins

### Trigger recovery manually

```bash
# No auth secret configured (dev mode):
curl -s -X POST http://localhost:3000/api/github/recover \
  -H "Content-Type: application/json"

# With GITHUB_RECOVER_SECRET set:
curl -s -X POST http://localhost:3000/api/github/recover \
  -H "Authorization: Bearer your-recover-secret" \
  -H "Content-Type: application/json"
```

### Expected response (items pending)

```json
{
  "ok": true,
  "processed": 1,
  "skipped": 0,
  "errors": []
}
```

### Verify latest-SHA-wins

1. While DB is degraded, send events for sha1, then sha2 to the same PR
2. Check `github_webhook_inbox` table: should have one row with sha2
3. Run recovery: `POST /api/github/recover`
4. Check `github_pr_runs`: should have one row for sha2, none for sha1
5. Check PR on GitHub: one sticky comment reflecting sha2 analysis

---

## Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Inbox write fails AND DB is down (total outage) | Low | Returns 202 safely. GitHub will not auto-retry 202. Operator must manually re-trigger via the PR (push a new commit). |
| Recovery worker races with itself if invoked concurrently | Low | Items are marked `processing` atomically before processing. Stale `processing` entries (> 5 min) are reset to `pending` on next run. |
| Recovery worker processes outdated title/body (not stored in inbox) | Low-Medium | Analysis uses diff only with a "recovered" note. Title/body missing reduces signal slightly but does not cause incorrect output. |
| Dead-letter entries (5 failed attempts) require manual intervention | Low | Dead entries are flagged in `github_webhook_inbox.status = 'dead'`. Operator can reset `status = 'pending'` to retry. |
| GITHUB_RECOVER_SECRET not set in production | Medium | Without it, the recover endpoint is open. Set `GITHUB_RECOVER_SECRET` in Vercel env before enabling the cron job. |
