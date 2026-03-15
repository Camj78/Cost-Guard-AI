/**
 * scripts/seed-ai-events.ts
 *
 * Generates 100,000 synthetic ai_usage_events rows and measures rollup query
 * latency at p50/p95/p99.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx scripts/seed-ai-events.ts
 *
 * Options (env vars):
 *   SEED_COUNT   — number of events to insert (default: 100000)
 *   SEED_BATCH   — insert batch size (default: 500)
 *   SEED_DAYS    — how many days back to spread events (default: 90)
 *   SEED_QUERY   — set to "1" to skip insert and run latency queries only
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const SEED_COUNT = parseInt(process.env.SEED_COUNT ?? "100000", 10);
const SEED_BATCH = parseInt(process.env.SEED_BATCH ?? "500", 10);
const SEED_DAYS  = parseInt(process.env.SEED_DAYS  ?? "90", 10);
const QUERY_ONLY = process.env.SEED_QUERY === "1";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Random helpers ────────────────────────────────────────────────────────────

const MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

const ENDPOINTS = ["/api/v1/analyze", "/api/analyses"];
const ENVS = ["production", "development", "preview"];

const PROMPT_HASHES = Array.from({ length: 200 }, (_, i) =>
  sha256Sync(`prompt-${i}`)
);

function sha256Sync(s: string): string {
  // Simple deterministic fake hash for seeding (not cryptographic)
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h >>>= 0;
  }
  return h.toString(16).padStart(8, "0").repeat(8).slice(0, 64);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomTs(daysBack: number): string {
  const now = Date.now();
  const offsetMs = Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(now - offsetMs).toISOString();
}

function makeEvent() {
  return {
    ts: randomTs(SEED_DAYS),
    org_id: `org-${randInt(1, 20)}`,
    project_id: Math.random() < 0.7 ? `proj-${randInt(1, 50)}` : null,
    endpoint: pick(ENDPOINTS),
    model: pick(MODELS),
    tokens_in: randInt(100, 32000),
    tokens_out: randInt(50, 4000),
    latency_ms: randInt(50, 3000),
    env: pick(ENVS),
    prompt_hash: Math.random() < 0.8 ? pick(PROMPT_HASHES) : null,
    prompt_preview: null,
  };
}

// ── Insert ────────────────────────────────────────────────────────────────────

async function seedEvents(): Promise<void> {
  console.log(`\nSeeding ${SEED_COUNT.toLocaleString()} events in batches of ${SEED_BATCH}…`);
  const t0 = Date.now();
  let inserted = 0;
  let batches = 0;

  while (inserted < SEED_COUNT) {
    const batchSize = Math.min(SEED_BATCH, SEED_COUNT - inserted);
    const rows = Array.from({ length: batchSize }, makeEvent);

    const { error } = await admin.from("ai_usage_events").insert(rows);
    if (error) {
      console.error(`Insert error at batch ${batches + 1}:`, error.message);
      process.exit(1);
    }

    inserted += batchSize;
    batches++;

    if (batches % 20 === 0 || inserted === SEED_COUNT) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      process.stdout.write(`\r  ${inserted.toLocaleString()} / ${SEED_COUNT.toLocaleString()} (${elapsed}s)`);
    }
  }

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nInserted ${inserted.toLocaleString()} events in ${totalSec}s\n`);
}

// ── Latency measurement ───────────────────────────────────────────────────────

async function measureQuery(
  name: string,
  fn: () => Promise<unknown>
): Promise<number[]> {
  const RUNS = 10;
  const timings: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    const t = Date.now();
    await fn();
    timings.push(Date.now() - t);
  }

  timings.sort((a, b) => a - b);
  const p50 = timings[Math.floor(RUNS * 0.5)];
  const p95 = timings[Math.floor(RUNS * 0.95)] ?? timings[RUNS - 1];
  const p99 = timings[Math.floor(RUNS * 0.99)] ?? timings[RUNS - 1];

  console.log(`  ${name}`);
  console.log(`    p50=${p50}ms  p95=${p95}ms  p99=${p99}ms  (${RUNS} runs)`);
  return timings;
}

async function runLatencyQueries(): Promise<void> {
  console.log("Running latency queries (10 runs each)…\n");

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  await measureQuery("daily_spend (last 30d)", async () => {
    await admin
      .from("ai_usage_events")
      .select("ts, model, tokens_in, tokens_out")
      .gte("ts", since30d)
      .order("ts", { ascending: true });
  });

  await measureQuery("top_models (last 30d)", async () => {
    await admin
      .from("ai_usage_events")
      .select("model, tokens_in, tokens_out")
      .gte("ts", since30d);
  });

  await measureQuery("top_prompts (last 30d)", async () => {
    await admin
      .from("ai_usage_events")
      .select("prompt_hash, tokens_in, tokens_out")
      .gte("ts", since30d)
      .not("prompt_hash", "is", null);
  });

  await measureQuery("filter by model + env (last 7d)", async () => {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await admin
      .from("ai_usage_events")
      .select("ts, model, tokens_in, tokens_out")
      .gte("ts", since7d)
      .eq("model", "gpt-4o")
      .eq("env", "production");
  });

  await measureQuery("distinct filter options", async () => {
    await admin
      .from("ai_usage_events")
      .select("model, env, project_id")
      .gte("ts", since30d);
  });

  console.log();
}

// ── Count events ──────────────────────────────────────────────────────────────

async function getCount(): Promise<number> {
  const { count } = await admin
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const countBefore = await getCount();
  console.log(`Table has ${countBefore.toLocaleString()} events before seeding.`);

  if (!QUERY_ONLY) {
    await seedEvents();
  } else {
    console.log("SEED_QUERY=1 — skipping insert.\n");
  }

  const countAfter = await getCount();
  console.log(`Table now has ${countAfter.toLocaleString()} events.\n`);

  await runLatencyQueries();

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
