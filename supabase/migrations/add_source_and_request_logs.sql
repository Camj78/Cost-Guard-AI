-- ── CLI source tracking ───────────────────────────────────────────────────────
-- Nullable 'source' on ai_usage_events lets us distinguish CLI-originated
-- analyses (source='cli') from web-originated ones.

ALTER TABLE ai_usage_events ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS ai_usage_events_source_idx
  ON ai_usage_events (source)
  WHERE source IS NOT NULL;

-- Also tag analysis_history rows written by the web UI path.
ALTER TABLE analysis_history ADD COLUMN IF NOT EXISTS source text;

-- ── API error log ─────────────────────────────────────────────────────────────
-- Minimal 5xx log for launch health monitoring.
-- Only metadata: no prompts, no payloads.

CREATE TABLE IF NOT EXISTS request_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  route       text        NOT NULL,
  status_code integer     NOT NULL,
  source      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_logs_created_at_idx
  ON request_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS request_logs_status_created_idx
  ON request_logs (status_code, created_at DESC);
