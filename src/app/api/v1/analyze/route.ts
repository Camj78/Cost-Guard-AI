import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyApiKey, checkFreeTierLimit } from "@/lib/api-keys/verify-api-key";
import { countTokens } from "@/lib/tokenizer";
import { assessRisk } from "@/lib/risk";
import { createShareReport } from "@/lib/reports/create-share-report";
import { recordAiUsageEvent } from "@/lib/telemetry/ai-usage-event";
import { logRequestError } from "@/lib/telemetry/log-request-error";
import { ANALYSIS_VERSION, RULESET_HASH, hashInput } from "@/lib/trust";
import { estimateCostImpact } from "@/lib/cost-estimator";
import {
  MODEL_CATALOG,
  DEFAULT_MODEL,
  DEFAULT_EXPECTED_OUTPUT,
  resolveModel,
} from "@/lib/ai/models";

// ── Admin client (lazy, service-role) ──────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _admin: ReturnType<typeof createClient<any>> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdminClient(): ReturnType<typeof createClient<any>> | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!_admin) _admin = createClient<any>(url, key);
  return _admin;
}

// ── Safe insert with schema-drift fallback ─────────────────────────────────────
async function insertAnalysisHistoryWithFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: ReturnType<typeof createClient<any>>,
  fullPayload: {
    user_id: string;
    prompt_hash: string;
    model_id: string;
    input_tokens: number;
    output_tokens: number;
    cost_total: number;
    risk_score: number;
    analysis_version: string;
    score_version: string;
    ruleset_hash: string;
    input_hash: string;
    source: string;
  }
): Promise<void> {
  const { error } = await admin.from("analysis_history").insert(fullPayload);

  if (!error) {
    console.log("[analysis_history] full insert ok");
    return;
  }

  if (error.code === "42703") {
    console.warn("[analysis_history] schema drift detected, retrying base insert");

    const basePayload = {
      user_id: fullPayload.user_id,
      risk_score: fullPayload.risk_score,
      created_at: new Date().toISOString(),
    };

    const { error: fallbackError } = await admin
      .from("analysis_history")
      .insert(basePayload);

    if (!fallbackError) {
      console.log("[analysis_history] fallback insert ok");
      return;
    }

    console.error("[analysis_history] fallback insert failed", fallbackError);
    throw fallbackError;
  }

  // Non-42703 error on full insert — surface it
  throw error;
}

export const dynamic = "force-dynamic";

function formatCostValue(amount: number): number {
  return parseFloat(amount.toFixed(amount >= 0.01 ? 2 : 4));
}

export async function POST(req: Request) {
  const _start = Date.now();
  const analysisId = crypto.randomUUID();

  // Detect CLI origin — set by costguard CLI via x-costguard-cli header or UA
  const ua = req.headers.get("user-agent") ?? "";
  const isCli =
    req.headers.get("x-costguard-cli") === "true" ||
    ua.startsWith("costguard-cli/");
  const source = isCli ? "cli" : undefined;

  try {
  // 1. Verify API key
  const apiKey = req.headers.get("x-api-key") ?? "";
  const keyRecord = await verifyApiKey(apiKey);
  if (!keyRecord) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }
  console.log("[/api/v1/analyze] verified keyRecord:", {
    hasUserId: Boolean(keyRecord?.user_id),
    userId: keyRecord?.user_id ?? null,
  })

  // 1b. Enforce free-tier monthly limit
  if (keyRecord.plan === "free") {
    const { allowed } = await checkFreeTierLimit(keyRecord.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Free tier monthly analysis limit reached", plan: "free", limit: 25 },
        { status: 429 }
      );
    }
  }

  // 2. Parse and validate body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }
  const inputHash = hashInput(prompt);

  const modelId =
    typeof body.model === "string" ? body.model : DEFAULT_MODEL;
  const model = resolveModel(modelId) ?? resolveModel(DEFAULT_MODEL)!;

  const expectedOutputTokens =
    typeof body.expected_output_tokens === "number"
      ? Math.max(1, Math.floor(body.expected_output_tokens))
      : DEFAULT_EXPECTED_OUTPUT;

  const requestsPerMonth =
    typeof body.requests_per_month === "number"
      ? Math.max(1, Math.floor(body.requests_per_month))
      : 100_000;

  // 3. Run analysis on the requested model
  const inputTokens = countTokens(prompt, model);
  const assessment = assessRisk({
    promptText: prompt,
    inputTokens,
    contextWindow: model.contextWindow,
    expectedOutputTokens,
    maxOutputTokens: model.maxOutputTokens,
    compressionDelta: 0,
    tokenStrategy: model.tokenStrategy,
    inputPricePer1M: model.inputPricePer1M,
    outputPricePer1M: model.outputPricePer1M,
  });

  // 4. Find recommended model — lowest risk-adjusted cost across catalog
  let recommendedModelId = model.id;
  let lowestRiskAdjustedCost = Infinity;

  for (const m of MODEL_CATALOG) {
    const tokens = countTokens(prompt, m);
    const a = assessRisk({
      promptText: prompt,
      inputTokens: tokens,
      contextWindow: m.contextWindow,
      expectedOutputTokens,
      maxOutputTokens: m.maxOutputTokens,
      compressionDelta: 0,
      tokenStrategy: m.tokenStrategy,
      inputPricePer1M: m.inputPricePer1M,
      outputPricePer1M: m.outputPricePer1M,
    });
    const riskAdjustedCost = a.estimatedCostTotal * (1 + a.riskScore / 100);
    if (riskAdjustedCost < lowestRiskAdjustedCost) {
      lowestRiskAdjustedCost = riskAdjustedCost;
      recommendedModelId = m.id;
    }
  }

  // 5. Generate share report
  const shareResult = await createShareReport({
    assessment,
    modelId: model.id,
    modelName: model.name,
  });

  // 6a. Record to analysis_history — awaited, with schema-drift fallback.
  //     Only possible when the API key is linked to a user account (user_id present).
  console.log("[/api/v1/analyze] entering analysis_history write block")
  if (!keyRecord.user_id) {
    console.warn("[/api/v1/analyze] skipping analysis_history write because user_id is null")
    console.warn("[/api/v1/analyze] skipping analysis_history write: user_id is null (set FOUNDER_USER_ID in Vercel env, or use a DB-backed API key from /api/keys)");
  }
  if (keyRecord.user_id) {
    const admin = getAdminClient();
    if (admin) {
      const insertSource = isCli ? "cli" : "api";
      await insertAnalysisHistoryWithFallback(admin, {
        user_id: keyRecord.user_id,
        prompt_hash: inputHash,
        model_id: model.id,
        input_tokens: assessment.inputTokens,
        output_tokens: expectedOutputTokens,
        cost_total: assessment.estimatedCostTotal,
        risk_score: assessment.riskScore,
        analysis_version: ANALYSIS_VERSION,
        score_version: assessment.score_version,
        ruleset_hash: RULESET_HASH,
        input_hash: inputHash,
        source: insertSource,
      });
    } else {
      console.error("[/api/v1/analyze] skipping analysis_history insert: admin client unavailable (check SUPABASE_SERVICE_ROLE_KEY)");
    }
  }

  // 6b. Record usage event (fire-and-forget)
  void recordAiUsageEvent({
    endpoint: "/api/v1/analyze",
    model: model.id,
    tokensIn: assessment.inputTokens,
    tokensOut: expectedOutputTokens,
    latencyMs: Date.now() - _start,
    orgId: keyRecord.id,
    promptText: prompt,
    source,
  });

  // 7. Build and return response
  const costImpact = estimateCostImpact({
    tokens_in: assessment.inputTokens,
    tokens_out: expectedOutputTokens,
    model: model.id,
  });
  const estimatedMonthlyCostUserSpecified = assessment.estimatedCostTotal * requestsPerMonth;

  return NextResponse.json({
    analysis_id: analysisId,
    analysis_version: ANALYSIS_VERSION,
    score_version: assessment.score_version,
    ruleset_hash: RULESET_HASH,
    input_hash: inputHash,
    risk: assessment.riskLevel.toUpperCase(),
    risk_score: assessment.riskScore,
    safety_score: 100 - assessment.riskScore,
    model: model.id,
    input_tokens: assessment.inputTokens,
    is_estimated: assessment.isEstimated,
    estimated_cost_per_request: formatCostValue(costImpact.estimated_cost_per_call),
    estimated_cost_per_1k_calls: formatCostValue(costImpact.estimated_cost_per_1k_calls),
    estimated_monthly_cost: formatCostValue(estimatedMonthlyCostUserSpecified),
    recommended_model: recommendedModelId,
    share_url: shareResult?.absoluteUrl ?? null,
    explanation: assessment.explanation,
  });
  } catch (err) {
    void logRequestError("/api/v1/analyze", 500, source);
    console.error("[/api/v1/analyze] unhandled error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
