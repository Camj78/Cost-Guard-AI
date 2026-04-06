create table if not exists cli_telemetry (
  id               uuid        primary key default gen_random_uuid(),
  source           text        not null,
  event            text        not null,
  anonymous_id     text        not null,
  has_api_key      boolean     not null,
  client_timestamp timestamptz not null,
  created_at       timestamptz not null default now()
);

create index cli_telemetry_created_at_idx
  on cli_telemetry (created_at desc);

create index cli_telemetry_anonymous_id_idx
  on cli_telemetry (anonymous_id);

create index cli_telemetry_event_created_at_idx
  on cli_telemetry (event, created_at desc);
