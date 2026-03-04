/**
 * Share link snapshot schema — strict allowlist validation.
 * Client sends { analysis, modelId }; server injects modelName + pricingLastUpdated.
 * No prompt text is ever accepted or stored.
 */

import {
  RISK_LEVELS,
  type RiskAssessment,
  type RiskDriver,
  type RiskFactor,
  type TruncationLevel,
} from "@/lib/risk";
import { resolveModel } from "@/lib/ai/models";

const TRUNCATION_LEVELS = ["safe", "warning", "danger"] as const;
const SNAPSHOT_SIZE_LIMIT = 16_384; // 16 KB

export interface ShareSnapshot {
  analysis: RiskAssessment;
  modelId: string;
  modelName: string;          // server-injected
  pricingLastUpdated: string; // server-injected
}

/**
 * Validates the client-provided portion of the snapshot ({ analysis, modelId }).
 * Returns a fresh, allowlisted object — never passes raw input through.
 * Returns null if any field fails validation.
 */
export function validateClientSnapshot(
  raw: unknown
): { analysis: RiskAssessment; modelId: string } | null {
  if (typeof raw !== "object" || raw === null) return null;

  // Size cap — reject oversized payloads before deep inspection
  const serialized = JSON.stringify(raw);
  if (serialized.length > SNAPSHOT_SIZE_LIMIT) return null;

  const obj = raw as Record<string, unknown>;

  // --- modelId ---
  const modelId = obj.modelId;
  if (typeof modelId !== "string") return null;
  if (!resolveModel(modelId)) return null;

  // --- analysis ---
  const a = obj.analysis;
  if (typeof a !== "object" || a === null) return null;
  const analysis = a as Record<string, unknown>;

  // Numeric fields
  const numFields = [
    "inputTokens",
    "contextWindow",
    "maxOutputTokens",
    "expectedOutputTokens",
    "remaining",
    "usageRatio",
    "usagePercent",
    "estimatedCostInput",
    "estimatedCostOutput",
    "estimatedCostTotal",
  ] as const;
  for (const field of numFields) {
    if (!Number.isFinite(analysis[field] as number)) return null;
  }

  // riskScore: integer 0–100
  const riskScore = analysis.riskScore;
  if (
    typeof riskScore !== "number" ||
    !Number.isFinite(riskScore) ||
    riskScore < 0 ||
    riskScore > 100
  )
    return null;

  // riskLevel: runtime enum check
  const riskLevel = analysis.riskLevel;
  if (typeof riskLevel !== "string") return null;
  if (!(RISK_LEVELS as readonly string[]).includes(riskLevel)) return null;

  // riskExplanation: string, max 500 chars
  const riskExplanation = analysis.riskExplanation;
  if (typeof riskExplanation !== "string" || riskExplanation.length > 500) return null;

  // isEstimated: boolean
  if (typeof analysis.isEstimated !== "boolean") return null;

  // riskFactors: array, max 5 items
  if (!Array.isArray(analysis.riskFactors)) return null;
  if (analysis.riskFactors.length > 5) return null;
  const riskFactors: RiskFactor[] = [];
  for (const rf of analysis.riskFactors) {
    if (typeof rf !== "object" || rf === null) return null;
    const f = rf as Record<string, unknown>;
    if (typeof f.name !== "string" || f.name.length > 50) return null;
    if (!Number.isFinite(f.points as number)) return null;
    if (typeof f.template !== "string" || f.template.length > 200) return null;
    riskFactors.push({
      name: f.name,
      points: f.points as number,
      template: f.template,
    });
  }

  // riskDrivers: array, max 3 items
  if (!Array.isArray(analysis.riskDrivers)) return null;
  if (analysis.riskDrivers.length > 3) return null;
  const riskDrivers: RiskDriver[] = [];
  for (const rd of analysis.riskDrivers) {
    if (typeof rd !== "object" || rd === null) return null;
    const d = rd as Record<string, unknown>;
    if (typeof d.name !== "string" || d.name.length > 50) return null;
    if (!Number.isFinite(d.impact as number)) return null;
    if (!Array.isArray(d.fixes)) return null;
    if (d.fixes.length > 5) return null;
    const fixes: string[] = [];
    for (const fix of d.fixes) {
      if (typeof fix !== "string" || fix.length > 200) return null;
      fixes.push(fix);
    }
    riskDrivers.push({ name: d.name, impact: d.impact as number, fixes });
  }

  // truncation
  const trunc = analysis.truncation;
  if (typeof trunc !== "object" || trunc === null) return null;
  const truncObj = trunc as Record<string, unknown>;
  if (
    typeof truncObj.level !== "string" ||
    !(TRUNCATION_LEVELS as readonly string[]).includes(truncObj.level)
  )
    return null;
  if (typeof truncObj.message !== "string" || truncObj.message.length > 300) return null;
  const truncation: TruncationLevel = {
    level: truncObj.level as TruncationLevel["level"],
    message: truncObj.message,
  };

  // Construct fresh, allowlisted RiskAssessment
  const validatedAnalysis: RiskAssessment = {
    inputTokens: analysis.inputTokens as number,
    contextWindow: analysis.contextWindow as number,
    maxOutputTokens: analysis.maxOutputTokens as number,
    expectedOutputTokens: analysis.expectedOutputTokens as number,
    remaining: analysis.remaining as number,
    usageRatio: analysis.usageRatio as number,
    usagePercent: analysis.usagePercent as number,
    estimatedCostInput: analysis.estimatedCostInput as number,
    estimatedCostOutput: analysis.estimatedCostOutput as number,
    estimatedCostTotal: analysis.estimatedCostTotal as number,
    riskScore,
    riskLevel: riskLevel as RiskAssessment["riskLevel"],
    riskFactors,
    riskExplanation,
    riskDrivers,
    truncation,
    isEstimated: analysis.isEstimated as boolean,
  };

  return { analysis: validatedAnalysis, modelId };
}
