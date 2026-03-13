/**
 * CostGuardAI — Prompt Structure Signature
 *
 * Pure functions for deriving a structural fingerprint from a RiskAssessment.
 * No raw prompt text. No platform-specific APIs.
 * Safe to import in both server (Node.js) and client (browser) contexts.
 */

import type { RiskAssessment } from "@/lib/risk";

/**
 * Coarse token band — groups prompts by size class without revealing exact counts.
 * Keeps the fingerprint stable across minor token count variations.
 */
export function tokenBand(tokens: number): string {
  if (tokens < 200) return "xs";
  if (tokens < 500) return "sm";
  if (tokens < 1000) return "md";
  if (tokens < 2000) return "lg";
  if (tokens < 4000) return "xl";
  return "xxl";
}

/**
 * Builds a deterministic structure signature from a RiskAssessment.
 *
 * Inputs: token band + all 5 weighted risk factor scores (sorted for stability).
 * No raw prompt text is used — only structural metrics produced by the risk engine.
 *
 * Example output:
 *   "band:lg|Ambiguity Risk:9|Context Saturation Risk:6|Length Risk:8|Output Volatility Risk:4|Structural Risk:20"
 */
export function buildStructureSignature(assessment: RiskAssessment): string {
  const band = tokenBand(assessment.inputTokens);

  // Sort alphabetically so signature is stable regardless of riskFactors array order
  const factors = assessment.riskFactors
    .map((f) => `${f.name}:${f.points}`)
    .sort()
    .join("|");

  return `band:${band}|${factors}`;
}

/**
 * Derives the primary risk classification from the dominant risk driver.
 * Used to categorize incidents and CVEs into actionable risk types.
 */
export function deriveRiskType(assessment: RiskAssessment): string {
  // Sort all drivers by impact descending; top driver determines risk type
  const top = [...assessment.riskDrivers].sort((a, b) => b.impact - a.impact)[0];
  if (!top) return "structural_failure";

  const name = top.name.toLowerCase();
  if (name.includes("ambiguity")) return "instruction_ambiguity";
  if (name.includes("volatility")) return "token_explosion";
  if (name.includes("saturation")) return "context_overflow";
  if (name.includes("length")) return "token_explosion";
  return "structural_failure";
}

/**
 * Derives the top mitigation suggestion from the assessment's risk drivers.
 * Returns the first fix from the highest-impact driver, or null if none.
 */
export function deriveTopMitigation(assessment: RiskAssessment): string | null {
  const top = [...assessment.riskDrivers].sort((a, b) => b.impact - a.impact)[0];
  if (!top || top.fixes.length === 0) return null;
  return top.fixes[0];
}
