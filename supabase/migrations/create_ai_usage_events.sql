-- AI Usage Events: per-call telemetry for every analysis request
-- Captures enough for spend, token, latency, and prompt-origin rollups.

create table if not exists ai_usage_events (
  id          uuid        primary key default gen_random_uuid(),
  ts          timestamptz not null    default now(),
  org_id      text,
  project_id  text,
  endpoint    text        not null,
  model       text        not null,
  tokens_in   int         not null,
  tokens_out  int         not null,
  latency_ms  int         not null,
  env         text        not null    default 'production',
  prompt_hash text,
  prompt_preview text
);

-- Single-column indexes for filter predicates
create index if not exists ai_usage_events_ts_idx         on ai_usage_events (ts);
create index if not exists ai_usage_events_model_idx      on ai_usage_events (model);
create index if not exists ai_usage_events_org_id_idx     on ai_usage_events (org_id);
create index if not exists ai_usage_events_project_id_idx on ai_usage_events (project_id);
create index if not exists ai_usage_events_endpoint_idx   on ai_usage_events (endpoint);
create index if not exists ai_usage_events_env_idx        on ai_usage_events (env);

-- Composite indexes for the common rollup access patterns
create index if not exists ai_usage_events_org_ts_idx     on ai_usage_events (org_id,  ts);
create index if not exists ai_usage_events_model_ts_idx   on ai_usage_events (model,   ts);
create index if not exists ai_usage_events_env_ts_idx     on ai_usage_events (env,     ts);

-- ── Rollup Views ──────────────────────────────────────────────────────────────

-- daily_spend: tokens consumed per day per model (cost proxy)
create or replace view daily_spend as
select
  date(ts)                          as day,
  model,
  count(*)                          as calls,
  sum(tokens_in)                    as total_tokens_in,
  sum(tokens_out)                   as total_tokens_out,
  sum(tokens_in + tokens_out)       as total_tokens
from ai_usage_events
group by date(ts), model;

-- top_prompts_by_cost: highest-token prompt hashes (deduplicated)
create or replace view top_prompts_by_cost as
select
  prompt_hash,
  count(*)                          as calls,
  sum(tokens_in + tokens_out)       as tokens
from ai_usage_events
where prompt_hash is not null
group by prompt_hash
order by tokens desc
limit 50;

-- top_models_by_spend: token consumption ranked by model
create or replace view top_models_by_spend as
select
  model,
  count(*)                          as calls,
  sum(tokens_in)                    as total_tokens_in,
  sum(tokens_out)                   as total_tokens_out,
  sum(tokens_in + tokens_out)       as tokens
from ai_usage_events
group by model
order by tokens desc;
