-- add_metadata_to_github_installations
--
-- Adds full installation metadata columns populated by the GitHub App
-- installation webhook (event: installation, action: created).
--
-- user_id is made nullable because the webhook fires without a user session;
-- the install callback (/api/github/install/callback) sets user_id separately
-- via an onConflict upsert keyed on installation_id.

alter table github_installations
  add column if not exists account_login        text,
  add column if not exists account_id           bigint,
  add column if not exists account_type         text,
  add column if not exists repository_selection text;

-- Allow webhook-side inserts that do not yet have a user session.
-- The install callback always fills in user_id on its upsert.
alter table github_installations
  alter column user_id drop not null;
