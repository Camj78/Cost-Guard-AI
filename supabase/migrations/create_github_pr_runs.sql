create table if not exists github_pr_runs (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text not null,
  pr_number int not null,
  pr_node_id text not null,
  -- Idempotency key: repo + pr + head SHA (changes on every push, stable within a push)
  pr_head_sha text not null,
  last_delivery_id text,
  -- Analysis result columns (populated after analysis completes)
  risk_score int,
  risk_level text,
  cost_total numeric,
  model_id text,
  score_version text,
  input_hash text,
  created_at timestamptz default now(),
  unique (repo_full_name, pr_number, pr_head_sha)
);
