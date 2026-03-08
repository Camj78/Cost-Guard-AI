export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { verifyGithubSignature } from "@/lib/github/verify-signature";
import {
  listIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  fetchPullRequestDiff,
  MAX_DIFF_BYTES,
  listOpenPullRequests,
  getPullRequestFiles,
  getRepoTree,
  createIssue,
} from "@/lib/github/client";
import { getInstallationToken } from "@/lib/github/app-auth";
import { filterAndSortDiff } from "@/lib/github/filter-diff";
import { countTokens } from "@/lib/tokenizer";
import { assessRisk } from "@/lib/risk";
import { resolveModel } from "@/lib/ai/models";
import { createShareReport } from "@/lib/reports/create-share-report";
import { probeDbHealth, isFailSoftEnabled } from "@/lib/github/resilience";

// ─── Constants ──────────────────────────────────────────────────────────────

const BOT_MARKER = "<!-- costguardai:pr-bot -->";
const INSTALL_ISSUE_MARKER = "<!-- costguardai:install-scan -->";
const ANALYSIS_MODEL_ID = "gpt-4o-mini";
const EXPECTED_OUTPUT_TOKENS = 1024;
const SCORE_VERSION = "1.0.0";
const HANDLED_ACTIONS = new Set(["opened", "reopened", "synchronize"]);

/** Path patterns that indicate AI/LLM prompt usage. */
const AI_FILE_PATTERNS = [
  /prompt/i,
  /openai/i,
  /anthropic/i,
  /langchain/i,
  /claude/i,
  /chatgpt/i,
  /llm/i,
  /\.prompt\b/i,
  /system_prompt/i,
  /ai_config/i,
];

/** Processing lock TTL: if a run holds the lock longer than this, it is
 *  considered crashed and the lock is stolen by the next delivery. */
const LOCK_TTL_MS = 120_000;

// ─── Payload types ──────────────────────────────────────────────────────────

interface InstallationWebhookPayload {
  action: string;
  installation: {
    id: number;
    account: { login: string; id: number; type?: string };
    repository_selection?: string;
  };
  repositories?: Array<{
    name: string;
    full_name: string;
    private: boolean;
  }>;
}

interface PRWebhookPayload {
  action: string;
  pull_request: {
    number: number;
    node_id: string;
    title: string;
    body: string | null;
    updated_at: string;
    head: { sha: string };
  };
  repository: {
    full_name: string;
    name: string;
    owner: { login: string };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCost(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
}

function buildComment(opts: {
  riskScore: number;
  riskLevel: string;
  costTotal: number;
  truncationLevel: string;
  riskDrivers: Array<{ name: string; impact: number; fixes: string[] }>;
  modelName: string;
  diffTooLarge: boolean;
  reportUrl: string | null;
}): string {
  const {
    riskScore,
    riskLevel,
    costTotal,
    truncationLevel,
    riskDrivers,
    modelName,
    diffTooLarge,
    reportUrl,
  } = opts;

  const topDrivers = riskDrivers.slice(0, 3);

  const driversText =
    topDrivers.length > 0
      ? topDrivers
          .map((d) => `- **${d.name}** (impact: ${d.impact}/100)`)
          .join("\n")
      : "- No significant drivers detected";

  const recommendations = topDrivers
    .flatMap((d) => d.fixes)
    .filter(Boolean)
    .slice(0, 4);

  const recText =
    recommendations.length > 0
      ? recommendations.map((r) => `- ${r}`).join("\n")
      : "- No critical issues detected";

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://costguardai.io";

  const lines = [
    BOT_MARKER,
    "## CostGuardAI Preflight Report",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| **Risk** | ${riskLevel.toUpperCase()} (${riskScore}/100) |`,
    `| **Cost (per request)** | ${formatCost(costTotal)} |`,
    `| **Truncation Risk** | ${truncationLevel.toUpperCase()} |`,
    "",
    "**Top Drivers:**",
    driversText,
    "",
    "**Recommendations:**",
    recText,
    "",
    `**Suggested Model:** ${modelName}`,
  ];

  if (diffTooLarge) {
    lines.push(
      "",
      "> ⚠️ Diff exceeded 200 KB — analysis based on title and body only."
    );
  }

  if (reportUrl) {
    lines.push("", `[View Full Analysis →](${reportUrl})`);

    // Badge suggestion — extract shareId from /s/{shareId}
    const shareId = reportUrl.match(/\/s\/([^/?#]+)/)?.[1];
    if (shareId) {
      lines.push(
        "",
        "**Prompt Safety badge for your README:**",
        "```md",
        `![Prompt Safety](${siteUrl}/api/badge/${shareId})`,
        "```"
      );
    }
  }

  lines.push("", "---", `*Powered by [CostGuardAI](${siteUrl})*`);

  return lines.join("\n");
}

// ─── Installation event helpers ───────────────────────────────────────────────

function looksLikeAIFile(path: string): boolean {
  return AI_FILE_PATTERNS.some((p) => p.test(path));
}

function buildInstallIssueBody(opts: {
  repoFullName: string;
  promptFiles: string[];
  riskScore: number;
  riskLevel: string;
  costTotal: number;
  riskDrivers: Array<{ name: string; impact: number; fixes: string[] }>;
  reportUrl: string | null;
  shareId: string | null;
}): string {
  const { repoFullName, promptFiles, riskScore, riskLevel, costTotal, riskDrivers, reportUrl, shareId } = opts;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://costguardai.io";
  const topDrivers = riskDrivers.slice(0, 3);

  const lines = [
    INSTALL_ISSUE_MARKER,
    "## CostGuardAI detected AI prompts in this repository",
    "",
    `CostGuardAI scanned **${repoFullName}** and found likely AI/LLM usage.`,
  ];

  if (promptFiles.length > 0) {
    lines.push(
      "",
      "**Detected AI/prompt files:**",
      ...promptFiles.slice(0, 5).map((f) => `- \`${f}\``),
    );
  }

  lines.push(
    "",
    "**Preflight Scan:**",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| **Risk** | ${riskLevel.toUpperCase()} (${riskScore}/100) |`,
    `| **Cost (per request)** | ${formatCost(costTotal)} |`,
  );

  if (topDrivers.length > 0) {
    lines.push(
      "",
      "**Top Risk Drivers:**",
      ...topDrivers.map((d) => `- **${d.name}** (impact: ${d.impact}/100)`),
    );
  }

  if (reportUrl) {
    lines.push("", `**[View Full Analysis →](${reportUrl})**`);
    if (shareId) {
      lines.push(
        "",
        "**Prompt Safety badge for your README:**",
        "```md",
        `![Prompt Safety](${siteUrl}/api/badge/${shareId})`,
        "```",
      );
    }
  }

  lines.push(
    "",
    "---",
    `*[CostGuardAI](${siteUrl}) — Preflight analysis for LLM prompts. Close this issue to dismiss.*`,
  );

  return lines.join("\n");
}

/**
 * Scan a single repo for AI/prompt files, find an open PR to comment on,
 * or fall back to creating an issue.
 */
async function scanAndPostForRepo(
  repoFullName: string,
  token: string
): Promise<void> {
  const [owner, repoName] = repoFullName.split("/");

  // Step 2: Detect AI/prompt files in repo tree
  let promptFiles: string[] = [];
  try {
    const tree = await getRepoTree(owner, repoName, token);
    promptFiles = tree
      .filter((item) => item.type === "blob" && looksLikeAIFile(item.path))
      .map((item) => item.path)
      .slice(0, 20);
  } catch {
    // Continue — we'll analyze based on repo name if tree fetch fails
  }

  // Build analysis text from detected files (or repo name only)
  const analysisText = [
    "Analyze this repository for AI cost + truncation risk factors.",
    "Focus on prompt design, model choice, token usage, and large text payload risks.",
    "",
    "REPOSITORY:",
    repoFullName,
    "",
    "DETECTED AI/PROMPT FILES:",
    promptFiles.length > 0
      ? promptFiles.join("\n")
      : "(no specific files matched — general AI usage patterns present)",
  ].join("\n");

  const model = resolveModel(ANALYSIS_MODEL_ID);
  if (!model) return;

  const inputTokens = countTokens(analysisText, model);
  const assessment = assessRisk({
    promptText: analysisText,
    inputTokens,
    contextWindow: model.contextWindow,
    expectedOutputTokens: EXPECTED_OUTPUT_TOKENS,
    maxOutputTokens: model.maxOutputTokens,
    compressionDelta: 0,
    tokenStrategy: model.tokenStrategy,
    inputPricePer1M: model.inputPricePer1M,
    outputPricePer1M: model.outputPricePer1M,
  });

  const report = await createShareReport({
    assessment,
    modelId: ANALYSIS_MODEL_ID,
    modelName: model.name,
  });

  const reportUrl = report?.absoluteUrl ?? null;
  const shareId = report?.shareId ?? null;

  // Step 3: Find an open PR touching AI/prompt files, prefer that one
  let postedToGitHub = false;

  try {
    const openPRs = await listOpenPullRequests(owner, repoName, token);

    let targetPR: (typeof openPRs)[0] | null = null;

    // Prefer a PR that actually touches AI files
    for (const pr of openPRs.slice(0, 5)) {
      try {
        const files = await getPullRequestFiles(owner, repoName, pr.number, token);
        if (files.some((f) => looksLikeAIFile(f.filename))) {
          targetPR = pr;
          break;
        }
      } catch {
        // Skip this PR if files fetch fails
      }
    }

    // Fall back to any open PR when AI files were detected in the repo
    if (!targetPR && promptFiles.length > 0 && openPRs.length > 0) {
      targetPR = openPRs[0];
    }

    if (targetPR) {
      const commentBody = buildComment({
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        costTotal: assessment.estimatedCostTotal,
        truncationLevel: assessment.truncation.level,
        riskDrivers: assessment.riskDrivers,
        modelName: model.name,
        diffTooLarge: false,
        reportUrl,
      });

      await upsertBotComment(owner, repoName, targetPR.number, commentBody);
      postedToGitHub = true;
    }
  } catch {
    // PR listing failed — fall through to issue creation
  }

  // Step 5: Issue fallback — only if no PR surface was created
  if (!postedToGitHub) {
    try {
      const issueBody = buildInstallIssueBody({
        repoFullName,
        promptFiles,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        costTotal: assessment.estimatedCostTotal,
        riskDrivers: assessment.riskDrivers,
        reportUrl,
        shareId,
      });

      await createIssue(
        owner,
        repoName,
        "CostGuardAI detected AI prompts in this repository",
        issueBody,
        token
      );
    } catch {
      // Issue creation failed — skip silently (best-effort surface)
    }
  }
}

/**
 * Handle a GitHub App installation event.
 * Scans up to 3 repos in parallel and posts a PR comment or issue.
 * Designed to be called fire-and-forget so the webhook responds immediately.
 */
async function handleInstallationCreated(
  installationId: number,
  repos: Array<{ full_name: string; private: boolean; name: string }>
): Promise<void> {
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !rawKey) return;

  const privateKeyPem = rawKey.replace(/\\n/g, "\n");

  let token: string;
  try {
    token = await getInstallationToken(String(installationId), appId, privateKeyPem);
  } catch {
    return; // Can't auth — skip silently
  }

  // Scan up to 3 repos in parallel to stay well within Vercel timeout
  const reposToScan = repos.slice(0, 3);
  await Promise.allSettled(
    reposToScan.map((repo) => scanAndPostForRepo(repo.full_name, token))
  );
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Inbox upsert (fail-soft deferral) ──────────────────────────────────────

/**
 * Write a deferred webhook event to the inbox.
 *
 * Uses upsert on unique(repo_full_name, pr_number) — "latest SHA wins":
 * if a newer event arrives while degraded, it overwrites the pending row.
 *
 * Never throws — callers treat inbox writes as best-effort.
 */
async function upsertInboxEntry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  entry: {
    deliveryId: string | null;
    repoFullName: string;
    prNumber: number;
    prHeadSha: string;
    prNodeId: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await admin.from("github_webhook_inbox").upsert(
    {
      repo_full_name: entry.repoFullName,
      pr_number: entry.prNumber,
      pr_head_sha: entry.prHeadSha,
      pr_node_id: entry.prNodeId,
      delivery_id: entry.deliveryId,
      received_at: now,
      status: "pending",
      attempts: 0,
      next_attempt_at: now,
      last_error: null,
    },
    { onConflict: "repo_full_name,pr_number" }
  );
}

// ─── Gate C: Delivery-level idempotency ─────────────────────────────────────

/**
 * Check if a GitHub delivery ID has already been received.
 *
 * Uses the `github_webhook_deliveries` table as an append-only delivery log.
 * A unique constraint on `delivery_id` guarantees atomic dedup at the DB level.
 *
 * Returns true  → delivery is a duplicate, skip processing.
 * Returns false → delivery is new, insert succeeded.
 * Returns false → Supabase not configured or on unexpected error (fail-open).
 */
async function checkDeliveryId(
  deliveryId: string | null
): Promise<boolean> {
  if (!deliveryId) return false;

  try {
    const admin = getSupabaseAdmin();
    if (!admin) return false;

    const { error } = await admin
      .from("github_webhook_deliveries")
      .insert({ delivery_id: deliveryId });

    // 23505 = unique_violation → duplicate delivery
    if (error?.code === "23505") return true;
    return false;
  } catch {
    return false;
  }
}

// ─── Gate D: Per-PR processing lock ─────────────────────────────────────────

/**
 * Attempt to acquire a short-lived processing lock for (repo, prNumber).
 *
 * Strategy:
 *   1. Delete any stale lock older than LOCK_TTL_MS (crash recovery).
 *   2. INSERT lock row. If conflict → another request holds the lock → skip.
 *
 * Returns true  → lock acquired, proceed.
 * Returns false → lock already held, skip (return 200 to GitHub).
 * Returns true  → Supabase not configured or unexpected error (fail-open).
 */
async function acquireProcessingLock(
  repoFullName: string,
  prNumber: number
): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return true;

    // Expire stale locks first (crash / cold-start recovery)
    await admin
      .from("github_pr_processing")
      .delete()
      .eq("repo_full_name", repoFullName)
      .eq("pr_number", prNumber)
      .lt(
        "locked_at",
        new Date(Date.now() - LOCK_TTL_MS).toISOString()
      );

    const { error } = await admin
      .from("github_pr_processing")
      .insert({ repo_full_name: repoFullName, pr_number: prNumber });

    // 23505 = unique_violation → lock held by a concurrent request
    if (error?.code === "23505") return false;
    return true;
  } catch {
    return true; // fail-open
  }
}

/** Release the processing lock. Called in finally — never throws. */
async function releaseProcessingLock(
  repoFullName: string,
  prNumber: number
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;

    await admin
      .from("github_pr_processing")
      .delete()
      .eq("repo_full_name", repoFullName)
      .eq("pr_number", prNumber);
  } catch {
    // Non-critical — lock expires on its own after LOCK_TTL_MS
  }
}

// ─── SHA-level semantic dedup ────────────────────────────────────────────────

/**
 * Try to insert a dedup record keyed by repo+pr+sha.
 * Returns { isDuplicate: true } if an identical SHA was already processed.
 * Returns { isDuplicate: false, runId } on new insert.
 * Skips gracefully if Supabase is not configured.
 */
async function checkAndRecordDelivery(
  repoFullName: string,
  prNumber: number,
  prNodeId: string,
  prHeadSha: string,
  deliveryId: string | null
): Promise<{ isDuplicate: boolean; runId: string | null }> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return { isDuplicate: false, runId: null };

    const { data, error } = await admin
      .from("github_pr_runs")
      .insert({
        repo_full_name: repoFullName,
        pr_number: prNumber,
        pr_node_id: prNodeId,
        pr_head_sha: prHeadSha,
        last_delivery_id: deliveryId,
      })
      .select("id")
      .single();

    // Unique constraint violation → duplicate SHA delivery → skip
    if (error && error.code === "23505") return { isDuplicate: true, runId: null };
    if (error || !data) return { isDuplicate: false, runId: null };

    return { isDuplicate: false, runId: data.id as string };
  } catch {
    return { isDuplicate: false, runId: null };
  }
}

/** Store analysis results back onto the dedup record. Non-critical: never throws. */
async function persistAnalysisResult(
  runId: string,
  riskScore: number,
  riskLevel: string,
  costTotal: number,
  modelId: string,
  inputHash: string
): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return;

    await admin
      .from("github_pr_runs")
      .update({
        risk_score: riskScore,
        risk_level: riskLevel,
        cost_total: costTotal,
        model_id: modelId,
        score_version: SCORE_VERSION,
        input_hash: inputHash,
      })
      .eq("id", runId);
  } catch {
    // Non-critical — don't fail the webhook on a result-storage error
  }
}

// ─── Comment upsert with robustness ─────────────────────────────────────────

/**
 * Idempotent bot comment upsert.
 *
 * Handles all comment states robustly:
 *   - No bot comment found      → create (covers post-deletion recovery)
 *   - Exactly one bot comment   → update it
 *   - Multiple bot comments     → update newest (highest ID), delete duplicates
 */
async function upsertBotComment(
  owner: string,
  repoName: string,
  prNumber: number,
  commentBody: string
): Promise<void> {
  const comments = await listIssueComments(owner, repoName, prNumber);

  // Filter to bot-authored comments, sort newest-first by ID (IDs are monotonic)
  const botComments = comments
    .filter((c) => c.body?.includes(BOT_MARKER))
    .sort((a, b) => b.id - a.id);

  if (botComments.length === 0) {
    // No bot comment (including post-deletion) — create fresh
    await createIssueComment(owner, repoName, prNumber, commentBody);
  } else {
    // Update the newest bot comment
    await updateIssueComment(owner, repoName, botComments[0].id, commentBody);

    // Delete any duplicate bot comments (defensive cleanup)
    for (const dup of botComments.slice(1)) {
      await deleteIssueComment(owner, repoName, dup.id).catch(() => {
        // Best-effort — don't fail the webhook over a cleanup error
      });
    }
  }
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const start = Date.now();

  // Must read raw body first — required for signature verification
  const rawBody = await req.text();

  // Verify GitHub webhook signature — outside span; invalid sig = no trace noise
  const sig = req.headers.get("x-hub-signature-256");
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";

  if (!verifyGithubSignature({ secret, rawBody, signature256Header: sig })) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Handle GitHub's ping event (sent on webhook creation)
  const event = req.headers.get("x-github-event");
  if (event === "ping") {
    return NextResponse.json({ ok: true });
  }

  // Handle GitHub App installation event — scan repos and post virality surface
  if (event === "installation") {
    try {
      const payload = JSON.parse(rawBody) as InstallationWebhookPayload;
      if (payload.action === "created") {
        // Persist full installation metadata via service role.
        // user_id is unknown at webhook time; the install callback sets it
        // separately via onConflict upsert keyed on installation_id.
        const admin = getSupabaseAdmin();
        if (admin) {
          try {
            await admin
              .from("github_installations")
              .upsert(
                {
                  installation_id: payload.installation.id,
                  account_login: payload.installation.account?.login ?? null,
                  account_id: payload.installation.account?.id ?? null,
                  account_type: payload.installation.account?.type ?? null,
                  repository_selection: payload.installation.repository_selection ?? null,
                },
                { onConflict: "installation_id", ignoreDuplicates: false }
              );
          } catch (err: unknown) {
            Sentry.captureException(err, {
              extra: { context: "installation_metadata_upsert" },
            });
          }
        }

        // Fire-and-forget: respond immediately, process in background
        handleInstallationCreated(
          payload.installation.id,
          payload.repositories ?? []
        ).catch((err: unknown) => {
          Sentry.captureException(err, { extra: { context: "installation_created" } });
        });
      }
    } catch {
      // Malformed payload — ACK safely
    }
    return NextResponse.json({ ok: true });
  }

  // Ignore non-PR events
  if (event !== "pull_request") {
    return NextResponse.json({ ok: true });
  }

  return await Sentry.startSpan(
    { name: "api.github.webhook", op: "http.server" },
    async (span) => {
      const deployment = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";
      span.setAttribute("deployment", deployment);
      span.setAttribute("route", "/api/github/webhook");
      span.setAttribute("event", event ?? "unknown");

      const deliveryId = req.headers.get("x-github-delivery");

      try {
        // ── Fail-soft: probe DB health before any DB-dependent work ───
        //
        // If DB is unavailable: write to inbox (best effort) and ACK with 202.
        // GitHub will NOT auto-retry 202 responses, so we return exactly 202
        // to signal "received but deferred" — the recovery worker handles it.
        //
        // The probe happens BEFORE delivery dedup so we don't accidentally mark
        // a delivery as "seen" in a degraded/partial DB state.
        if (isFailSoftEnabled()) {
          const admin = getSupabaseAdmin();
          if (admin) {
            const isHealthy = await probeDbHealth(admin);
            if (!isHealthy) {
              span.setAttribute("degraded", true);

              // Parse payload for inbox (best effort — if parse fails, just ACK)
              try {
                const payload = JSON.parse(rawBody) as PRWebhookPayload;
                const { action, pull_request: pr, repository: repo } = payload;

                // Only defer actions we would have processed in healthy mode
                if (HANDLED_ACTIONS.has(action)) {
                  span.setAttribute("repo", repo.full_name);
                  span.setAttribute("prNumber", pr.number);
                  span.setAttribute("prHeadSha", pr.head.sha);

                  await upsertInboxEntry(admin, {
                    deliveryId,
                    repoFullName: repo.full_name,
                    prNumber: pr.number,
                    prHeadSha: pr.head.sha,
                    prNodeId: pr.node_id,
                  }).catch((err: unknown) => {
                    // Inbox write failed too (total outage) — log and ACK safely
                    Sentry.captureException(err, {
                      extra: { context: "inbox_write_failed_during_degraded" },
                    });
                  });
                }
              } catch {
                // Payload parse failed — ACK safely with no side effects
              }

              span.setAttribute("latencyMs", Date.now() - start);
              // 202 Accepted: event received, processing deferred
              return NextResponse.json(
                { ok: true, deferred: true },
                { status: 202 }
              );
            }
          }
        }

        // ── DB is healthy — proceed with normal pipeline ───────────────

        // ── Gate C: delivery-level dedup ──────────────────────────────
        // Fastest check — filters GitHub re-deliveries before any analysis work.
        const isDeliveryDupe = await checkDeliveryId(deliveryId);
        if (isDeliveryDupe) {
          span.setAttribute("skipped", "delivery_duplicate");
          return NextResponse.json({ ok: true, skipped: "delivery_duplicate" });
        }

        const payload = JSON.parse(rawBody) as PRWebhookPayload;
        const { action, pull_request: pr, repository: repo } = payload;

        span.setAttribute("prAction", action);
        span.setAttribute("repo", repo.full_name);
        span.setAttribute("prNumber", pr.number);

        // Only process opened, synchronize, reopened
        if (!HANDLED_ACTIONS.has(action)) {
          return NextResponse.json({ ok: true });
        }

        const [owner, repoName] = repo.full_name.split("/");
        const prHeadSha = pr.head.sha;

        span.setAttribute("prHeadSha", prHeadSha);

        // ── Gate D: per-PR processing lock ────────────────────────────
        // Prevents two concurrent deliveries from running analysis in parallel
        // for the same repo+PR (e.g. rapid consecutive pushes, retry storms).
        const lockAcquired = await acquireProcessingLock(
          repo.full_name,
          pr.number
        );

        if (!lockAcquired) {
          span.setAttribute("skipped", "concurrency_locked");
          return NextResponse.json({ ok: true, skipped: "concurrency_locked" });
        }

        try {
          // ── Gate C (semantic): SHA-level dedup ───────────────────────
          // If the same commit SHA was already fully processed, skip.
          const { isDuplicate, runId } = await checkAndRecordDelivery(
            repo.full_name,
            pr.number,
            pr.node_id,
            prHeadSha,
            deliveryId
          );

          if (isDuplicate) {
            span.setAttribute("skipped", "sha_duplicate");
            return NextResponse.json({ ok: true, skipped: "sha_duplicate" });
          }

          // Fetch diff — bounded to MAX_DIFF_BYTES, filtered + sorted
          let diffText = "";
          let diffTooLarge = false;

          await Sentry.startSpan(
            { name: "github.fetchDiff", op: "http.client" },
            async (diffSpan) => {
              try {
                const raw = await fetchPullRequestDiff(owner, repoName, pr.number);
                diffTooLarge = raw.length >= MAX_DIFF_BYTES;
                // Filter lockfiles / dist / generated; stable sort by filename
                diffText = filterAndSortDiff(raw);
              } catch {
                diffTooLarge = true;
              }
              diffSpan.setAttribute("diffTooLarge", diffTooLarge);
            }
          );

          span.setAttribute("diffTooLarge", diffTooLarge);

          // Build analysis input text
          const analysisText = [
            "Analyze this Pull Request for AI cost + truncation risk factors.",
            "Focus on prompt size, model choice, token usage, and any large text payload risks.",
            "",
            "TITLE:",
            pr.title,
            "",
            "BODY:",
            pr.body ?? "(no description provided)",
            "",
            "DIFF:",
            diffTooLarge ? "(diff too large — omitted)" : diffText,
          ].join("\n");

          // Deterministic input hash (first 16 hex chars of SHA-256)
          const inputHash = createHash("sha256")
            .update(analysisText, "utf8")
            .digest("hex")
            .slice(0, 16);

          // Run CostGuard analysis using existing engine
          const model = resolveModel(ANALYSIS_MODEL_ID);
          if (!model) throw new Error(`Model not found: ${ANALYSIS_MODEL_ID}`);

          let assessment: ReturnType<typeof assessRisk>;

          await Sentry.startSpan(
            { name: "analysis.compute", op: "function" },
            async (computeSpan) => {
              computeSpan.setAttribute("model", ANALYSIS_MODEL_ID);

              const inputTokens = countTokens(analysisText, model);

              assessment = assessRisk({
                promptText: analysisText,
                inputTokens,
                contextWindow: model.contextWindow,
                expectedOutputTokens: EXPECTED_OUTPUT_TOKENS,
                maxOutputTokens: model.maxOutputTokens,
                compressionDelta: 0,
                tokenStrategy: model.tokenStrategy,
                inputPricePer1M: model.inputPricePer1M,
                outputPricePer1M: model.outputPricePer1M,
              });

              computeSpan.setAttribute("riskScore", assessment!.riskScore);
              computeSpan.setAttribute("inputTokens", inputTokens);
            }
          );

          // Persist analysis result onto the dedup record
          if (runId) {
            await persistAnalysisResult(
              runId,
              assessment!.riskScore,
              assessment!.riskLevel,
              assessment!.estimatedCostTotal,
              ANALYSIS_MODEL_ID,
              inputHash
            );
          }

          // Generate shareable report link
          const report = await createShareReport({
            assessment: assessment!,
            modelId: ANALYSIS_MODEL_ID,
            modelName: model.name,
          });

          // Build PR comment
          const commentBody = buildComment({
            riskScore: assessment!.riskScore,
            riskLevel: assessment!.riskLevel,
            costTotal: assessment!.estimatedCostTotal,
            truncationLevel: assessment!.truncation.level,
            riskDrivers: assessment!.riskDrivers,
            modelName: model.name,
            diffTooLarge,
            reportUrl: report?.absoluteUrl ?? null,
          });

          // Robust comment upsert — handles deleted / duplicate bot comments
          await Sentry.startSpan(
            { name: "github.commentUpsert", op: "http.client" },
            async () => {
              await upsertBotComment(owner, repoName, pr.number, commentBody);
            }
          );

          span.setAttribute("latencyMs", Date.now() - start);
          return NextResponse.json({ ok: true });
        } finally {
          // Always release the lock — even on error or early return
          await releaseProcessingLock(repo.full_name, pr.number);
        }
      } catch (err) {
        // Capture error but return 200 after signature validation to prevent GitHub retry storms
        Sentry.captureException(err);
        return NextResponse.json({ ok: true });
      }
    }
  );
}
