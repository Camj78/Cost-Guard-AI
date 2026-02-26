/**
 * Failure Risk Score engine — structured, weighted, deterministic.
 * 5 components: Length, Context Saturation, Ambiguity, Structural, Output Volatility.
 * Final score: weighted sum, 0–100. riskDrivers: top 3 by unweighted bucket score.
 */

import type { TokenStrategy } from "@/config/models";

// --- Types ---

export type RiskLevel = "safe" | "low" | "warning" | "high" | "critical";
export const RISK_LEVELS = ["safe", "low", "warning", "high", "critical"] as const;

export interface RiskFactor {
  name: string;
  points: number;
  template: string;
}

export interface RiskDriver {
  name: string;     // Component name
  impact: number;   // Unweighted bucket score 0–100
  fixes: string[];  // Deterministic fixes for triggered heuristics
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

  // Failure Risk Score
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskExplanation: string;
  riskDrivers: RiskDriver[];

  // Truncation (separate UI signal)
  truncation: TruncationLevel;

  // Token estimation metadata
  isEstimated: boolean;
}

// --- Risk level mapping ---

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 24) return "safe";
  if (score <= 49) return "low";
  if (score <= 69) return "warning";
  if (score <= 84) return "high";
  return "critical";
}

// --- Main scoring function ---

export interface RiskInputs {
  promptText: string;
  inputTokens: number;
  contextWindow: number;
  expectedOutputTokens: number;
  maxOutputTokens: number;
  compressionDelta: number; // (1 - compressedTokens / inputTokens) * 100
  tokenStrategy: TokenStrategy;
  inputPricePer1M: number;
  outputPricePer1M: number;
}

// Ambiguous terms list (exact spec)
const AMBIGUOUS_TERMS = [
  "improve", "optimize", "better", "good", "high quality",
  "fast", "efficient", "robust", "flexible", "clean",
  "scalable", "advanced", "modern",
];

// Volatility phrases list (exact spec)
const VOLATILITY_PHRASES = [
  "write a detailed",
  "comprehensive",
  "in depth",
  "as much as possible",
  "thoroughly explain",
];

export function assessRisk(inputs: RiskInputs): RiskAssessment {
  const {
    promptText,
    inputTokens,
    contextWindow,
    expectedOutputTokens,
    maxOutputTokens,
    tokenStrategy,
    inputPricePer1M,
    outputPricePer1M,
  } = inputs;

  const remaining = Math.max(0, contextWindow - inputTokens);
  const usageRatio = contextWindow > 0 ? inputTokens / contextWindow : 0;
  const usagePercent = usageRatio * 100;

  // ─── 1. Length Risk (25%) ───────────────────────────────────────────────
  const lengthRatio = contextWindow > 0 ? inputTokens / contextWindow : 0;
  let lengthBucket: number;
  if (lengthRatio < 0.15) lengthBucket = 5;
  else if (lengthRatio < 0.30) lengthBucket = 15;
  else if (lengthRatio < 0.50) lengthBucket = 30;
  else if (lengthRatio < 0.70) lengthBucket = 60;
  else lengthBucket = 90;

  const lengthFixes: string[] = [];
  if (lengthBucket === 30)
    lengthFixes.push("Reduce prompt length. Context usage is at 30–50%.");
  else if (lengthBucket === 60)
    lengthFixes.push("Reduce prompt length. Over 50% of context window consumed by input alone.");
  else if (lengthBucket === 90)
    lengthFixes.push("Prompt exceeds 70% of context window. Shorten significantly to reduce truncation risk.");

  const lengthRisk = lengthBucket * 0.25;

  // ─── 2. Context Saturation Risk (20%) ──────────────────────────────────
  const totalTokens = inputTokens + expectedOutputTokens;
  const saturation = contextWindow > 0 ? totalTokens / contextWindow : 0;
  let saturationBucket: number;
  if (saturation < 0.50) saturationBucket = 5;
  else if (saturation < 0.70) saturationBucket = 30;
  else if (saturation < 0.85) saturationBucket = 65;
  else saturationBucket = 95;

  const saturationFixes: string[] = [];
  if (saturationBucket === 30)
    saturationFixes.push("Combined input + output token count at 50–70% of context limit.");
  else if (saturationBucket === 65)
    saturationFixes.push("Combined token usage at 70–85% of context limit. Reduce prompt length or expected output tokens.");
  else if (saturationBucket === 95)
    saturationFixes.push("Combined token usage exceeds 85% of context limit. High truncation risk — reduce input or expected output.");

  const contextRisk = saturationBucket * 0.20;

  // ─── 3. Ambiguity Risk (20%) ────────────────────────────────────────────
  const lower = promptText.toLowerCase();
  const totalWords = promptText.trim().length > 0
    ? promptText.trim().split(/\s+/).length
    : 0;

  let ambiguousMatches = 0;
  const matchedTerms: string[] = [];
  for (const term of AMBIGUOUS_TERMS) {
    let pos = 0;
    let found = false;
    while ((pos = lower.indexOf(term, pos)) !== -1) {
      ambiguousMatches++;
      found = true;
      pos += term.length;
    }
    if (found) matchedTerms.push(term);
  }

  const ambiguityDensity = totalWords > 0 ? ambiguousMatches / totalWords : 0;
  let ambiguityBucket: number;
  if (ambiguousMatches === 0) ambiguityBucket = 5;
  else if (ambiguityDensity < 0.01) ambiguityBucket = 20;
  else if (ambiguityDensity < 0.02) ambiguityBucket = 45;
  else if (ambiguityDensity < 0.04) ambiguityBucket = 70;
  else ambiguityBucket = 90;

  const ambiguityFixes: string[] = [];
  if (ambiguityBucket >= 20) {
    const termList = matchedTerms.slice(0, 4).map((t) => `'${t}'`).join(", ");
    if (ambiguityBucket === 20)
      ambiguityFixes.push(`Vague term(s) detected: ${termList}. Replace with specific, measurable requirements.`);
    else if (ambiguityBucket === 45)
      ambiguityFixes.push(`Ambiguous term density at 1–2%. Replace: ${termList}. Use explicit, measurable criteria.`);
    else if (ambiguityBucket === 70)
      ambiguityFixes.push(`High ambiguity density (2–4%). Rewrite requirements — remove: ${termList}.`);
    else
      ambiguityFixes.push(`Very high ambiguity density (>4%). Eliminate vague directives. Found: ${termList}.`);
  }

  const ambiguityRisk = ambiguityBucket * 0.20;

  // ─── 4. Structural Risk (20%) ───────────────────────────────────────────
  let structuralSum = 0;
  const structuralFixes: string[] = [];

  // No line breaks
  if (!/\n/.test(promptText)) {
    structuralSum += 20;
    structuralFixes.push("Add line breaks to separate logical sections.");
  }
  // No bullet or numbered list
  if (!/^[\t ]*[-*\d]/m.test(promptText)) {
    structuralSum += 20;
    structuralFixes.push("Use bullet points or numbered lists for multi-step requirements.");
  }
  // No explicit output format directive
  if (
    !/(format|output|return|respond|provide).{0,50}(json|xml|markdown|bullet|numbered|table|list|code)/i.test(
      promptText
    )
  ) {
    structuralSum += 25;
    structuralFixes.push("Add explicit output format instructions (e.g., 'Return JSON with fields: ...').");
  }
  // No constraint words
  if (!/\b(max|limit|exactly|at most|no more than)\b/i.test(promptText)) {
    structuralSum += 20;
    structuralFixes.push("Add constraints using 'max', 'limit', or 'exactly' to bound output.");
  }
  // No headings or delimiters
  if (!/^#{1,3}\s|^---$|^\*\*\w/m.test(promptText)) {
    structuralSum += 15;
    structuralFixes.push("Add section headers or delimiters (e.g., '### Instructions', '---') to structure the prompt.");
  }

  const structuralBucket = Math.min(100, structuralSum);
  const structuralRisk = structuralBucket * 0.20;

  // ─── 5. Output Volatility Risk (15%) ────────────────────────────────────
  let volatilitySum = 0;
  const volatilityFixes: string[] = [];

  for (const phrase of VOLATILITY_PHRASES) {
    if (lower.includes(phrase)) {
      volatilitySum += 25;
      volatilityFixes.push(`Remove open-ended directive: '${phrase}'. Scope the output explicitly.`);
    }
  }
  if (inputTokens > 0 && expectedOutputTokens > 2 * inputTokens) {
    volatilitySum += 30;
    volatilityFixes.push("Expected output exceeds 2× input token count. Reduce expected output tokens or narrow the scope.");
  }

  const volatilityBucket = Math.min(100, volatilitySum);
  const volatilityRisk = volatilityBucket * 0.15;

  // ─── Final score ────────────────────────────────────────────────────────
  const totalRisk = lengthRisk + contextRisk + ambiguityRisk + structuralRisk + volatilityRisk;
  const riskScore = Math.min(100, Math.round(totalRisk));

  // ─── Risk drivers: top 3 by unweighted bucket score ────────────────────
  const allDrivers: RiskDriver[] = [
    { name: "Length Risk", impact: lengthBucket, fixes: lengthFixes },
    { name: "Context Saturation Risk", impact: saturationBucket, fixes: saturationFixes },
    { name: "Ambiguity Risk", impact: ambiguityBucket, fixes: ambiguityFixes },
    { name: "Structural Risk", impact: structuralBucket, fixes: structuralFixes },
    { name: "Output Volatility Risk", impact: volatilityBucket, fixes: volatilityFixes },
  ];
  const riskDrivers = [...allDrivers]
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  // ─── riskFactors (backward compat) ─────────────────────────────────────
  const riskFactors: RiskFactor[] = [
    {
      name: "Length Risk",
      points: Math.round(lengthRisk),
      template: `Input uses ${(lengthRatio * 100).toFixed(1)}% of the context window`,
    },
    {
      name: "Context Saturation Risk",
      points: Math.round(contextRisk),
      template: `Combined tokens (input + output) at ${(saturation * 100).toFixed(1)}% of context limit`,
    },
    {
      name: "Ambiguity Risk",
      points: Math.round(ambiguityRisk),
      template: ambiguousMatches > 0
        ? `${ambiguousMatches} ambiguous term(s) detected in prompt`
        : "No ambiguous terms detected",
    },
    {
      name: "Structural Risk",
      points: Math.round(structuralRisk),
      template: structuralFixes.length > 0
        ? `${structuralFixes.length} structural issue(s) detected`
        : "Prompt has adequate structure",
    },
    {
      name: "Output Volatility Risk",
      points: Math.round(volatilityRisk),
      template: volatilityFixes.length > 0
        ? `${volatilityFixes.length} open-ended output directive(s) detected`
        : "No open-ended output directives detected",
    },
  ];

  // riskExplanation: top contributing components
  const sortedFactors = [...riskFactors]
    .filter((f) => f.points > 0)
    .sort((a, b) => b.points - a.points);
  const riskExplanation =
    sortedFactors.length > 0
      ? sortedFactors
          .slice(0, 3)
          .map((f) => f.template)
          .join(". ") + "."
      : "No significant risk factors detected.";

  // ─── Truncation (separate UI signal) ───────────────────────────────────
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

  // ─── Cost ───────────────────────────────────────────────────────────────
  const estimatedCostInput = (inputTokens / 1_000_000) * inputPricePer1M;
  const estimatedCostOutput = (expectedOutputTokens / 1_000_000) * outputPricePer1M;
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
    riskFactors,
    riskExplanation,
    riskDrivers,
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
