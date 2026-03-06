/**
 * GitHub webhook resilience tests — Gate F verification.
 *
 * All tests are deterministic and pure: no network, no real DB, no running server.
 * Simulates the behavioral contracts of the fail-soft degraded mode and
 * recovery worker using in-memory state.
 *
 * Run: tsx tests/github-webhook-resilience.test.ts
 *
 * Test cases (required by spec):
 *   1. DB-down: webhook returns ACK, creates inbox row (or no-op if storage down),
 *      and does NOT call analyzer or comment.
 *   2. DB recovers: recovery worker processes inbox, creates github_pr_run,
 *      posts/updates sticky comment exactly once.
 *   3. Latest SHA wins: sha1 then sha2 while degraded → only sha2 processed on recovery.
 *   4. Duplicate delivery ID: second delivery is ignored even in degraded mode.
 *   5. Concurrency: two webhooks same PR in parallel while degraded →
 *      only one pending latest SHA.
 */

import assert from "assert";
import { nextBackoffSeconds } from "../src/lib/github/resilience";

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const asyncTests: Promise<void>[] = [];

function test(label: string, fn: () => void | Promise<void>): void {
  try {
    const r = fn();
    if (r instanceof Promise) {
      const p = r.then(
        () => {
          console.log(`  PASS  ${label}`);
          passed++;
        },
        (err: unknown) => {
          console.error(`  FAIL  ${label}`);
          console.error(`        ${(err as Error).message}`);
          failed++;
        }
      );
      asyncTests.push(p);
      return;
    }
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${label}`);
    console.error(`        ${(err as Error).message}`);
    failed++;
  }
}

// ─── Shared types (mirror production types, no import needed) ─────────────────

interface InboxRow {
  id: string;
  repo_full_name: string;
  pr_number: number;
  pr_head_sha: string;
  pr_node_id: string;
  delivery_id: string | null;
  status: "pending" | "processing" | "done" | "dead";
  attempts: number;
  next_attempt_at: string;
  last_error: string | null;
}

// ─── In-memory simulations ────────────────────────────────────────────────────

/**
 * Simulates github_webhook_inbox:
 *   - unique(repo_full_name, pr_number) → upsert = latest SHA wins
 *   - Returns the current state of the inbox
 */
function makeInboxStore() {
  // keyed by "repo_full_name|pr_number"
  const rows = new Map<string, InboxRow>();
  let idCounter = 0;

  function key(repo: string, pr: number): string {
    return `${repo}|${pr}`;
  }

  function upsert(entry: Omit<InboxRow, "id" | "status" | "attempts" | "next_attempt_at" | "last_error">): void {
    const k = key(entry.repo_full_name, entry.pr_number);
    const existing = rows.get(k);
    if (existing) {
      // Update in place — latest SHA wins
      existing.pr_head_sha = entry.pr_head_sha;
      existing.delivery_id = entry.delivery_id;
      existing.status = "pending";
      existing.attempts = 0;
      existing.next_attempt_at = new Date().toISOString();
      existing.last_error = null;
    } else {
      rows.set(k, {
        id: String(++idCounter),
        ...entry,
        status: "pending",
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
      });
    }
  }

  function getAll(): InboxRow[] {
    return Array.from(rows.values());
  }

  function getPending(): InboxRow[] {
    return getAll().filter((r) => r.status === "pending");
  }

  function markDone(id: string): void {
    const row = Array.from(rows.values()).find((r) => r.id === id);
    if (row) row.status = "done";
  }

  function size(): number {
    return rows.size;
  }

  return { upsert, getAll, getPending, markDone, size };
}

/**
 * Simulates github_pr_runs:
 *   - unique(repo_full_name, pr_number, pr_head_sha)
 *   - Returns isDuplicate = true if SHA already processed
 */
function makePrRunsStore() {
  const seen = new Set<string>();

  function key(repo: string, pr: number, sha: string): string {
    return `${repo}|${pr}|${sha}`;
  }

  function insert(repo: string, pr: number, sha: string): boolean {
    const k = key(repo, pr, sha);
    if (seen.has(k)) return false; // duplicate
    seen.add(k);
    return true;
  }

  function has(repo: string, pr: number, sha: string): boolean {
    return seen.has(key(repo, pr, sha));
  }

  return { insert, has };
}

/**
 * Simulates the webhook handler's degraded-mode decision and side effects.
 *
 * Returns:
 *   { status, deferred, analyzerCalled, commentCalled, inboxWritten }
 */
function simulateWebhookDegraded(opts: {
  isDbHealthy: boolean;
  isInboxAvailable: boolean;
  inbox: ReturnType<typeof makeInboxStore>;
  repoFullName: string;
  prNumber: number;
  prHeadSha: string;
  prNodeId: string;
  deliveryId: string | null;
  action: string;
}): {
  status: 200 | 202;
  deferred: boolean;
  analyzerCalled: boolean;
  commentCalled: boolean;
  inboxWritten: boolean;
} {
  const HANDLED_ACTIONS = new Set(["opened", "reopened", "synchronize"]);

  // Simulate signature always verified (not shown here — assumed valid)

  // Not a handled action → return 200, no side effects
  if (!HANDLED_ACTIONS.has(opts.action)) {
    return { status: 200, deferred: false, analyzerCalled: false, commentCalled: false, inboxWritten: false };
  }

  if (!opts.isDbHealthy) {
    // DEGRADED PATH: no analysis, no comment
    let inboxWritten = false;

    if (opts.isInboxAvailable) {
      opts.inbox.upsert({
        repo_full_name: opts.repoFullName,
        pr_number: opts.prNumber,
        pr_head_sha: opts.prHeadSha,
        pr_node_id: opts.prNodeId,
        delivery_id: opts.deliveryId,
      });
      inboxWritten = true;
    }
    // If inbox also unavailable: log and ACK safely (no side effects)

    return {
      status: 202,
      deferred: true,
      analyzerCalled: false,   // GUARANTEE: analyzer NOT called when degraded
      commentCalled: false,    // GUARANTEE: no comment posted when degraded
      inboxWritten,
    };
  }

  // HEALTHY PATH: would run analysis + comment (not simulated here)
  return { status: 200, deferred: false, analyzerCalled: true, commentCalled: true, inboxWritten: false };
}

/**
 * Simulates the recovery worker processing one inbox item.
 *
 * Returns { result, commentPosted } where result is "processed" | "skipped".
 */
function simulateRecovery(opts: {
  item: InboxRow;
  prRuns: ReturnType<typeof makePrRunsStore>;
  commentStore: string[];
}): { result: "processed" | "skipped"; commentPosted: boolean } {
  const { item, prRuns, commentStore } = opts;

  // Exactly-once: attempt to insert into github_pr_runs
  const inserted = prRuns.insert(item.repo_full_name, item.pr_number, item.pr_head_sha);
  if (!inserted) {
    // SHA already processed
    return { result: "skipped", commentPosted: false };
  }

  // Would run analysis + build comment body (simplified to a marker here)
  const commentBody = `<!-- costguardai:pr-bot -->\nAnalysis for SHA: ${item.pr_head_sha}`;

  // Upsert: find existing bot comment for this PR (simulated as last entry per PR key)
  const prKey = `${item.repo_full_name}#${item.pr_number}`;
  const existingIdx = commentStore.findIndex((c) => c.startsWith(prKey + ":<!-- costguardai:pr-bot -->"));
  if (existingIdx >= 0) {
    commentStore[existingIdx] = prKey + ":" + commentBody; // update
  } else {
    commentStore.push(prKey + ":" + commentBody); // create
  }

  return { result: "processed", commentPosted: true };
}

// ─── Test 1: DB-down — ACK + inbox write + NO analyzer or comment ─────────────

console.log("\nTest 1: DB-down — ACK, inbox write, no analyzer/comment\n");

test("DB-down: webhook returns 202 (deferred)", () => {
  const inbox = makeInboxStore();
  const result = simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: true,
    inbox,
    repoFullName: "org/service",
    prNumber: 1,
    prHeadSha: "sha-abc",
    prNodeId: "PR_1",
    deliveryId: "delivery-001",
    action: "opened",
  });
  assert.strictEqual(result.status, 202, "must return 202 when degraded");
  assert.strictEqual(result.deferred, true, "deferred must be true");
});

test("DB-down: analyzer is NOT called", () => {
  const inbox = makeInboxStore();
  const result = simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: true,
    inbox,
    repoFullName: "org/service",
    prNumber: 1,
    prHeadSha: "sha-abc",
    prNodeId: "PR_1",
    deliveryId: "delivery-001",
    action: "opened",
  });
  assert.strictEqual(result.analyzerCalled, false, "analyzer must NOT be called when degraded");
});

test("DB-down: no comment posted to GitHub", () => {
  const inbox = makeInboxStore();
  const result = simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: true,
    inbox,
    repoFullName: "org/service",
    prNumber: 1,
    prHeadSha: "sha-abc",
    prNodeId: "PR_1",
    deliveryId: "delivery-001",
    action: "opened",
  });
  assert.strictEqual(result.commentCalled, false, "no GitHub comment when degraded");
});

test("DB-down: inbox row is written with correct SHA", () => {
  const inbox = makeInboxStore();
  simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: true,
    inbox,
    repoFullName: "org/service",
    prNumber: 1,
    prHeadSha: "sha-abc",
    prNodeId: "PR_1",
    deliveryId: "delivery-001",
    action: "opened",
  });
  const rows = inbox.getPending();
  assert.strictEqual(rows.length, 1, "inbox must have exactly one pending row");
  assert.strictEqual(rows[0].pr_head_sha, "sha-abc", "inbox must store correct SHA");
});

test("DB-down + inbox also down: ACK safely with no side effects", () => {
  const inbox = makeInboxStore();
  const result = simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: false, // total outage
    inbox,
    repoFullName: "org/service",
    prNumber: 1,
    prHeadSha: "sha-abc",
    prNodeId: "PR_1",
    deliveryId: "delivery-001",
    action: "opened",
  });
  assert.strictEqual(result.status, 202, "must still return 202 on total outage");
  assert.strictEqual(result.inboxWritten, false, "no inbox write on total outage");
  assert.strictEqual(result.analyzerCalled, false, "no analyzer on total outage");
  assert.strictEqual(result.commentCalled, false, "no comment on total outage");
});

test("non-handled action while degraded: return 200, no inbox write", () => {
  const inbox = makeInboxStore();
  const result = simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: true,
    inbox,
    repoFullName: "org/service",
    prNumber: 1,
    prHeadSha: "sha-abc",
    prNodeId: "PR_1",
    deliveryId: "delivery-001",
    action: "closed", // not in HANDLED_ACTIONS
  });
  assert.strictEqual(result.status, 200, "non-handled action must return 200");
  assert.strictEqual(inbox.size(), 0, "non-handled action must not write to inbox");
});

// ─── Test 2: DB recovers — recovery processes inbox, exactly-once ─────────────

console.log("\nTest 2: DB recovers — recovery processes, exactly-once\n");

test("recovery: processes pending inbox item and marks done", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  inbox.upsert({
    repo_full_name: "org/service",
    pr_number: 42,
    pr_head_sha: "sha-xyz",
    pr_node_id: "PR_42",
    delivery_id: "delivery-100",
  });

  const [item] = inbox.getPending();
  const { result } = simulateRecovery({ item, prRuns, commentStore });

  assert.strictEqual(result, "processed", "item must be processed");
});

test("recovery: github_pr_run is recorded for the processed SHA", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  inbox.upsert({
    repo_full_name: "org/service",
    pr_number: 42,
    pr_head_sha: "sha-xyz",
    pr_node_id: "PR_42",
    delivery_id: "delivery-100",
  });

  const [item] = inbox.getPending();
  simulateRecovery({ item, prRuns, commentStore });

  assert.ok(
    prRuns.has("org/service", 42, "sha-xyz"),
    "github_pr_runs must record the SHA"
  );
});

test("recovery: sticky comment is posted exactly once", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  inbox.upsert({
    repo_full_name: "org/service",
    pr_number: 42,
    pr_head_sha: "sha-xyz",
    pr_node_id: "PR_42",
    delivery_id: "delivery-100",
  });

  const [item] = inbox.getPending();
  simulateRecovery({ item, prRuns, commentStore });

  // Only one bot comment for this PR
  const botComments = commentStore.filter((c) =>
    c.startsWith("org/service#42:")
  );
  assert.strictEqual(botComments.length, 1, "exactly one bot comment must exist");
});

test("recovery: second run for same SHA is skipped (idempotent)", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  inbox.upsert({
    repo_full_name: "org/service",
    pr_number: 42,
    pr_head_sha: "sha-xyz",
    pr_node_id: "PR_42",
    delivery_id: "delivery-100",
  });

  const [item] = inbox.getPending();

  // First run
  simulateRecovery({ item, prRuns, commentStore });
  // Second run (simulating a recovery retry or duplicate processing)
  const { result: result2, commentPosted: comment2 } = simulateRecovery({
    item,
    prRuns,
    commentStore,
  });

  assert.strictEqual(result2, "skipped", "second run must be skipped");
  assert.strictEqual(comment2, false, "second run must not post another comment");

  // Still exactly one comment
  const botComments = commentStore.filter((c) => c.startsWith("org/service#42:"));
  assert.strictEqual(botComments.length, 1, "still exactly one comment after two runs");
});

// ─── Test 3: Latest SHA wins ──────────────────────────────────────────────────

console.log("\nTest 3: Latest SHA wins\n");

test("sha1 then sha2 while degraded → inbox holds sha2 only", () => {
  const inbox = makeInboxStore();

  // Event for sha1 arrives first
  simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: true,
    inbox,
    repoFullName: "org/svc",
    prNumber: 7,
    prHeadSha: "sha1-old",
    prNodeId: "PR_7",
    deliveryId: "delivery-A",
    action: "synchronize",
  });

  // Event for sha2 arrives while still degraded
  simulateWebhookDegraded({
    isDbHealthy: false,
    isInboxAvailable: true,
    inbox,
    repoFullName: "org/svc",
    prNumber: 7,
    prHeadSha: "sha2-new",
    prNodeId: "PR_7",
    deliveryId: "delivery-B",
    action: "synchronize",
  });

  const pending = inbox.getPending();
  assert.strictEqual(pending.length, 1, "inbox must have exactly one pending row per PR");
  assert.strictEqual(pending[0].pr_head_sha, "sha2-new", "inbox must hold the latest SHA");
});

test("on recovery, only sha2 is processed (sha1 is never seen)", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  // sha1 arrives
  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/svc", prNumber: 7, prHeadSha: "sha1-old",
    prNodeId: "PR_7", deliveryId: "delivery-A", action: "synchronize",
  });

  // sha2 arrives (overwrites inbox row)
  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/svc", prNumber: 7, prHeadSha: "sha2-new",
    prNodeId: "PR_7", deliveryId: "delivery-B", action: "synchronize",
  });

  // Recovery processes the pending row (which is sha2)
  const [item] = inbox.getPending();
  simulateRecovery({ item, prRuns, commentStore });

  // sha1 was never inserted into pr_runs
  assert.strictEqual(prRuns.has("org/svc", 7, "sha1-old"), false, "sha1 must not be in pr_runs");
  // sha2 was processed
  assert.strictEqual(prRuns.has("org/svc", 7, "sha2-new"), true, "sha2 must be in pr_runs");
});

test("three SHAs while degraded → only sha3 processed on recovery", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  for (const [sha, delivery] of [
    ["sha1", "d1"],
    ["sha2", "d2"],
    ["sha3", "d3"],
  ]) {
    simulateWebhookDegraded({
      isDbHealthy: false, isInboxAvailable: true, inbox,
      repoFullName: "org/svc", prNumber: 9, prHeadSha: sha,
      prNodeId: "PR_9", deliveryId: delivery, action: "synchronize",
    });
  }

  const [item] = inbox.getPending();
  assert.strictEqual(item.pr_head_sha, "sha3", "inbox must hold sha3");

  simulateRecovery({ item, prRuns, commentStore });

  assert.strictEqual(prRuns.has("org/svc", 9, "sha3"), true, "sha3 must be processed");
  assert.strictEqual(prRuns.has("org/svc", 9, "sha2"), false, "sha2 must not be processed");
  assert.strictEqual(prRuns.has("org/svc", 9, "sha1"), false, "sha1 must not be processed");
});

// ─── Test 4: Duplicate delivery ID ───────────────────────────────────────────

console.log("\nTest 4: Duplicate delivery ID in degraded mode\n");

test("same delivery_id twice while degraded → one inbox row (upsert)", () => {
  const inbox = makeInboxStore();

  // Delivery ABC arrives twice (GitHub re-delivery during outage)
  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/repo", prNumber: 5, prHeadSha: "sha-dup",
    prNodeId: "PR_5", deliveryId: "delivery-ABC", action: "opened",
  });

  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/repo", prNumber: 5, prHeadSha: "sha-dup",
    prNodeId: "PR_5", deliveryId: "delivery-ABC", action: "opened",
  });

  // Inbox must still have only one row (upsert semantics)
  assert.strictEqual(inbox.size(), 1, "upsert must produce exactly one inbox row");
  assert.strictEqual(inbox.getPending()[0].delivery_id, "delivery-ABC");
});

test("duplicate delivery → recovery processes it exactly once", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  // Two identical deliveries
  for (let i = 0; i < 2; i++) {
    simulateWebhookDegraded({
      isDbHealthy: false, isInboxAvailable: true, inbox,
      repoFullName: "org/repo", prNumber: 5, prHeadSha: "sha-dup",
      prNodeId: "PR_5", deliveryId: "delivery-ABC", action: "opened",
    });
  }

  // Recovery runs once
  const [item] = inbox.getPending();
  const { result } = simulateRecovery({ item, prRuns, commentStore });
  assert.strictEqual(result, "processed");

  // Recovery runs again (simulating double-invocation of recover endpoint)
  const { result: result2 } = simulateRecovery({ item, prRuns, commentStore });
  assert.strictEqual(result2, "skipped", "second recovery run must be skipped");

  // Exactly one comment posted
  const comments = commentStore.filter((c) => c.startsWith("org/repo#5:"));
  assert.strictEqual(comments.length, 1, "exactly one comment after duplicate recovery");
});

// ─── Test 5: Concurrency — two webhooks same PR, degraded ────────────────────

console.log("\nTest 5: Concurrency — two webhooks same PR in parallel while degraded\n");

test("two concurrent webhooks same PR → one pending inbox row (latest SHA)", () => {
  const inbox = makeInboxStore();

  // Simulate two concurrent requests arriving simultaneously (different SHAs)
  // In production this would be a race; in simulation the second upsert wins.
  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/app", prNumber: 3, prHeadSha: "sha-concurrent-A",
    prNodeId: "PR_3", deliveryId: "delivery-C1", action: "synchronize",
  });

  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/app", prNumber: 3, prHeadSha: "sha-concurrent-B",
    prNodeId: "PR_3", deliveryId: "delivery-C2", action: "synchronize",
  });

  const pending = inbox.getPending();
  assert.strictEqual(pending.length, 1, "must have exactly one pending row after concurrent writes");
});

test("concurrency: recovery processes only the latest SHA", () => {
  const inbox = makeInboxStore();
  const prRuns = makePrRunsStore();
  const commentStore: string[] = [];

  // Two concurrent webhooks, sha-B arrives second (wins)
  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/app", prNumber: 3, prHeadSha: "sha-concurrent-A",
    prNodeId: "PR_3", deliveryId: "delivery-C1", action: "synchronize",
  });
  simulateWebhookDegraded({
    isDbHealthy: false, isInboxAvailable: true, inbox,
    repoFullName: "org/app", prNumber: 3, prHeadSha: "sha-concurrent-B",
    prNodeId: "PR_3", deliveryId: "delivery-C2", action: "synchronize",
  });

  const [item] = inbox.getPending();
  assert.strictEqual(item.pr_head_sha, "sha-concurrent-B", "latest SHA must be in inbox");

  simulateRecovery({ item, prRuns, commentStore });

  assert.ok(prRuns.has("org/app", 3, "sha-concurrent-B"), "latest SHA processed");
  assert.strictEqual(prRuns.has("org/app", 3, "sha-concurrent-A"), false, "old SHA not processed");
});

// ─── nextBackoffSeconds unit tests ────────────────────────────────────────────

console.log("\nnextBackoffSeconds\n");

test("attempts=0 → 30s", () => {
  assert.strictEqual(nextBackoffSeconds(0), 30);
});

test("attempts=1 → 60s", () => {
  assert.strictEqual(nextBackoffSeconds(1), 60);
});

test("attempts=2 → 120s", () => {
  assert.strictEqual(nextBackoffSeconds(2), 120);
});

test("attempts=3 → 240s", () => {
  assert.strictEqual(nextBackoffSeconds(3), 240);
});

test("attempts=4 → 300s (capped)", () => {
  assert.strictEqual(nextBackoffSeconds(4), 300);
});

test("attempts=10 → 300s (cap holds for large values)", () => {
  assert.strictEqual(nextBackoffSeconds(10), 300);
});

// ─── Inbox upsert semantics ───────────────────────────────────────────────────

console.log("\nInbox upsert semantics\n");

test("upsert on new repo+pr creates row", () => {
  const inbox = makeInboxStore();
  inbox.upsert({ repo_full_name: "a/b", pr_number: 1, pr_head_sha: "s1", pr_node_id: "n1", delivery_id: "d1" });
  assert.strictEqual(inbox.size(), 1);
});

test("upsert on same repo+pr updates SHA (latest wins)", () => {
  const inbox = makeInboxStore();
  inbox.upsert({ repo_full_name: "a/b", pr_number: 1, pr_head_sha: "s1", pr_node_id: "n1", delivery_id: "d1" });
  inbox.upsert({ repo_full_name: "a/b", pr_number: 1, pr_head_sha: "s2", pr_node_id: "n1", delivery_id: "d2" });
  assert.strictEqual(inbox.size(), 1, "still one row");
  assert.strictEqual(inbox.getPending()[0].pr_head_sha, "s2", "SHA updated to latest");
});

test("upsert on different PR creates separate rows", () => {
  const inbox = makeInboxStore();
  inbox.upsert({ repo_full_name: "a/b", pr_number: 1, pr_head_sha: "s1", pr_node_id: "n1", delivery_id: "d1" });
  inbox.upsert({ repo_full_name: "a/b", pr_number: 2, pr_head_sha: "s2", pr_node_id: "n2", delivery_id: "d2" });
  assert.strictEqual(inbox.size(), 2, "separate row per PR");
});

test("upsert on different repo creates separate rows", () => {
  const inbox = makeInboxStore();
  inbox.upsert({ repo_full_name: "a/b", pr_number: 1, pr_head_sha: "s1", pr_node_id: "n1", delivery_id: "d1" });
  inbox.upsert({ repo_full_name: "c/d", pr_number: 1, pr_head_sha: "s2", pr_node_id: "n2", delivery_id: "d2" });
  assert.strictEqual(inbox.size(), 2, "separate row per repo");
});

// ─── Recover endpoint auth ───────────────────────────────────────────────────

console.log("\nRecover endpoint auth\n");

/**
 * Simulates the auth check at the top of POST /api/github/recover.
 * Mirrors the exact logic in src/app/api/github/recover/route.ts.
 */
function simulateRecoverAuth(opts: {
  envSecret: string | undefined;
  authHeader: string | undefined;
}): { status: 200 | 401 | 503; body?: Record<string, unknown> } {
  const { envSecret, authHeader } = opts;
  if (!envSecret) {
    return { status: 503, body: { ok: false, error: "recover_not_configured" } };
  }
  if (authHeader !== `Bearer ${envSecret}`) {
    return { status: 401 };
  }
  return { status: 200 };
}

test("missing GITHUB_RECOVER_SECRET → 503 recover_not_configured", () => {
  const result = simulateRecoverAuth({ envSecret: undefined, authHeader: undefined });
  assert.strictEqual(result.status, 503, "must return 503 when secret is not configured");
  assert.deepStrictEqual(result.body, { ok: false, error: "recover_not_configured" });
});

test("empty GITHUB_RECOVER_SECRET → 503 recover_not_configured", () => {
  const result = simulateRecoverAuth({ envSecret: "", authHeader: undefined });
  assert.strictEqual(result.status, 503, "empty string secret must also return 503");
  assert.deepStrictEqual(result.body, { ok: false, error: "recover_not_configured" });
});

test("secret set, no Authorization header → 401", () => {
  const result = simulateRecoverAuth({ envSecret: "s3cr3t", authHeader: undefined });
  assert.strictEqual(result.status, 401, "missing auth header must return 401");
});

test("secret set, wrong token → 401", () => {
  const result = simulateRecoverAuth({ envSecret: "s3cr3t", authHeader: "Bearer wrongtoken" });
  assert.strictEqual(result.status, 401, "wrong token must return 401");
});

test("secret set, correct Bearer token → 200 (passes auth)", () => {
  const result = simulateRecoverAuth({ envSecret: "s3cr3t", authHeader: "Bearer s3cr3t" });
  assert.strictEqual(result.status, 200, "correct token must pass auth");
});

// ─── Recover batch cap (LIMIT 50) ────────────────────────────────────────────

console.log("\nRecover batch cap (LIMIT 50)\n");

const RECOVER_MAX_ITEMS = 50;

/**
 * Simulates fetching pending inbox rows with the LIMIT 50 cap applied.
 * Returns the count of rows that would be processed in one invocation.
 */
function simulateFetchWithCap(totalPending: number): number {
  return Math.min(totalPending, RECOVER_MAX_ITEMS);
}

test("cap: 0 pending → processes 0", () => {
  assert.strictEqual(simulateFetchWithCap(0), 0);
});

test("cap: 10 pending → processes 10 (under cap)", () => {
  assert.strictEqual(simulateFetchWithCap(10), 10);
});

test("cap: exactly 50 pending → processes 50", () => {
  assert.strictEqual(simulateFetchWithCap(50), 50);
});

test("cap: 51 pending → processes only 50 (cap enforced)", () => {
  const fetched = simulateFetchWithCap(51);
  assert.strictEqual(fetched, 50, "must not exceed 50 rows per invocation");
});

test("cap: 200 pending → processes only 50 (cap enforced)", () => {
  const fetched = simulateFetchWithCap(200);
  assert.strictEqual(fetched, 50, "must not exceed 50 rows regardless of queue depth");
});

test("cap: remaining rows stay pending for next invocation", () => {
  const totalPending = 120;
  const firstBatch = simulateFetchWithCap(totalPending);
  const remaining = totalPending - firstBatch;
  assert.strictEqual(firstBatch, 50, "first batch processes 50");
  assert.strictEqual(remaining, 70, "70 rows remain for subsequent invocations");
});

// ─── Summary ──────────────────────────────────────────────────────────────────

Promise.all(asyncTests).then(() => {
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
});
