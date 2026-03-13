/**
 * Degraded-mode contract for the GitHub webhook pipeline.
 *
 * WHAT COUNTS AS DB DEGRADED:
 *   - Connection timeout (> DB_DEGRADED_MAX_MS milliseconds)
 *   - Any thrown error during the health probe query
 *   - Supabase returned an error object on the probe query
 *
 * BEHAVIOR WHEN DEGRADED (RESILIENCE_MODE=fail-soft):
 *   - Signature is ALWAYS verified first (no DB needed).
 *   - Do NOT run the CostGuard analyzer.
 *   - Do NOT call GitHub APIs (no comment posts).
 *   - Write a minimal record to github_webhook_inbox (best effort).
 *     If the inbox write also fails, log and return 202 with no side effects.
 *   - Return HTTP 202 (Accepted) — tells GitHub delivery was received;
 *     prevents retry storms and keeps our pipeline eventually consistent.
 *
 * EVENTUAL CONSISTENCY:
 *   - Recovery worker (POST /api/github/recover) drains the inbox.
 *   - "Latest SHA wins": inbox has unique(repo_full_name, pr_number), so
 *     upserts on conflict replace pr_head_sha with the most recent one.
 *     sha1 → sha2 → sha3 while degraded → only sha3 is ever processed.
 *   - Recovery uses existing github_pr_runs semantic idempotency to
 *     guarantee exactly-once processing per (repo, pr, sha) triple.
 *
 * CONFIGURATION (environment variables):
 *   DB_DEGRADED_MAX_MS   — ms before the DB probe is treated as timeout (default: 3000)
 *   RESILIENCE_MODE      — "fail-soft" (default) | "disabled"
 *                          Set to "disabled" to skip degraded-mode logic entirely.
 *   GITHUB_RECOVER_SECRET — if set, POST /api/github/recover requires
 *                           Authorization: Bearer <secret>
 */

// ─── Config ─────────────────────────────────────────────────────────────────

export const DB_DEGRADED_MAX_MS = parseInt(
  process.env.DB_DEGRADED_MAX_MS ?? "3000",
  10
);

export type ResilienceMode = "fail-soft" | "disabled";

export const RESILIENCE_MODE: ResilienceMode =
  (process.env.RESILIENCE_MODE as ResilienceMode) ?? "fail-soft";

export function isFailSoftEnabled(): boolean {
  return RESILIENCE_MODE === "fail-soft";
}

// ─── DB health probe ─────────────────────────────────────────────────────────

/**
 * Probe Supabase connectivity with a hard timeout.
 *
 * Makes a lightweight single-row SELECT against github_pr_runs.
 * Returns true = DB is healthy; false = DB is degraded.
 *
 * Always returns true if RESILIENCE_MODE=disabled.
 */
export async function probeDbHealth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any
): Promise<boolean> {
  if (!isFailSoftEnabled()) return true;

  const probePromise = admin
    .from("github_pr_runs")
    .select("id")
    .limit(1)
    .then(({ error }: { error: unknown }) => {
      if (error) throw error;
    });

  try {
    await Promise.race([
      probePromise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("db_probe_timeout")),
          DB_DEGRADED_MAX_MS
        )
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

// ─── Backoff ─────────────────────────────────────────────────────────────────

/**
 * Exponential backoff seconds for inbox retry.
 * attempts=0 → 30s, 1 → 60s, 2 → 120s, 3 → 240s, 4+ → 300s (cap).
 */
export function nextBackoffSeconds(attempts: number): number {
  return Math.min(30 * Math.pow(2, attempts), 300);
}

// ─── Inbox row type ──────────────────────────────────────────────────────────

export interface InboxRow {
  id: string;
  repo_full_name: string;
  pr_number: number;
  pr_head_sha: string;
  pr_node_id: string;
  delivery_id: string | null;
  received_at: string;
  status: "pending" | "processing" | "done" | "dead";
  last_error: string | null;
  attempts: number;
  next_attempt_at: string;
}
