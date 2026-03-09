-- Idempotent guard: ensure analysis_version column exists on prompt_incidents.
-- The column was introduced in create_prompt_threat_intelligence.sql with default '1.0.0'.
-- This migration is a safe no-op on databases where the column already exists.
-- Required so future DB setups and schema audits confirm version isolation is enforced.

ALTER TABLE prompt_incidents
  ADD COLUMN IF NOT EXISTS analysis_version text NOT NULL DEFAULT 'v1';
