-- Prompt Threat Intelligence: CVE Database + Incident Tracking
-- 4 tables for the global Prompt CVE system.
-- No raw prompt text is ever stored — only anonymized structural fingerprints.

-- ─── Table 1: prompt_incidents ────────────────────────────────────────────────
-- Anonymized record of high-risk prompt events (riskScore >= 50).
-- Inputs: structural features only. Pattern_hash is SHA-256 of structure signature.

create table if not exists prompt_incidents (
  id               uuid        primary key default gen_random_uuid(),
  created_at       timestamptz not null    default now(),
  project_id       text,
  risk_type        text        not null,
  risk_score       integer     not null,
  token_estimate   integer     not null,
  model            text        not null,
  pattern_hash     text        not null,
  mitigation_used  text,
  analysis_version text        not null    default '1.0.0'
);

create index if not exists prompt_incidents_pattern_hash_idx  on prompt_incidents (pattern_hash);
create index if not exists prompt_incidents_risk_type_idx     on prompt_incidents (risk_type);
create index if not exists prompt_incidents_created_at_idx    on prompt_incidents (created_at);
create index if not exists prompt_incidents_risk_score_idx    on prompt_incidents (risk_score);

-- Service role write-only; no public read
alter table prompt_incidents enable row level security;

-- ─── Table 2: incident_patterns ───────────────────────────────────────────────
-- Rolling aggregated statistics for each unique structural pattern.
-- Drives CVE generation when count >= 25.

create table if not exists incident_patterns (
  pattern_hash text        primary key,
  count        integer     not null    default 1,
  avg_risk     integer     not null    default 0,
  last_seen    timestamptz not null    default now()
);

create index if not exists incident_patterns_count_idx    on incident_patterns (count desc);
create index if not exists incident_patterns_avg_risk_idx on incident_patterns (avg_risk desc);
create index if not exists incident_patterns_last_seen_idx on incident_patterns (last_seen desc);

alter table incident_patterns enable row level security;

-- Public readable — used by weekly intelligence job and CVE lookup
create policy "incident_patterns_public_read"
  on incident_patterns for select
  using (true);

-- ─── Table 3: prompt_pattern_examples ────────────────────────────────────────
-- Anonymized structural fingerprints for pattern analysis.
-- structure_signature example: "band:lg|Ambiguity Risk:9|Length Risk:8|..."
-- No prompt text — only structural labels and numeric severity signals.

create table if not exists prompt_pattern_examples (
  id                  uuid        primary key default gen_random_uuid(),
  pattern_hash        text        not null,
  structure_signature text        not null,
  risk_type           text        not null,
  created_at          timestamptz not null    default now()
);

create index if not exists prompt_pattern_examples_hash_idx on prompt_pattern_examples (pattern_hash);
create index if not exists prompt_pattern_examples_type_idx on prompt_pattern_examples (risk_type);

-- Service role write-only; no public read
alter table prompt_pattern_examples enable row level security;

-- ─── Table 4: prompt_cve_registry ────────────────────────────────────────────
-- Global Prompt CVE registry — one record per vulnerable pattern class.
-- CVE ID format: PCVE-YYYY-XXXX
-- Publicly readable to power Threat Intelligence on risk reports.

create table if not exists prompt_cve_registry (
  cve_id         text        primary key,
  pattern_hash   text        not null,
  risk_type      text        not null,
  severity       text        not null    check (severity in ('medium', 'high', 'critical')),
  description    text        not null,
  mitigation     text        not null,
  first_seen     timestamptz not null    default now(),
  last_seen      timestamptz not null    default now(),
  incident_count integer     not null    default 0
);

create index if not exists prompt_cve_registry_pattern_hash_idx on prompt_cve_registry (pattern_hash);
create index if not exists prompt_cve_registry_severity_idx     on prompt_cve_registry (severity);
create index if not exists prompt_cve_registry_last_seen_idx    on prompt_cve_registry (last_seen desc);

alter table prompt_cve_registry enable row level security;

-- Public readable — powers Threat Intelligence section on public risk reports
create policy "prompt_cve_registry_public_read"
  on prompt_cve_registry for select
  using (true);
