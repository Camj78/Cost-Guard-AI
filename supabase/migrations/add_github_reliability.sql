-- ─── Delivery-level idempotency ──────────────────────────────────────────────
--
-- Deduplicates GitHub webhook deliveries using X-GitHub-Delivery header.
-- A unique constraint on delivery_id guarantees atomic, race-free dedup at
-- the database level. Any duplicate INSERT returns 23505 (unique_violation).
--
-- GitHub delivery IDs are globally unique UUIDs, so collisions are impossible.
-- No TTL cleanup worker is required; this table grows slowly in practice
-- (~3 rows/PR). A manual TRUNCATE every few months is sufficient.

create table if not exists github_webhook_deliveries (
  delivery_id text primary key,
  received_at timestamptz default now() not null
);

-- Index for future time-based cleanup queries
create index if not exists github_webhook_deliveries_received_at_idx
  on github_webhook_deliveries (received_at);


-- ─── Per-PR processing lock ───────────────────────────────────────────────────
--
-- Prevents two concurrent webhook deliveries for the same repo+PR from running
-- analysis in parallel (e.g. rapid consecutive pushes, GitHub retry storms).
--
-- Lock lifecycle:
--   Acquire: INSERT (conflict = lock held → skip)
--   Release: DELETE (always in finally block)
--   Crash recovery: stale locks older than 120 s are expired before each acquire
--
-- The lock is intentionally coarse-grained (per repo+pr) to keep the logic
-- simple. Lock TTL is enforced in application code (route.ts LOCK_TTL_MS).

create table if not exists github_pr_processing (
  repo_full_name text not null,
  pr_number      int  not null,
  locked_at      timestamptz default now() not null,
  primary key (repo_full_name, pr_number)
);
