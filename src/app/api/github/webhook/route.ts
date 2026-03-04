export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { verifyGithubSignature } from "@/lib/github/verify-signature";
import {
  listIssueComments,
  createIssueComment,
  updateIssueComment,
  fetchPullRequestDiff,
  MAX_DIFF_BYTES,
} from "@/lib/github/client";
import { countTokens } from "@/lib/tokenizer";
import { assessRisk } from "@/lib/risk";
import { resolveModel } from "@/lib/ai/models";

// ─── Constants ──────────────────────────────────────────────────────────────

const BOT_MARKER = "<!-- costguardai:pr-bot -->";
const ANALYSIS_MODEL_ID = "gpt-4o-mini";
const EXPECTED_OUTPUT_TOKENS = 1024;
const HANDLED_ACTIONS = new Set(["opened", "reopened", "synchronize", "edited"]);

// ─── Payload types ──────────────────────────────────────────────────────────

interface PRWebhookPayload {
  action: string;
  pull_request: {
    number: number;
    node_id: string;
    title: string;
    body: string | null;
    updated_at: string;
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
}): string {
  const {
    riskScore,
    riskLevel,
    costTotal,
    truncationLevel,
    riskDrivers,
    modelName,
    diffTooLarge,
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

  lines.push("", "---", `*Powered by [CostGuardAI](${siteUrl})*`);

  return lines.join("\n");
}

// ─── Supabase dedup (optional — skips gracefully if not configured) ──────────

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function checkAndRecordDelivery(
  repoFullName: string,
  prNumber: number,
  prNodeId: string,
  prUpdatedAt: string,
  deliveryId: string | null
): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) return false;

    const { error } = await admin.from("github_pr_runs").insert({
      repo_full_name: repoFullName,
      pr_number: prNumber,
      pr_node_id: prNodeId,
      pr_updated_at: prUpdatedAt,
      last_delivery_id: deliveryId,
    });

    // Unique constraint violation → duplicate delivery → skip
    if (error && error.code === "23505") return true;
    return false;
  } catch {
    return false;
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

      try {
        const payload = JSON.parse(rawBody) as PRWebhookPayload;
        const { action, pull_request: pr, repository: repo } = payload;

        span.setAttribute("prAction", action);
        span.setAttribute("repo", repo.full_name);
        span.setAttribute("prNumber", pr.number);

        // Only process relevant actions
        if (!HANDLED_ACTIONS.has(action)) {
          return NextResponse.json({ ok: true });
        }

        const [owner, repoName] = repo.full_name.split("/");
        const deliveryId = req.headers.get("x-github-delivery");

        // Dedup check via Supabase (no-op if admin client not configured)
        const isDuplicate = await checkAndRecordDelivery(
          repo.full_name,
          pr.number,
          pr.node_id,
          pr.updated_at,
          deliveryId
        );

        if (isDuplicate) {
          return NextResponse.json({ ok: true, skipped: "duplicate" });
        }

        // Fetch diff — bounded to MAX_DIFF_BYTES
        let diffText = "";
        let diffTooLarge = false;

        await Sentry.startSpan(
          { name: "github.fetchDiff", op: "http.client" },
          async (diffSpan) => {
            try {
              const raw = await fetchPullRequestDiff(owner, repoName, pr.number);
              if (raw.length >= MAX_DIFF_BYTES) {
                diffTooLarge = true;
                diffText = raw;
              } else {
                diffText = raw;
              }
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

        // Build PR comment
        const commentBody = buildComment({
          riskScore: assessment!.riskScore,
          riskLevel: assessment!.riskLevel,
          costTotal: assessment!.estimatedCostTotal,
          truncationLevel: assessment!.truncation.level,
          riskDrivers: assessment!.riskDrivers,
          modelName: model.name,
          diffTooLarge,
        });

        // Idempotent comment — update existing bot comment or create new
        await Sentry.startSpan(
          { name: "github.commentUpsert", op: "http.client" },
          async (commentSpan) => {
            const comments = await listIssueComments(owner, repoName, pr.number);
            const existing = comments.find((c) => c.body?.includes(BOT_MARKER));

            commentSpan.setAttribute("upsertMode", existing ? "update" : "create");

            if (existing) {
              await updateIssueComment(owner, repoName, existing.id, commentBody);
            } else {
              await createIssueComment(owner, repoName, pr.number, commentBody);
            }
          }
        );

        span.setAttribute("latencyMs", Date.now() - start);
        return NextResponse.json({ ok: true });
      } catch (err) {
        // Capture error but return 200 after signature validation to prevent GitHub retry storms
        Sentry.captureException(err);
        return NextResponse.json({ ok: true });
      }
    }
  );
}
