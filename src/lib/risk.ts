/**
 * Failure Risk Score (heuristic) engine.
 * Scoring: 0-100 based on 5 weighted factors.
 * Explanation: deterministic, top 2-3 factors by points descending.
 */

import type { TokenStrategy } from "@/config/models";

// --- Types ---

export type RiskLevel = "safe" | "low" | "warning" | "high" | "critical";

export interface RiskFactor {
  name: string;
  points: number;
  template: string;
}

export interface TruncationLevel {
  level: "safe" | "warning" | "danger";
  message: string;
}

export interface RiskAssessment {
  // Inputs (echoed back for display)
  inputTokens: number;
  contextWindow: number;
  maxOutputTokens: number;
  expectedOutputTokens: number;

  // Derived
  remaining: number;
  usageRatio: number;
  usagePercent: number;

  // Cost
  estimatedCostInput: number;
  estimatedCostOutput: number;
  estimatedCostTotal: number;

  // Failure Risk Score (heuristic)
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskExplanation: string;

  // Truncation (separate UI signal)
  truncation: TruncationLevel;

  // Token estimation metadata
  isEstimated: boolean;
}

// --- Risk level mapping ---

function getRiskLevel(score: number): RiskLevel {
  if (score <= 24) return "safe";
  if (score <= 49) return "low";
  if (score <= 69) return "warning";
  if (score <= 84) return "high";
  return "critical";
}

// --- Deterministic explanation templates ---

function buildExplanation(factors: RiskFactor[]): string {
  const sorted = [...factors]
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points);

  const top = sorted.slice(0, 3);
  if (top.length === 0) return "No significant risk factors detected.";

  return top.map((f) => f.template).join(". ") + ".";
}

// --- Main scoring function ---

export interface RiskInputs {
  inputTokens: number;
  contextWindow: number;
  expectedOutputTokens: number;
  maxOutputTokens: number;
  compressionDelta: number; // (1 - compressedTokens / inputTokens) * 100
  tokenStrategy: TokenStrategy;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

export function assessRisk(inputs: RiskInputs): RiskAssessment {
  const {
    inputTokens,
    contextWindow,
    expectedOutputTokens,
    maxOutputTokens,
    compressionDelta,
    tokenStrategy,
    inputPricePer1M,
    outputPricePer1M,
  } = inputs;

  const remaining = Math.max(0, contextWindow - inputTokens);
  const usageRatio = contextWindow > 0 ? inputTokens / contextWindow : 0;
  const usagePercent = usageRatio * 100;

  // --- 1. Context Pressure (0-40 pts) ---
  let contextPressurePts = 0;
  if (usageRatio >= 1.0) contextPressurePts = 40;
  else if (usageRatio >= 0.9) contextPressurePts = 30;
  else if (usageRatio >= 0.8) contextPressurePts = 20;
  else if (usageRatio >= 0.7) contextPressurePts = 10;

  // --- 2. Output Collision Risk (0-25 pts) ---
  let collisionPts = 0;
  if (remaining <= expectedOutputTokens) collisionPts = 25;
  else if (remaining <= expectedOutputTokens * 1.5) collisionPts = 15;
  else if (remaining <= expectedOutputTokens * 2) collisionPts = 5;

  // --- 3. Output Cap Constraint (0-15 pts) ---
  let capPts = 0;
  if (expectedOutputTokens > maxOutputTokens) capPts = 15;
  else if (expectedOutputTokens > maxOutputTokens * 0.8) capPts = 8;

  // --- 4. Verbosity / Inefficiency (0-10 pts) ---
  let verbosityPts = 0;
  if (compressionDelta >= 25) verbosityPts = 10;
  else if (compressionDelta >= 15) verbosityPts = 5;

  // --- 5. Estimation Uncertainty (0-10 pts) ---
  let uncertaintyPts = 0;
  if (tokenStrategy === "estimated") {
    uncertaintyPts += 5;
    if (usageRatio >= 0.85) uncertaintyPts += 5;
  }

  // --- Build factors for explanation ---
  const factors: RiskFactor[] = [
    {
      name: "Context Pressure",
      points: contextPressurePts,
      template: `${usagePercent.toFixed(1)}% of context window used`,
    },
    {
      name: "Output Collision",
      points: collisionPts,
      template: `Only ${remaining.toLocaleString()} tokens remain for an expected ${expectedOutputTokens.toLocaleString()}-token response`,
    },
    {
      name: "Output Cap",
      points: capPts,
      template: `Expected output (${expectedOutputTokens.toLocaleString()}) exceeds model's ${maxOutputTokens.toLocaleString()}-token output limit`,
    },
    {
      name: "Verbosity",
      points: verbosityPts,
      template: `Prompt could be compressed by ~${compressionDelta.toFixed(0)}% to reduce risk`,
    },
    {
      name: "Uncertainty",
      points: uncertaintyPts,
      template: "Token count is estimated \u2014 actual usage may vary",
    },
  ];

  // --- Sum + floors + cap ---
  let riskScore =
    contextPressurePts + collisionPts + capPts + verbosityPts + uncertaintyPts;

  // Risk floor rules
  if (usageRatio >= 1.0) {
    riskScore = 100;
  } else if (usageRatio >= 0.95) {
    riskScore = Math.max(riskScore, 85);
  }

  riskScore = Math.min(riskScore, 100);

  // --- Truncation (separate signal) ---
  let truncation: TruncationLevel;
  if (remaining < expectedOutputTokens) {
    truncation = {
      level: "danger",
      message: `Only ${remaining.toLocaleString()} tokens remain for a ${expectedOutputTokens.toLocaleString()}-token response. Output will likely be truncated.`,
    };
  } else if (remaining < expectedOutputTokens * 1.5) {
    truncation = {
      level: "warning",
      message: `${remaining.toLocaleString()} tokens remain. Long responses may be cut short.`,
    };
  } else {
    truncation = {
      level: "safe",
      message: `${remaining.toLocaleString()} tokens available for output.`,
    };
  }

  // --- Cost ---
  const estimatedCostInput = (inputTokens / 1_000_000) * inputPricePer1M;
  const estimatedCostOutput =
    (expectedOutputTokens / 1_000_000) * outputPricePer1M;
  const estimatedCostTotal = estimatedCostInput + estimatedCostOutput;

  return {
    inputTokens,
    contextWindow,
    maxOutputTokens,
    expectedOutputTokens,
    remaining,
    usageRatio,
    usagePercent,
    estimatedCostInput,
    estimatedCostOutput,
    estimatedCostTotal,
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    riskFactors: factors,
    riskExplanation: buildExplanation(factors),
    truncation,
    isEstimated: tokenStrategy === "estimated",
  };
}

/**
 * Shared helper: compute per-request cost from token counts and model pricing.
 * Used by assessRisk internally and by CostAtScalePanel for comparison models.
 */
export function computeRequestCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePer1M: number,
  outputPricePer1M: number,
): number {
  return (inputTokens / 1_000_000) * inputPricePer1M
    + (outputTokens / 1_000_000) * outputPricePer1M;
}
