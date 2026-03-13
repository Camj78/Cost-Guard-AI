/**
 * CostGuardAI — Explanation Builder
 * Vendored copy for self-contained CLI distribution.
 * Source of truth: packages/core/src/explanation-builder.ts
 */

import { DRIVER_EXPLANATIONS, type Explanation } from "./explanations";

interface RiskDriverRef {
  name: string;
  impact: number;
  fixes: string[];
}

const RISK_BAND_LABELS: Record<string, string> = {
  safe: "Safe",
  low: "Low",
  warning: "Warning",
  high: "High",
  critical: "Critical",
};

export function buildExplanation(
  riskScore: number,
  riskLevel: string,
  riskDrivers: RiskDriverRef[]
): Explanation {
  const band = RISK_BAND_LABELS[riskLevel] ?? riskLevel;

  const top_risk_drivers = riskDrivers
    .filter((d) => d.impact > 5)
    .map((d) => d.name);

  const seenFactors = new Set<string>();
  const contributing_factors: string[] = [];
  for (const driver of riskDrivers) {
    if (driver.impact <= 5) continue;
    const meta = DRIVER_EXPLANATIONS[driver.name];
    if (!meta) continue;
    for (const factor of meta.contributing_factors) {
      if (!seenFactors.has(factor)) {
        seenFactors.add(factor);
        contributing_factors.push(factor);
      }
    }
  }

  const seenMitigations = new Set<string>();
  const mitigation_suggestions: string[] = [];
  for (const driver of riskDrivers) {
    for (const fix of driver.fixes) {
      if (!seenMitigations.has(fix)) {
        seenMitigations.add(fix);
        mitigation_suggestions.push(fix);
      }
    }
  }

  if (mitigation_suggestions.length === 0 && riskDrivers.length > 0) {
    const meta = DRIVER_EXPLANATIONS[riskDrivers[0].name];
    if (meta) {
      for (const m of meta.base_mitigations.slice(0, 2)) {
        mitigation_suggestions.push(m);
      }
    }
  }

  let summary: string;
  if (top_risk_drivers.length === 0) {
    summary = `RiskScore ${riskScore} (${band}). No significant risk drivers detected.`;
  } else if (top_risk_drivers.length === 1) {
    summary = `RiskScore ${riskScore} (${band}) driven primarily by ${top_risk_drivers[0]}.`;
  } else {
    summary = `RiskScore ${riskScore} (${band}) driven primarily by ${top_risk_drivers[0]} and ${top_risk_drivers[1]}.`;
  }

  return {
    summary,
    top_risk_drivers,
    contributing_factors,
    mitigation_suggestions,
  };
}
