import { NextResponse } from "next/server";
import { verifyApiKey, checkFreeTierLimit } from "@/lib/api-keys/verify-api-key";
import { countTokens } from "@/lib/tokenizer";
import { assessRisk } from "@/lib/risk";
import { createShareReport } from "@/lib/reports/create-share-report";
import { recordAiUsageEvent } from "@/lib/telemetry/ai-usage-event";
import { ANALYSIS_VERSION, RULESET_HASH, hashInput } from "@/lib/trust";
import { estimateCostImpact } from "@/lib/cost-estimator";
import {
  MODEL_CATALOG,
  DEFAULT_MODEL,
  DEFAULT_EXPECTED_OUTPUT,
  resolveModel,
} from "@/lib/ai/models";

export const dynamic = "force-dynamic";

function formatCostValue(amount: number): number {
  return parseFloat(amount.toFixed(amount >= 0.01 ? 2 : 4));
}

export async function POST(req: Request) {
  const _start = Date.now();
  const analysisId = crypto.randomUUID();
  // 1. Verify API key
  const apiKey = req.headers.get("x-api-key") ?? "";
  const keyRecord = await verifyApiKey(apiKey);
  if (!keyRecord) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  // 1b. Enforce free-tier monthly limit
  if (keyRecord.plan === "free") {
    const { allowed } = await checkFreeTierLimit(keyRecord.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Free tier monthly analysis limit reached", plan: "free", limit: 100 },
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

  // 6. Record usage event (fire-and-forget)
  void recordAiUsageEvent({
    endpoint: "/api/v1/analyze",
    model: model.id,
    tokensIn: assessment.inputTokens,
    tokensOut: expectedOutputTokens,
    latencyMs: Date.now() - _start,
    orgId: keyRecord.id,
    promptText: prompt,
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
}
