-- ─── Webhook inbox (fail-soft deferral) ──────────────────────────────────────
--
-- When Supabase/DB is unavailable, incoming PR webhook events are written here
-- instead of being processed immediately. The recovery worker
-- (POST /api/github/recover) drains this inbox when the DB is healthy.
--
-- "Latest SHA wins" semantics:
--   unique(repo_full_name, pr_number) — one pending slot per PR.
--   Upsert ON CONFLICT replaces pr_head_sha with the most recently received one.
--   sha1 → sha2 → sha3 while degraded → only sha3 is ever processed.
--
-- Exactly-once guarantee:
--   The recovery worker checks github_pr_runs unique(repo_full_name, pr_number, pr_head_sha)
--   before running analysis. If the SHA was already processed (duplicate delivery
--   after DB recovered), the run is skipped and the inbox entry is marked done.
--
-- Backoff:
--   attempts increments on each failed recovery attempt.
--   next_attempt_at is updated with exponential delay (30s, 60s, 120s, 240s, 300s cap).
--   After 5 failed attempts, status is set to 'dead' (requires manual inspection).

create table if not exists github_webhook_inbox (
  id              uuid         primary key default gen_random_uuid(),

  -- "Latest SHA wins" slot — one row per open PR
  repo_full_name  text         not null,
  pr_number       int          not null,
  pr_head_sha     text         not null,
  pr_node_id      text         not null,

  -- Which delivery wrote this row (latest delivery for this PR while degraded)
  delivery_id     text,

  -- Timestamps
  received_at     timestamptz  not null default now(),

  -- Worker lifecycle
  status          text         not null default 'pending'
                               check (status in ('pending', 'processing', 'done', 'dead')),
  last_error      text,
  attempts        int          not null default 0,
  next_attempt_at timestamptz  not null default now(),

  -- Enforce "latest SHA wins" — one pending row per PR
  unique (repo_full_name, pr_number)
);

-- Index for recovery worker: cheaply fetch oldest-due pending items
create index if not exists github_webhook_inbox_pending_idx
  on github_webhook_inbox (next_attempt_at)
  where status = 'pending';

-- Index for status-based queries (monitoring / dead-letter review)
create index if not exists github_webhook_inbox_status_idx
  on github_webhook_inbox (status, received_at);
