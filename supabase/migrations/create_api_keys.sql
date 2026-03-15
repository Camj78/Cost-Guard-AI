create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash text unique not null,
  plan text default 'pro',
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create index if not exists api_keys_key_hash_idx on api_keys(key_hash);
