# CostGuardAI — GitHub PR Bot

Analyzes every pull request for AI cost and failure risk. Posts a sticky comment on each PR with:
- Risk Score (0–100)
- Top risk drivers
- Recommendations
- Link to full shareable report

---

## How It Works

1. GitHub sends a webhook to `/api/github/webhook` on PR `opened`, `synchronize`, or `reopened`.
2. The webhook verifies the HMAC-SHA256 signature using `GITHUB_WEBHOOK_SECRET`.
3. CostGuardAI fetches the PR diff, filters generated/lockfiles, and runs the risk engine.
4. A single sticky comment (identified by `<!-- costguardai:pr-bot -->`) is created or updated.
5. A shareable report link is generated if Supabase is configured.

Idempotency key: `repo + PR number + head SHA`. Re-deliveries for the same SHA are skipped.

---

## Requirements

| Credential | Source | Used For |
|---|---|---|
| `GITHUB_WEBHOOK_SECRET` | GitHub webhook settings | Signature verification |
| `GITHUB_TOKEN` | GitHub PAT or App token | Read diffs, write comments |
| `SUPABASE_URL` | Supabase project settings | Dedup + report storage (optional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings | Dedup + report storage (optional) |

---

## Setup — Personal Access Token (Simplest)

### Step 1: Create a GitHub PAT

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Set repository access to the target repo(s)
4. Required permissions:
   - **Pull requests**: Read and write (to post/update comments)
   - **Contents**: Read-only (to fetch diffs)
5. Copy the token — you will not see it again

### Step 2: Add environment variables

Add to your Vercel project (or `.env.local` for local testing):

```
GITHUB_WEBHOOK_SECRET=your-random-secret-here
GITHUB_TOKEN=github_pat_xxxx...
```

For dedup + shareable reports, also add:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 3: Apply the database migration

Run in Supabase SQL editor (or `supabase db push` if using Supabase CLI):

```sql
-- File: supabase/migrations/create_github_pr_runs.sql
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

### Step 4: Create the GitHub webhook

1. Go to your repository → **Settings** → **Webhooks** → **Add webhook**
2. Set **Payload URL** to:
   ```
   https://your-app.vercel.app/api/github/webhook
   ```
3. Set **Content type** to `application/json`
4. Set **Secret** to the same value as `GITHUB_WEBHOOK_SECRET`
5. Under **Which events**, select **Let me select individual events** → check **Pull requests**
6. Click **Add webhook**

GitHub will send a `ping` event immediately. CostGuardAI returns `{"ok":true}` on ping.

### Step 5: Verify the webhook

1. Open or push to a PR in the target repository
2. Check the PR for a comment from your bot account
3. Check **Settings → Webhooks → Recent Deliveries** for `200 OK` responses

---

## Setup — GitHub App (Production Recommended)

A GitHub App is preferred for multi-repo installs. It uses short-lived installation tokens instead of a long-lived PAT.

### Create the App

1. GitHub → **Settings** → **Developer settings** → **GitHub Apps** → **New GitHub App**
2. Set **Homepage URL** to `https://costguardai.io`
3. Set **Webhook URL** to `https://your-app.vercel.app/api/github/webhook`
4. Set **Webhook secret** (save this as `GITHUB_WEBHOOK_SECRET`)
5. Permissions:
   - **Pull requests**: Read and write
   - **Contents**: Read-only
6. Subscribe to: **Pull request** events
7. Set **Where can this GitHub App be installed?** → **Any account** (or **Only on this account** for private use)

### Install on a Repository

1. After creating, go to your App's page → **Install App**
2. Select the repository/repositories to monitor
3. Approve the permissions

### Configure the Token

For a GitHub App, you need to generate an installation token at runtime. The current implementation uses a static `GITHUB_TOKEN` — for App-based tokens, generate one on startup and refresh it before the 1-hour expiry. This is a future enhancement; the PAT flow above is recommended for initial setup.

---

## Diff Filtering

The bot automatically excludes these file types from analysis (they inflate token count without signal):

| Pattern | Reason |
|---|---|
| `*.lock`, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock` | Lockfiles |
| `dist/`, `build/`, `.next/`, `out/` | Build output |
| `node_modules/` | Vendored dependencies |
| `*.min.js`, `*.min.css` | Minified assets |
| `*.generated.*`, `*.snap` | Generated / snapshot files |

Remaining file sections are sorted alphabetically for deterministic analysis.

---

## Testing Locally

### Simulate a webhook event

```bash
# 1. Generate a signature
SECRET="your-webhook-secret"
PAYLOAD='{"action":"opened","pull_request":{"number":1,"node_id":"PR_1","title":"Test PR","body":"This tests AI cost risk.","updated_at":"2026-01-01T00:00:00Z","head":{"sha":"abc123def456"}},"repository":{"full_name":"owner/repo","name":"repo","owner":{"login":"owner"}}}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

# 2. Send to local dev server
curl -s -X POST http://localhost:3000/api/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: $SIG" \
  -H "X-GitHub-Delivery: test-delivery-001" \
  -d "$PAYLOAD"
# Expected: {"ok":true}
```

### Run unit tests

```bash
pnpm test:webhook
```

---

## Outage Behavior + Recovery

### What happens when Supabase is unavailable

CostGuardAI operates in **fail-soft mode** by default (`RESILIENCE_MODE=fail-soft`).

If the database is unavailable when a webhook arrives:

1. Signature is verified (always — no DB needed).
2. The event is written to `github_webhook_inbox` (best effort).
3. `HTTP 202 Accepted` is returned — GitHub does not auto-retry 202 responses.
4. **No analysis runs. No comment is posted.**

When multiple push events arrive during an outage, only the **most recent SHA** is stored (the inbox has `unique(repo_full_name, pr_number)`). Older SHAs are silently superseded.

### Recovery command

When Supabase returns, drain the inbox with:

```bash
curl -s -X POST https://your-app.vercel.app/api/github/recover \
  -H "Authorization: Bearer $GITHUB_RECOVER_SECRET"
```

The recovery worker:
- Processes pending inbox items in oldest-due-first order
- Uses `github_pr_runs` unique constraint to skip SHAs already analyzed (exactly-once)
- Collapses multiple deferred events per PR to the latest SHA only
- Marks items `done` on success; applies exponential backoff on failure (30s → 60s → 120s → 240s → 300s cap)
- After 5 failed attempts, marks item `dead` for manual inspection

### Required migration

Apply this migration before using the bot (adds the inbox table):

```sql
-- File: supabase/migrations/create_github_webhook_inbox.sql
-- (apply after create_github_pr_runs.sql and add_github_reliability.sql)
```

### Configuration

| Variable | Default | Description |
|---|---|---|
| `RESILIENCE_MODE` | `fail-soft` | Set to `disabled` to bypass degraded-mode logic |
| `DB_DEGRADED_MAX_MS` | `3000` | DB probe timeout in milliseconds |
| `GITHUB_RECOVER_SECRET` | *(unset)* | If set, `POST /api/github/recover` requires `Authorization: Bearer <secret>` |

### Guarantees

- **No spam**: zero GitHub API calls when DB is degraded
- **No dupes**: exactly one sticky comment per PR after recovery
- **Latest SHA wins**: if N push events arrive while degraded, only the newest is processed
- **Idempotent recovery**: running `/api/github/recover` multiple times is safe

---

## Security Notes

- Signature verification uses `crypto.timingSafeEqual` — immune to timing attacks.
- `GITHUB_TOKEN` and `GITHUB_WEBHOOK_SECRET` are server-only. Never commit them.
- The webhook returns `401` only on signature failure. All other errors return `200` to prevent GitHub retry storms.
- Dedup via `unique (repo_full_name, pr_number, pr_head_sha)` prevents double-posting on re-delivery.
