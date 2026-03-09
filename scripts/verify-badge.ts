/**
 * CostGuardAI — Badge Endpoint Verification
 *
 * Verifies that the /api/badge/{reportId} endpoint:
 *   - Returns HTTP 200
 *   - Serves Content-Type: image/svg+xml
 *   - Returns a non-empty SVG body
 *
 * Usage:
 *   pnpm tsx scripts/verify-badge.ts [baseUrl] [reportId]
 *
 * Defaults:
 *   baseUrl  = http://localhost:3000
 *   reportId = test-badge-id
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *   2 — runtime error (fetch failed, bad URL, etc.)
 */

const BASE_URL = process.argv[2] ?? "http://localhost:3000";
const REPORT_ID = process.argv[3] ?? "test-badge-id";
const STYLE = "score";

interface CheckResult {
  name: string;
  passed: boolean;
  actual?: string;
  expected?: string;
}

async function verifyBadge(): Promise<void> {
  const url = `${BASE_URL}/api/badge/${REPORT_ID}?style=${STYLE}`;

  console.log("\nCostGuardAI — Badge Verification");
  console.log("─".repeat(60));
  console.log(`\nTarget: ${url}\n`);

  let res: Response;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    console.error(`[ERROR] Could not reach ${url}: ${err}`);
    console.error("Ensure the dev server is running at the specified base URL.\n");
    process.exit(2);
  }

  const body = await res.text();
  const contentType = res.headers.get("content-type") ?? "";

  const checks: CheckResult[] = [
    {
      name: "HTTP 200 status",
      passed: res.status === 200,
      actual: String(res.status),
      expected: "200",
    },
    {
      name: "Content-Type: image/svg+xml",
      passed: contentType.includes("image/svg+xml"),
      actual: contentType,
      expected: "image/svg+xml",
    },
    {
      name: "Non-empty SVG body",
      passed: body.trim().length > 0 && body.includes("<svg"),
      actual: body.trim().length > 0 ? `${body.trim().slice(0, 40)}…` : "(empty)",
      expected: "<svg …>",
    },
    {
      name: "Cache-Control header present",
      passed: (res.headers.get("cache-control") ?? "").length > 0,
      actual: res.headers.get("cache-control") ?? "(missing)",
      expected: "public, max-age=…",
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    const icon = check.passed ? "PASS" : "FAIL";
    console.log(`  [${icon}] ${check.name}`);
    if (!check.passed) {
      console.log(`         expected: ${check.expected}`);
      console.log(`         actual:   ${check.actual}`);
      allPassed = false;
    }
  }

  console.log("\n─".repeat(60));
  if (allPassed) {
    console.log("\nBadge endpoint verified. SVG renders correctly.\n");
    process.exit(0);
  } else {
    console.log("\nOne or more badge checks failed.\n");
    process.exit(1);
  }
}

verifyBadge().catch((err) => {
  console.error("Badge verification crashed:", err);
  process.exit(2);
});
