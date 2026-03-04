create table if not exists github_pr_runs (
  id uuid primary key default gen_random_uuid(),
  repo_full_name text not null,
  pr_number int not null,
  pr_node_id text not null,
  pr_updated_at timestamptz not null,
  last_delivery_id text,
  created_at timestamptz default now(),
  unique (repo_full_name, pr_number, pr_updated_at)
);
