-- github_installations
-- Stores GitHub App installation IDs linked to CostGuardAI users.
-- Created when a user installs the GitHub App and GitHub redirects
-- back to /api/github/install/callback with ?installation_id=...

create table if not exists github_installations (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  installation_id  bigint      not null,
  created_at       timestamptz not null default now(),

  constraint github_installations_installation_id_unique unique (installation_id)
);

-- Index for fast lookup by user
create index if not exists github_installations_user_id_idx
  on github_installations (user_id);

-- RLS: users may only see and modify their own rows
alter table github_installations enable row level security;

create policy "owner_select" on github_installations
  for select using (auth.uid() = user_id);

create policy "owner_insert" on github_installations
  for insert with check (auth.uid() = user_id);

create policy "owner_delete" on github_installations
  for delete using (auth.uid() = user_id);
