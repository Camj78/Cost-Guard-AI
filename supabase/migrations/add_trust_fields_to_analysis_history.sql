-- SP-DEC-07: Add trust/reproducibility fields to analysis_history
-- Enables audit trail and replay verification.

ALTER TABLE public.analysis_history
  ADD COLUMN IF NOT EXISTS analysis_version TEXT    DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS score_version     TEXT    DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS ruleset_hash      TEXT,
  ADD COLUMN IF NOT EXISTS input_hash        TEXT;

COMMENT ON COLUMN public.analysis_history.analysis_version IS 'Analysis engine version at time of run';
COMMENT ON COLUMN public.analysis_history.score_version     IS 'Risk scoring spec version (e.g. v1.0)';
COMMENT ON COLUMN public.analysis_history.ruleset_hash      IS 'SHA-256 of risk rule definitions at time of run';
COMMENT ON COLUMN public.analysis_history.input_hash        IS 'SHA-256 of normalized prompt text';
