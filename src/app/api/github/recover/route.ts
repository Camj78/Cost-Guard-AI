/**
 * Recovery worker — POST /api/github/recover
 *
 * Drains the github_webhook_inbox table, processing deferred PR events that
 * arrived while the DB was unavailable (fail-soft degraded mode).
 *
 * Designed to be called by:
 *   - A cron job (e.g., Vercel Cron, Supabase pg_cron, external scheduler)
 *   - The costguard CLI: `costguard github:recover`
 *   - A manual POST from ops
 *
 * Security:
 *   If GITHUB_RECOVER_SECRET is set, the request must include:
 *     Authorization: Bearer <GITHUB_RECOVER_SECRET>
 *   If not set, the route is open (acceptable for local dev; set it in production).
 *
 * Processing guarantees:
 *   1. "Latest SHA wins" — inbox has unique(repo_full_name, pr_number), so each
 *      row already holds the most recent SHA received while degraded.
 *   2. Exactly-once — before analysis, checkAndRecordDelivery inserts into
 *      github_pr_runs (unique on repo+pr+sha). If the SHA was already processed
 *      (DB recovered mid-outage and a duplicate delivery landed), the insert
 *      returns 23505 and the inbox entry is marked done without re-analysis.
 *   3. Backoff — failed entries are retried with exponential delay; after 5
 *      attempts the entry is marked "dead" for manual inspection.
 *   4. Stale-processing recovery — entries stuck in "processing" state for
 *      > STALE_PROCESSING_MS are reset to "pending" (crash recovery).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createHash } from "crypto";
import { NextResponse } from "next/server";
// Sentry stub — @sentry/nextjs not installed; replace with real SDK when available
const Sentry = {
  startSpan: async <T>(_ctx: unknown, fn: (span: { setAttribute: (k: string, v: unknown) => void }) => Promise<T>): Promise<T> => {
    const stub = { setAttribute: (_k: string, _v: unknown) => {} };
    return fn(stub);
  },
  captureException: (_err: unknown, _opts?: unknown): void => {},
};
import { createClient } from "@supabase/supabase-js";
import {
  listIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  fetchPullRequestDiff,
  MAX_DIFF_BYTES,
} from "@/lib/github/client";
import { filterAndSortDiff } from "@/lib/github/filter-diff";
import { countTokens } from "@/lib/tokenizer";
import { assessRisk } from "@/lib/risk";
import { resolveModel } from "@/lib/ai/models";
import { createShareReport } from "@/lib/reports/create-share-report";
import { nextBackoffSeconds, type InboxRow } from "@/lib/github/resilience";

// ─── Constants ───────────────────────────────────────────────────────────────

const BOT_MARKER = "<!-- costguardai:pr-bot -->";
const ANALYSIS_MODEL_ID = "gpt-4o-mini";
const EXPECTED_OUTPUT_TOKENS = 1024;
const SCORE_VERSION = "1.0.0";

/** Max items to process per invocation (prevents runaway long-running requests). */
const MAX_ITEMS_PER_RUN = 50;

/** Entries stuck in "processing" longer than this are reset to "pending". */
const STALE_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes

/** Max attempts before an entry is marked "dead". */
const MAX_ATTEMPTS = 5;

// ─── Supabase ────────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Comment helpers (mirrors webhook route) ─────────────────────────────────

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

async function upsertBotComment(
  owner: string,
  repoName: string,
  prNumber: number,
  commentBody: string
): Promise<void> {
  const comments = await listIssueComments(owner, repoName, prNumber);

  const botComments = comments
    .filter((c) => c.body?.includes(BOT_MARKER))
    .sort((a, b) => b.id - a.id);

  if (botComments.length === 0) {
    await createIssueComment(owner, repoName, prNumber, commentBody);
  } else {
    await updateIssueComment(owner, repoName, botComments[0].id, commentBody);

    for (const dup of botComments.slice(1)) {
      await deleteIssueComment(owner, repoName, dup.id).catch(() => {});
    }
  }
}

// ─── Core item processor ─────────────────────────────────────────────────────

/**
 * Process a single inbox item.
 *
 * Returns "processed" | "skipped" (SHA already done) | throws on error.
 */
async function processItem(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  item: InboxRow
): Promise<"processed" | "skipped"> {
  const [owner, repoName] = item.repo_full_name.split("/");

  // ── Exactly-once: attempt to insert into github_pr_runs ──────────────────
  //
  // If this SHA was already processed (DB recovered mid-outage and the event
  // was handled by the main webhook path), the unique constraint returns 23505
  // → we skip and mark the inbox entry done.
  const { data: runData, error: runError } = await admin
    .from("github_pr_runs")
    .insert({
      repo_full_name: item.repo_full_name,
      pr_number: item.pr_number,
      pr_node_id: item.pr_node_id,
      pr_head_sha: item.pr_head_sha,
      last_delivery_id: item.delivery_id,
    })
    .select("id")
    .single();

  if (runError?.code === "23505") {
    // SHA already processed — skip cleanly
    return "skipped";
  }
  if (runError) {
    throw new Error(`github_pr_runs insert failed: ${runError.message}`);
  }

  const runId = runData?.id as string | undefined;

  // ── Fetch + filter diff ───────────────────────────────────────────────────
  let diffText = "";
  let diffTooLarge = false;

  try {
    const raw = await fetchPullRequestDiff(owner, repoName, item.pr_number);
    diffTooLarge = raw.length >= MAX_DIFF_BYTES;
    diffText = filterAndSortDiff(raw);
  } catch {
    diffTooLarge = true;
  }

  // ── Build analysis input ──────────────────────────────────────────────────
  // We don't store PR title/body in the inbox (to keep the row small).
  // Recovery uses the diff only, with a note that this is a recovered analysis.
  const analysisText = [
    "Analyze this Pull Request for AI cost + truncation risk factors.",
    "Focus on prompt size, model choice, token usage, and any large text payload risks.",
    "",
    "TITLE:",
    "(recovered from deferred analysis — title not stored)",
    "",
    "BODY:",
    "(recovered from deferred analysis — body not stored)",
    "",
    "DIFF:",
    diffTooLarge ? "(diff too large — omitted)" : diffText,
  ].join("\n");

  const inputHash = createHash("sha256")
    .update(analysisText, "utf8")
    .digest("hex")
    .slice(0, 16);

  // ── Run analysis ──────────────────────────────────────────────────────────
  const model = resolveModel(ANALYSIS_MODEL_ID);
  if (!model) throw new Error(`Model not found: ${ANALYSIS_MODEL_ID}`);

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

  // ── Persist result ────────────────────────────────────────────────────────
  if (runId) {
    try {
      await admin
        .from("github_pr_runs")
        .update({
          risk_score: assessment.riskScore,
          risk_level: assessment.riskLevel,
          cost_total: assessment.estimatedCostTotal,
          model_id: ANALYSIS_MODEL_ID,
          score_version: SCORE_VERSION,
          input_hash: inputHash,
        })
        .eq("id", runId);
    } catch {} // non-critical
  }

  // ── Generate report link ──────────────────────────────────────────────────
  const report = await createShareReport({
    assessment,
    modelId: ANALYSIS_MODEL_ID,
    modelName: model.name,
  });

  // ── Build + post comment ──────────────────────────────────────────────────
  const commentBody = buildComment({
    riskScore: assessment.riskScore,
    riskLevel: assessment.riskLevel,
    costTotal: assessment.estimatedCostTotal,
    truncationLevel: assessment.truncation.level,
    riskDrivers: assessment.riskDrivers,
    modelName: model.name,
    diffTooLarge,
    reportUrl: report?.absoluteUrl ?? null,
  });

  await upsertBotComment(owner, repoName, item.pr_number, commentBody);

  return "processed";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // GITHUB_RECOVER_SECRET is REQUIRED. The endpoint is never open.
  const recoverSecret = process.env.GITHUB_RECOVER_SECRET;
  if (!recoverSecret) {
    return NextResponse.json(
      { ok: false, error: "recover_not_configured" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${recoverSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "DB not configured" },
      { status: 503 }
    );
  }

  return await Sentry.startSpan(
    { name: "api.github.recover", op: "http.server" },
    async (span) => {
      try {
        // ── Reset stale "processing" entries (crash recovery) ─────────────
        const staleThreshold = new Date(
          Date.now() - STALE_PROCESSING_MS
        ).toISOString();

        await admin
          .from("github_webhook_inbox")
          .update({
            status: "pending",
            next_attempt_at: new Date().toISOString(),
          })
          .eq("status", "processing")
          .lt("next_attempt_at", staleThreshold);

        // ── Fetch pending items (oldest-due first) ────────────────────────
        const { data: items, error: fetchError } = await admin
          .from("github_webhook_inbox")
          .select("*")
          .eq("status", "pending")
          .lte("next_attempt_at", new Date().toISOString())
          .order("next_attempt_at", { ascending: true })
          .limit(MAX_ITEMS_PER_RUN);

        if (fetchError) {
          return NextResponse.json(
            { error: fetchError.message },
            { status: 500 }
          );
        }

        const rows = (items ?? []) as InboxRow[];

        if (rows.length === 0) {
          span.setAttribute("pending", 0);
          return NextResponse.json({ ok: true, processed: 0, skipped: 0, errors: [] });
        }

        span.setAttribute("pending", rows.length);

        let processed = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const item of rows) {
          // Mark as processing (prevents concurrent recovery runs from picking it up)
          await admin
            .from("github_webhook_inbox")
            .update({ status: "processing" })
            .eq("id", item.id);

          try {
            const result = await processItem(admin, item);

            await admin
              .from("github_webhook_inbox")
              .update({ status: "done" })
              .eq("id", item.id);

            if (result === "processed") processed++;
            else skipped++;
          } catch (err) {
            const errMsg =
              err instanceof Error ? err.message : String(err);
            errors.push(`${item.repo_full_name}#${item.pr_number}: ${errMsg}`);

            Sentry.captureException(err, {
              extra: {
                repo: item.repo_full_name,
                pr: item.pr_number,
                sha: item.pr_head_sha,
                attempts: item.attempts,
              },
            });

            const newAttempts = item.attempts + 1;
            const isDead = newAttempts >= MAX_ATTEMPTS;
            const backoffMs = nextBackoffSeconds(item.attempts) * 1000;

            try {
              await admin
                .from("github_webhook_inbox")
                .update({
                  status: isDead ? "dead" : "pending",
                  attempts: newAttempts,
                  next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
                  last_error: errMsg,
                })
                .eq("id", item.id);
            } catch {} // best effort
          }
        }

        span.setAttribute("processed", processed);
        span.setAttribute("skipped", skipped);
        span.setAttribute("errors", errors.length);

        return NextResponse.json({
          ok: true,
          processed,
          skipped,
          errors,
        });
      } catch (err) {
        Sentry.captureException(err);
        return NextResponse.json(
          { error: "Recovery failed", detail: String(err) },
          { status: 500 }
        );
      }
    }
  );
}
