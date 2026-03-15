create table if not exists analysis_runs (
  runId uuid primary key,
  userId uuid,
  plan text,
  model text,

  inputTokens int,
  outputTokens int,
  cost numeric,

  latencyMs int,
  truncated boolean,
  compressionUsed boolean,

  createdAt timestamp default now()
);
