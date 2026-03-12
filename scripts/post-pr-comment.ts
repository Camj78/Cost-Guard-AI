/**
 * Post (or update) a CostGuard analysis comment on a GitHub pull request.
 *
 * Usage:
 *   tsx scripts/post-pr-comment.ts [costguard-result.json]
 *
 * If no file argument is given, reads JSON from stdin.
 *
 * Required env vars:
 *   GITHUB_TOKEN        — GitHub token with pull-requests:write permission
 *   GITHUB_REPOSITORY   — owner/repo  (e.g. "acme/api-service")
 *   PR_NUMBER           — pull request number
 *
 * Exit codes:
 *   0  success
 *   2  missing env vars or invalid input
 */

import { readFileSync } from "fs";

// Unique marker so we can find and update the existing comment.
const COMMENT_MARKER = "<!-- costguard-ci -->";

interface CiJson {
  score: number | null;
  risk_band: string;
  score_version?: string;
  top_drivers?: string[];
  share_url?: string | null;
  estimated_cost_per_request?: number | null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY;
  const prNumberRaw = process.env.PR_NUMBER ?? process.env.GITHUB_PR_NUMBER;

  if (!token || !repoFull || !prNumberRaw) {
    console.error(
      "Error: Missing required env vars: GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER"
    );
    process.exit(2);
  }

  const [owner, repo] = repoFull.split("/");
  const prNumber = parseInt(prNumberRaw, 10);

  if (!owner || !repo || isNaN(prNumber)) {
    console.error(
      "Error: GITHUB_REPOSITORY must be 'owner/repo' and PR_NUMBER must be an integer"
    );
    process.exit(2);
  }

  // Read JSON from file argument or stdin.
  const jsonFile = process.argv[2];
  let raw: string;
  if (jsonFile) {
    try {
      raw = readFileSync(jsonFile, "utf8").trim();
    } catch {
      console.error(`Error: Cannot read file: ${jsonFile}`);
      process.exit(2);
    }
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    raw = Buffer.concat(chunks).toString("utf8").trim();
  }

  let analysis: CiJson | null = null;
  if (raw) {
    try {
      analysis = JSON.parse(raw) as CiJson;
    } catch {
      // Non-JSON output (e.g. exit-2 error text) — post an error comment.
    }
  }

  const body = buildComment(analysis);
  const existingId = await findExistingComment(token, owner, repo, prNumber);

  if (existingId) {
    await updateComment(token, owner, repo, existingId, body);
    console.log(`CostGuard: updated comment #${existingId} on PR #${prNumber}`);
  } else {
    await createComment(token, owner, repo, prNumber, body);
    console.log(`CostGuard: posted comment on PR #${prNumber}`);
  }
}

// ── Comment builder ───────────────────────────────────────────────────────────

function buildComment(data: CiJson | null): string {
  const FOOTER = `_Analyzed by [CostGuard](https://costguardai.io)_  \n_Score Version: v1.0_`;

  if (!data || data.score === undefined) {
    return [
      COMMENT_MARKER,
      "## CostGuard Analysis",
      "",
      "> **Error:** CostGuard could not complete analysis.",
      "> Check the CI run log for details.",
      "",
      "---",
      FOOTER,
    ].join("\n");
  }

  const score   = data.score !== null ? String(data.score) : "n/a";
  const band    = data.risk_band ?? "UNKNOWN";
  const version = data.score_version ?? "v1.0";
  const drivers = (data.top_drivers ?? []).slice(0, 3);
  const costRaw = data.estimated_cost_per_request;
  const costStr =
    costRaw != null
      ? costRaw >= 0.01
        ? `$${costRaw.toFixed(2)}`
        : `$${costRaw.toFixed(4)}`
      : null;

  const driversBlock =
    drivers.length > 0
      ? drivers.map((d) => `• ${d}`).join("\n")
      : "_No risk drivers identified_";

  const shareBlock =
    data.share_url
      ? `\n\n[View full report ↗](${data.share_url})`
      : "";

  const versionedFooter = `_Analyzed by [CostGuard](https://costguardai.io)_  \n_Score Version: ${version}_${shareBlock}`;

  const costLine = costStr ? `**Projected cost:** ${costStr} per request` : null;

  return [
    COMMENT_MARKER,
    "## CostGuard Report",
    "",
    `**Risk Score:** ${score} (${band})`,
    ...(costLine ? [costLine] : []),
    "",
    "**Top risks:**",
    driversBlock,
    "",
    "---",
    versionedFooter,
  ].join("\n");
}

// ── GitHub API helpers ────────────────────────────────────────────────────────

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function findExistingComment(
  token: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<number | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments?per_page=100`;
  const res = await fetch(url, { headers: githubHeaders(token) });

  if (!res.ok) {
    console.error(`Warning: Could not fetch PR comments (${res.status}). Will create new comment.`);
    return null;
  }

  const comments = (await res.json()) as Array<{ id: number; body: string }>;
  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));
  return existing?.id ?? null;
}

async function createComment(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  const res = await fetch(url, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Error: Failed to create comment — ${res.status} ${text}`);
    process.exit(2);
  }
}

async function updateComment(
  token: string,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/comments/${commentId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: githubHeaders(token),
    body: JSON.stringify({ body }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Error: Failed to update comment — ${res.status} ${text}`);
    process.exit(2);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch((err: Error) => {
  console.error("Error:", err.message);
  process.exit(2);
});
