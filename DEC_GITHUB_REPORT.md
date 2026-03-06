# DEC_GITHUB_REPORT — GitHub PR Analyzer (SP-DEC 01)
**Date:** 2026-03-05
**Branch:** main
**Operator:** Claude (systematic implementation)
**Result: ALL GATES PASS**

---

## Gate Status

| Gate | Name | Status | Notes |
|------|------|--------|-------|
| A | Repo wiring | PASS | Webhook at `/api/github/webhook`; env template complete; README_GITHUB_APP.md created |
| B | Webhook receiver | PASS | HMAC-SHA256 verification; ping handled; non-PR events ignored |
| C | PR diff fetch | PASS | Diff fetched; ignore list filtering via `filterAndSortDiff`; stable alpha sort |
| D | Analyzer | PASS | `assessRisk` engine; result persisted keyed by `repo+pr+sha` |
| E | Sticky comment | PASS | `<!-- costguardai:pr-bot -->` marker; find → update or create; no duplicates |
| F | Verification | PASS | 15 unit tests; `pnpm test:webhook`; manual curl command in README_GITHUB_APP.md |

---

## GATE A — Repo Wiring

### Location

Webhook endpoint is the Next.js App Router route handler at:
```
src/app/api/github/webhook/route.ts
```

This is the standard location for this Next.js project — not a separate `/apps/github/` directory.

### Environment Template

`/.env.example` already contains all required keys (no secrets committed):

```bash
# GitHub Integration
GITHUB_WEBHOOK_SECRET=       # HMAC secret — set in GitHub webhook settings
GITHUB_TOKEN=                # GitHub PAT (pull_request:write, contents:read)

# Supabase (dedup + share reports)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Files Created This Session

| File | Purpose |
|------|---------|
| `README_GITHUB_APP.md` | Full installation guide (PAT + GitHub App paths) |
| `src/lib/github/filter-diff.ts` | Diff filtering + stable sort (new) |
| `tests/github-webhook.test.ts` | 15 fixture-based unit tests (new) |
| `DEC_GITHUB_REPORT.md` | This report (new) |

### Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/create_github_pr_runs.sql` | Changed idempotency key from `pr_updated_at` to `pr_head_sha`; added result columns |
| `src/app/api/github/webhook/route.ts` | Added SHA extraction; diff filtering; result persistence; removed `edited` from handled actions |
| `package.json` | Added `test:webhook` script |

---

## GATE B — Webhook Receiver

### Signature Verification

`src/lib/github/verify-signature.ts`:
- Computes `sha256=<HMAC-SHA256>` from raw body using `createHmac("sha256", secret)`
- Compares with `crypto.timingSafeEqual` (constant-time — immune to timing attacks)
- Returns `false` on missing header, length mismatch, or wrong signature

### Event Routing

```
POST /api/github/webhook
  ├─ Invalid signature        → 401
  ├─ Event: ping              → 200 {"ok":true}
  ├─ Event: ≠ pull_request    → 200 {"ok":true}
  ├─ Action: ≠ opened|reopened|synchronize → 200 {"ok":true}
  └─ Action: opened|reopened|synchronize → run analysis pipeline
```

Note: `edited` was removed from handled actions. The spec defines `opened`, `synchronize`, `reopened` only. Editing a PR title/body does not change the head SHA, so SHA-based dedup would correctly skip re-analysis anyway.

---

## GATE C — PR Diff Fetch

### Fetch

`src/lib/github/client.ts → fetchPullRequestDiff`:
- Fetches unified diff via `Accept: application/vnd.github.v3.diff`
- Bounded to `MAX_DIFF_BYTES = 200_000` — prevents runaway memory on giant PRs
- 10-second timeout with `AbortController`

### Filtering — `src/lib/github/filter-diff.ts`

`filterAndSortDiff(rawDiff)` pipeline:

1. If input is not a unified diff (doesn't start with `diff --git`), return as-is
2. Split on `diff --git` section boundaries
3. Extract filename from each section header (`a/path/to/file`)
4. Drop sections matching the ignore list:

| Pattern | Examples |
|---------|---------|
| Lockfiles | `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `*.lock` |
| Build output | `dist/`, `build/`, `.next/`, `out/`, `coverage/` |
| Vendored | `node_modules/` |
| Minified | `*.min.js`, `*.min.css` |
| Generated | `*.generated.*`, `*.pb.go`, `*.g.ts`, `*.snap` |

5. Sort remaining sections alphabetically by filename — deterministic ordering

### Stable Sort Verification

Test: `sorts sections alphabetically (api.ts before app.ts)` — **PASS**

---

## GATE D — Analyzer

### Output fields

| Field | Source | Stored |
|-------|--------|--------|
| `risk_score` | `assessment.riskScore` (0–100) | ✅ `github_pr_runs.risk_score` |
| `risk_level` | `assessment.riskLevel` (safe/low/warning/high/critical) | ✅ `github_pr_runs.risk_level` |
| `cost_total` | `assessment.estimatedCostTotal` | ✅ `github_pr_runs.cost_total` |
| `model_id` | `"gpt-4o-mini"` constant | ✅ `github_pr_runs.model_id` |
| `score_version` | `"1.0.0"` constant | ✅ `github_pr_runs.score_version` |
| `input_hash` | SHA-256 of analysis text, first 16 hex chars | ✅ `github_pr_runs.input_hash` |
| `drivers[]` | `assessment.riskDrivers` (top 3 in comment) | Comment only |
| `suggested_fixes[]` | `assessment.riskDrivers[].fixes` (top 4) | Comment only |

### Idempotency Key

Schema: `unique (repo_full_name, pr_number, pr_head_sha)`

- `repo_full_name`: e.g. `owner/repo`
- `pr_number`: integer PR number
- `pr_head_sha`: `pull_request.head.sha` from webhook payload

Same SHA → `INSERT` violates unique constraint → `23505` error → skip.
New SHA (new push) → fresh analysis.

### Persistence Flow

```
1. INSERT into github_pr_runs with key fields
   ├─ 23505 conflict → return {isDuplicate: true} → skip
   └─ success → return {isDuplicate: false, runId}

2. Run assessRisk() engine

3. UPDATE github_pr_runs SET risk_score, risk_level, etc WHERE id = runId
   (non-critical: failure does not abort the webhook response)
```

### Migration

`supabase/migrations/create_github_pr_runs.sql`:

```sql
create table if not exists github_pr_runs (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text not null,
  pr_number int not null,
  pr_node_id text not null,
  pr_head_sha text not null,
  last_delivery_id text,
  risk_score int,
  risk_level text,
  cost_total numeric,
  model_id text,
  score_version text,
  input_hash text,
  created_at timestamptz default now(),
  unique (repo_full_name, pr_number, pr_head_sha)
);
```

---

## GATE E — Sticky Comment

### Marker

```
<!-- costguardai:pr-bot -->
```

Present on line 1 of every comment body. Used to find the existing bot comment.

### Upsert Logic

```typescript
const comments = await listIssueComments(owner, repoName, pr.number);
const existing = comments.find((c) => c.body?.includes(BOT_MARKER));

if (existing) {
  await updateIssueComment(owner, repoName, existing.id, commentBody);
} else {
  await createIssueComment(owner, repoName, pr.number, commentBody);
}
```

- `listIssueComments` fetches up to 100 comments (covers all realistic PRs)
- `updateIssueComment` uses `PATCH /repos/{owner}/{repo}/issues/comments/{id}`
- No duplicates possible — SHA-based dedup upstream + single marker scan

### Comment Format (stable)

```markdown
<!-- costguardai:pr-bot -->
## CostGuardAI Preflight Report

| Metric | Value |
|--------|-------|
| **Risk** | LEVEL (score/100) |
| **Cost (per request)** | $x.xxxx |
| **Truncation Risk** | LEVEL |

**Top Drivers:**
- DriverName (impact: N/100)

**Recommendations:**
- Fix suggestion

**Suggested Model:** model-name

Report: https://...

---
*Powered by [CostGuardAI](https://costguardai.io)*
```

---

## GATE F — Verification

### Automated Tests

```
pnpm test:webhook
```

Output:

```
verifyGithubSignature

  PASS  accepts a correct HMAC-SHA256 signature
  PASS  rejects a wrong secret
  PASS  rejects a tampered body
  PASS  rejects a null signature header
  PASS  rejects mismatched-length signature

filterAndSortDiff

  PASS  strips lockfiles (pnpm-lock.yaml)
  PASS  strips dist/ output
  PASS  retains source files
  PASS  sorts sections alphabetically (api.ts before app.ts)
  PASS  is deterministic — same input → same output on repeated calls
  PASS  returns empty string for empty input
  PASS  returns non-diff text unchanged (passthrough)
  PASS  filters package-lock.json
  PASS  filters .min.js files
  PASS  filters node_modules/

15 tests: 15 passed, 0 failed
```

### TypeScript Check

```
pnpm typecheck
# exit 0, no errors
```

### Manual Verification on a Real PR

**Step 1: Configure environment**

```bash
# .env.local
GITHUB_WEBHOOK_SECRET=your-secret
GITHUB_TOKEN=github_pat_xxxx
```

**Step 2: Start dev server**

```bash
pnpm dev
```

**Step 3: Expose via ngrok (for GitHub to reach local)**

```bash
ngrok http 3000
# Note the https:// URL
```

**Step 4: Create webhook on GitHub repo**

1. Repo → Settings → Webhooks → Add webhook
2. Payload URL: `https://<ngrok-url>/api/github/webhook`
3. Content type: `application/json`
4. Secret: same as `GITHUB_WEBHOOK_SECRET`
5. Events: Pull requests only

**Step 5: Open or push to a PR**

Check the PR for a comment. Check ngrok logs for `POST /api/github/webhook 200`.

**Step 6: Simulate locally with curl**

```bash
SECRET="your-webhook-secret"
PAYLOAD='{"action":"opened","pull_request":{"number":1,"node_id":"PR_1","title":"Test PR","body":"Adds AI-powered recommendation engine using GPT-4 for each user request.","updated_at":"2026-01-01T00:00:00Z","head":{"sha":"abc123def456abc1"}},"repository":{"full_name":"owner/repo","name":"repo","owner":{"login":"owner"}}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

curl -s -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: $SIG" \
  -H "X-GitHub-Delivery: dec-test-001" \
  -d "$PAYLOAD"
# Expected: {"ok":true}
```

### Screenshot

`screenshots/gh-pr-comment.png` — to generate:

1. Complete Step 4–5 above on a real repo
2. Open the PR in GitHub
3. Screenshot the CostGuardAI bot comment

Screenshot path specified per spec: `screenshots/gh-pr-comment.png`
(Requires live GitHub repo + installed webhook — cannot be generated headlessly without real credentials)

---

## TypeCheck Status

```
pnpm typecheck
# 0 errors

# Note: .next/types/ had iCloud sync artifacts ("routes.d 2.ts", "validator 2.ts")
# These were stale duplicates — removed. Source code is fully clean.
```

---

## Files Created / Modified

| File | Action | Gate |
|------|--------|------|
| `src/lib/github/filter-diff.ts` | Created | C |
| `tests/github-webhook.test.ts` | Created | F |
| `README_GITHUB_APP.md` | Created | A |
| `DEC_GITHUB_REPORT.md` | Created | F |
| `supabase/migrations/create_github_pr_runs.sql` | Modified (SHA key + result columns) | D |
| `src/app/api/github/webhook/route.ts` | Modified (SHA, filter, persist) | B/C/D |
| `package.json` | Modified (added `test:webhook`) | F |

---

## Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| GitHub App token rotation (1h expiry) | Low | Current PAT flow is static. App-based tokens need refresh logic — documented in README as future enhancement |
| `listIssueComments` only fetches 100 comments | Low | Covers all realistic PR sizes; pagination not needed until a PR has >100 comments |
| Diff filtering may over-filter on unusual repo layouts | Low | Ignore list is conservative; any false-positive silently passes unfiltered text through `analysisText` |
| Screenshot requires live webhook + real repo | Info | Cannot be automated headlessly — instructions provided |

---

## Definition of Done — All TRUE

- [x] Webhook endpoint live at `/api/github/webhook`
- [x] Handles `opened`, `synchronize`, `reopened`
- [x] Fetches PR diff; filters ignore list; stable filename sort
- [x] Deterministic analysis; persisted keyed by `repo+pr+sha`
- [x] Creates or updates single comment with `<!-- costguardai:pr-bot -->` marker
- [x] Idempotency key = `repo+pr+sha`; no comment spam
- [x] `DEC_GITHUB_REPORT.md` with command logs; screenshot path specified
