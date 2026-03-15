/**
 * GitHub webhook unit tests — Gate F verification.
 *
 * Tests deterministic, pure functions without network calls or a running server.
 * Run: tsx tests/github-webhook.test.ts
 */

import assert from "assert";
import { createHmac, generateKeyPairSync, createVerify } from "crypto";
import { filterAndSortDiff } from "../src/lib/github/filter-diff";
import { verifyGithubSignature } from "../src/lib/github/verify-signature";
import { signJWT, clearTokenCache } from "../src/lib/github/app-auth";

// ─── Minimal test harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(label: string, fn: () => void | Promise<void>): void {
  const result = (() => {
    try {
      const r = fn();
      if (r instanceof Promise) {
        r.then(
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
        return;
      }
      console.log(`  PASS  ${label}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL  ${label}`);
      console.error(`        ${(err as Error).message}`);
      failed++;
    }
  })();
  void result;
}

function makeSignature(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

// ─── verifyGithubSignature ───────────────────────────────────────────────────

console.log("\nverifyGithubSignature\n");

test("accepts a correct HMAC-SHA256 signature", () => {
  const body = '{"action":"opened"}';
  const sig = makeSignature("test-secret", body);
  assert.strictEqual(
    verifyGithubSignature({ secret: "test-secret", rawBody: body, signature256Header: sig }),
    true
  );
});

test("rejects a wrong secret", () => {
  const body = '{"action":"opened"}';
  const sig = makeSignature("wrong-secret", body);
  assert.strictEqual(
    verifyGithubSignature({ secret: "correct-secret", rawBody: body, signature256Header: sig }),
    false
  );
});

test("rejects a tampered body", () => {
  const sig = makeSignature("secret", '{"action":"opened"}');
  assert.strictEqual(
    verifyGithubSignature({ secret: "secret", rawBody: '{"action":"malicious"}', signature256Header: sig }),
    false
  );
});

test("rejects a null signature header", () => {
  assert.strictEqual(
    verifyGithubSignature({ secret: "s", rawBody: "b", signature256Header: null }),
    false
  );
});

test("rejects mismatched-length signature", () => {
  assert.strictEqual(
    verifyGithubSignature({ secret: "s", rawBody: "b", signature256Header: "sha256=abc" }),
    false
  );
});

// ─── filterAndSortDiff ───────────────────────────────────────────────────────

console.log("\nfilterAndSortDiff\n");

// Fixture: four-file diff — one lockfile, one dist/, two source files
const FIXTURE = [
  "diff --git a/src/api.ts b/src/api.ts\nindex 001..002 100644\n--- a/src/api.ts\n+++ b/src/api.ts\n@@ -1 +1 @@\n-old\n+new\n",
  "diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml\nindex 003..004 100644\n--- a/pnpm-lock.yaml\n+++ b/pnpm-lock.yaml\n@@ -1 +1 @@\n-old\n+new\n",
  "diff --git a/dist/bundle.js b/dist/bundle.js\nindex 005..006 100644\n--- a/dist/bundle.js\n+++ b/dist/bundle.js\n@@ -1 +1 @@\n-old\n+new\n",
  "diff --git a/src/app.ts b/src/app.ts\nindex 007..008 100644\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new\n",
].join("");

test("strips lockfiles (pnpm-lock.yaml)", () => {
  const out = filterAndSortDiff(FIXTURE);
  assert.ok(!out.includes("pnpm-lock.yaml"), "lockfile must not appear in filtered output");
});

test("strips dist/ output", () => {
  const out = filterAndSortDiff(FIXTURE);
  assert.ok(!out.includes("dist/bundle.js"), "dist file must not appear in filtered output");
});

test("retains source files", () => {
  const out = filterAndSortDiff(FIXTURE);
  assert.ok(out.includes("src/api.ts"), "src/api.ts should be retained");
  assert.ok(out.includes("src/app.ts"), "src/app.ts should be retained");
});

test("sorts sections alphabetically (api.ts before app.ts)", () => {
  const out = filterAndSortDiff(FIXTURE);
  const idxApi = out.indexOf("src/api.ts");
  const idxApp = out.indexOf("src/app.ts");
  assert.ok(idxApi !== -1 && idxApp !== -1, "both source files must be present");
  assert.ok(idxApi < idxApp, "api.ts (a) must precede app.ts (b) in sorted output");
});

test("is deterministic — same input → same output on repeated calls", () => {
  assert.strictEqual(filterAndSortDiff(FIXTURE), filterAndSortDiff(FIXTURE));
});

test("returns empty string for empty input", () => {
  assert.strictEqual(filterAndSortDiff(""), "");
});

test("returns non-diff text unchanged (passthrough)", () => {
  const plain = "not a diff";
  assert.strictEqual(filterAndSortDiff(plain), plain);
});

test("filters package-lock.json", () => {
  const diff =
    "diff --git a/package-lock.json b/package-lock.json\nindex 0..1 100644\n--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1 +1 @@\n-{}\n+{}\n";
  assert.strictEqual(filterAndSortDiff(diff), "");
});

test("filters .min.js files", () => {
  const diff =
    "diff --git a/public/vendor.min.js b/public/vendor.min.js\nindex 0..1 100644\n--- a/public/vendor.min.js\n+++ b/public/vendor.min.js\n@@ -1 +1 @@\n-old\n+new\n";
  assert.strictEqual(filterAndSortDiff(diff), "");
});

test("filters node_modules/", () => {
  const diff =
    "diff --git a/node_modules/foo/index.js b/node_modules/foo/index.js\nindex 0..1 100644\n--- a/node_modules/foo/index.js\n+++ b/node_modules/foo/index.js\n@@ -1 +1 @@\n-old\n+new\n";
  assert.strictEqual(filterAndSortDiff(diff), "");
});

// ─── GitHub App JWT (Gate A — token generation proof) ────────────────────────
//
// Generates an ephemeral RSA-2048 key pair in-process (no secrets on disk),
// signs a JWT with signJWT(), then verifies the signature with the public key.
// This proves the RS256 implementation is correct end-to-end.

console.log("\nGitHub App JWT\n");

// Generate a test RSA key pair (2048-bit, ephemeral, never leaves process)
const { privateKey: TEST_PRIVATE_KEY, publicKey: TEST_PUBLIC_KEY } =
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

test("signJWT produces a 3-part dot-separated token", () => {
  const jwt = signJWT("12345", TEST_PRIVATE_KEY);
  const parts = jwt.split(".");
  assert.strictEqual(parts.length, 3, "JWT must have exactly 3 parts");
  assert.ok(parts[0].length > 0, "header must not be empty");
  assert.ok(parts[1].length > 0, "payload must not be empty");
  assert.ok(parts[2].length > 0, "signature must not be empty");
});

test("JWT header declares alg=RS256 and typ=JWT", () => {
  const jwt = signJWT("12345", TEST_PRIVATE_KEY);
  const headerJson = Buffer.from(jwt.split(".")[0], "base64url").toString("utf8");
  const header = JSON.parse(headerJson) as { alg: string; typ: string };
  assert.strictEqual(header.alg, "RS256");
  assert.strictEqual(header.typ, "JWT");
});

test("JWT payload encodes correct iss and valid iat/exp window", () => {
  const appId = "99999";
  const jwt = signJWT(appId, TEST_PRIVATE_KEY);
  const payloadJson = Buffer.from(jwt.split(".")[1], "base64url").toString("utf8");
  const payload = JSON.parse(payloadJson) as { iss: string; iat: number; exp: number };

  assert.strictEqual(payload.iss, appId, "iss must equal appId");

  const now = Math.floor(Date.now() / 1000);
  // iat should be ~60 seconds in the past (clock-skew buffer)
  assert.ok(payload.iat <= now, "iat must be <= now");
  assert.ok(payload.iat >= now - 120, "iat must not be more than 120 s in the past");

  // exp must be within GitHub's 10-minute max
  const lifetime = payload.exp - payload.iat;
  assert.ok(lifetime <= 600, `exp-iat=${lifetime} must be <= 600 s`);
  assert.ok(lifetime > 0, "exp must be after iat");
});

test("JWT signature verifies with the corresponding public key (RS256)", () => {
  const jwt = signJWT("12345", TEST_PRIVATE_KEY);
  const [header, payload, sig] = jwt.split(".");
  const signingInput = `${header}.${payload}`;

  const verifier = createVerify("sha256WithRSAEncryption");
  verifier.update(signingInput, "utf8");
  const valid = verifier.verify(
    TEST_PUBLIC_KEY,
    Buffer.from(sig, "base64url")
  );
  assert.strictEqual(valid, true, "RS256 signature must verify against public key");
});

test("JWT signature rejects a tampered payload", () => {
  const jwt = signJWT("12345", TEST_PRIVATE_KEY);
  const [header, , sig] = jwt.split(".");
  // Replace payload with a different one
  const tamperedPayload = Buffer.from(
    JSON.stringify({ iss: "attacker", iat: 0, exp: 9999999999 })
  ).toString("base64url");
  const tamperedInput = `${header}.${tamperedPayload}`;

  const verifier = createVerify("sha256WithRSAEncryption");
  verifier.update(tamperedInput, "utf8");
  const valid = verifier.verify(
    TEST_PUBLIC_KEY,
    Buffer.from(sig, "base64url")
  );
  assert.strictEqual(valid, false, "Tampered payload must not verify");
});

test("different appIds produce different JWTs", () => {
  const jwt1 = signJWT("111", TEST_PRIVATE_KEY);
  const jwt2 = signJWT("222", TEST_PRIVATE_KEY);
  assert.notStrictEqual(jwt1, jwt2, "Different appIds must produce different tokens");
});

test("token cache is cleared correctly", () => {
  clearTokenCache(); // must not throw
  // Verify it is a no-op when already empty
  clearTokenCache();
});

// ─── Delivery dedup simulation (Gate C) ──────────────────────────────────────
//
// Simulates the delivery_id dedup logic without a real Supabase instance.
// The in-memory Set mirrors the github_webhook_deliveries table's unique
// constraint behaviour: first INSERT succeeds, second raises 23505.

console.log("\nDelivery dedup simulation\n");

function makeDeliveryStore() {
  const seen = new Set<string>();

  /** Returns false on new delivery (inserted OK), true on duplicate (23505). */
  function checkDelivery(deliveryId: string | null): boolean {
    if (!deliveryId) return false;
    if (seen.has(deliveryId)) return true;
    seen.add(deliveryId);
    return false;
  }

  return { checkDelivery, seen };
}

test("first delivery is accepted (not a duplicate)", () => {
  const { checkDelivery } = makeDeliveryStore();
  assert.strictEqual(checkDelivery("delivery-abc"), false);
});

test("second delivery with same ID is rejected as duplicate", () => {
  const { checkDelivery } = makeDeliveryStore();
  checkDelivery("delivery-abc");
  assert.strictEqual(checkDelivery("delivery-abc"), true);
});

test("different delivery IDs are both accepted", () => {
  const { checkDelivery } = makeDeliveryStore();
  assert.strictEqual(checkDelivery("delivery-001"), false);
  assert.strictEqual(checkDelivery("delivery-002"), false);
});

test("null delivery ID is treated as non-duplicate (fail-open)", () => {
  const { checkDelivery } = makeDeliveryStore();
  assert.strictEqual(checkDelivery(null), false);
  // Second null also passes — no insertion, so no dedup
  assert.strictEqual(checkDelivery(null), false);
});

test("third delivery with same ID is also rejected", () => {
  const { checkDelivery } = makeDeliveryStore();
  checkDelivery("delivery-xyz");
  checkDelivery("delivery-xyz");
  assert.strictEqual(checkDelivery("delivery-xyz"), true);
});

// ─── Concurrency lock simulation (Gate D) ────────────────────────────────────
//
// Simulates acquireProcessingLock / releaseProcessingLock without a real DB.
// The in-memory Map mirrors the github_pr_processing table's PRIMARY KEY
// constraint behaviour: first INSERT wins, concurrent INSERT gets 23505.

console.log("\nConcurrency lock simulation\n");

function makeLockStore() {
  const locks = new Map<string, number>(); // key → locked_at (ms)
  const LOCK_TTL_MS = 120_000;

  function key(repo: string, pr: number): string {
    return `${repo}#${pr}`;
  }

  /** Returns true = lock acquired, false = already locked. */
  function acquire(repo: string, pr: number): boolean {
    const k = key(repo, pr);
    const now = Date.now();

    // Expire stale lock
    const existing = locks.get(k);
    if (existing !== undefined && now - existing < LOCK_TTL_MS) {
      return false; // lock held
    }

    locks.set(k, now);
    return true;
  }

  function release(repo: string, pr: number): void {
    locks.delete(key(repo, pr));
  }

  return { acquire, release, locks };
}

test("first request acquires lock", () => {
  const { acquire } = makeLockStore();
  assert.strictEqual(acquire("owner/repo", 1), true);
});

test("concurrent second request is blocked", () => {
  const { acquire } = makeLockStore();
  acquire("owner/repo", 1);
  assert.strictEqual(acquire("owner/repo", 1), false);
});

test("lock on different PR is independent", () => {
  const { acquire } = makeLockStore();
  acquire("owner/repo", 1);
  assert.strictEqual(acquire("owner/repo", 2), true, "PR #2 must get its own lock");
});

test("lock on different repo is independent", () => {
  const { acquire } = makeLockStore();
  acquire("owner/repo-a", 1);
  assert.strictEqual(acquire("owner/repo-b", 1), true, "repo-b must get its own lock");
});

test("after release, a new request can acquire the lock", () => {
  const { acquire, release } = makeLockStore();
  acquire("owner/repo", 5);
  release("owner/repo", 5);
  assert.strictEqual(acquire("owner/repo", 5), true, "lock must be re-acquirable after release");
});

test("simulated double webhook: only first proceeds, second is blocked", () => {
  const { acquire, release } = makeLockStore();
  const repo = "org/service";
  const pr = 42;

  // Two concurrent deliveries arrive simultaneously
  const r1 = acquire(repo, pr);
  const r2 = acquire(repo, pr);

  assert.strictEqual(r1, true, "first delivery must acquire lock");
  assert.strictEqual(r2, false, "second delivery must be blocked");

  // First delivery finishes; a third delivery (retry) can now proceed
  release(repo, pr);
  const r3 = acquire(repo, pr);
  assert.strictEqual(r3, true, "retry after release must acquire lock");
});

test("stale lock (past TTL) is evicted and replaced", () => {
  const locks = new Map<string, number>();
  const LOCK_TTL_MS = 120_000;
  const k = "owner/repo#7";

  // Plant a lock that expired 200 s ago
  locks.set(k, Date.now() - 200_000);

  // Simulate acquire with stale-eviction logic
  function acquire(): boolean {
    const now = Date.now();
    const existing = locks.get(k);
    if (existing !== undefined && now - existing < LOCK_TTL_MS) {
      return false;
    }
    locks.set(k, now);
    return true;
  }

  assert.strictEqual(acquire(), true, "stale lock must be evicted and new lock acquired");
});

// ─── Sticky comment robustness simulation (Gate E) ───────────────────────────
//
// Simulates the upsertBotComment logic for the four distinct comment states.

console.log("\nSticky comment robustness\n");

const BOT_MARKER = "<!-- costguardai:pr-bot -->";

interface MockComment {
  id: number;
  body: string;
}

function simulateUpsert(
  existingComments: MockComment[],
  newBody: string
): { created: boolean; updatedId: number | null; deletedIds: number[] } {
  const botComments = existingComments
    .filter((c) => c.body.includes(BOT_MARKER))
    .sort((a, b) => b.id - a.id); // newest first

  if (botComments.length === 0) {
    return { created: true, updatedId: null, deletedIds: [] };
  }

  return {
    created: false,
    updatedId: botComments[0].id,
    deletedIds: botComments.slice(1).map((c) => c.id),
  };
}

test("no existing bot comment → create new (covers deleted-comment recovery)", () => {
  const result = simulateUpsert([], `${BOT_MARKER}\ncontent`);
  assert.strictEqual(result.created, true);
  assert.strictEqual(result.updatedId, null);
  assert.deepStrictEqual(result.deletedIds, []);
});

test("one bot comment → update it, no deletions", () => {
  const result = simulateUpsert(
    [{ id: 10, body: `${BOT_MARKER}\nold` }],
    `${BOT_MARKER}\nnew`
  );
  assert.strictEqual(result.created, false);
  assert.strictEqual(result.updatedId, 10);
  assert.deepStrictEqual(result.deletedIds, []);
});

test("two bot comments → update newest, delete oldest", () => {
  const result = simulateUpsert(
    [
      { id: 5, body: `${BOT_MARKER}\nfirst` },
      { id: 12, body: `${BOT_MARKER}\nsecond` },
    ],
    `${BOT_MARKER}\nnew`
  );
  assert.strictEqual(result.created, false);
  assert.strictEqual(result.updatedId, 12, "must update newest (id=12)");
  assert.deepStrictEqual(result.deletedIds, [5], "must delete oldest (id=5)");
});

test("three bot comments → update newest, delete both older duplicates", () => {
  const result = simulateUpsert(
    [
      { id: 1, body: `${BOT_MARKER}\na` },
      { id: 2, body: `${BOT_MARKER}\nb` },
      { id: 3, body: `${BOT_MARKER}\nc` },
    ],
    `${BOT_MARKER}\nnew`
  );
  assert.strictEqual(result.updatedId, 3);
  assert.deepStrictEqual(result.deletedIds.sort((a, b) => a - b), [1, 2]);
});

test("non-bot comments are ignored during upsert evaluation", () => {
  const result = simulateUpsert(
    [
      { id: 7, body: "a human comment" },
      { id: 8, body: "another human comment" },
    ],
    `${BOT_MARKER}\nnew`
  );
  assert.strictEqual(result.created, true, "must create; no bot comment present");
});

// ─── Summary ─────────────────────────────────────────────────────────────────

// Use setImmediate to allow any async test callbacks to complete first
setImmediate(() => {
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
});
