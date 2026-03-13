import * as fs from "fs";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PolicyConfig {
  max_risk_score?: number;
  max_prompt_tokens?: number;
  block_injection_risk?: boolean;
  require_schema_constraints?: boolean;
}

export interface PolicyViolation {
  rule: string;
  message: string;
  file?: string;
}

// ── Policy loading ────────────────────────────────────────────────────────────

export function loadPolicy(policyPath: string): PolicyConfig | null {
  if (!fs.existsSync(policyPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(policyPath, "utf8")) as PolicyConfig;
  } catch {
    return null;
  }
}

// ── Policy evaluation ─────────────────────────────────────────────────────────

export function evaluatePolicy(
  policy: PolicyConfig,
  files: Array<{
    file: string;
    risk_score: number;
    input_tokens: number;
    risk_drivers: Array<{ name: string; impact: number }>;
  }>,
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const f of files) {
    // max_risk_score: block files with risk score above the limit
    if (
      policy.max_risk_score !== undefined &&
      f.risk_score > policy.max_risk_score
    ) {
      violations.push({
        rule: "max_risk_score",
        message: `Risk score ${f.risk_score} exceeds policy limit of ${policy.max_risk_score}`,
        file: f.file,
      });
    }

    // max_prompt_tokens: block prompts exceeding token budget
    if (
      policy.max_prompt_tokens !== undefined &&
      f.input_tokens > policy.max_prompt_tokens
    ) {
      violations.push({
        rule: "max_prompt_tokens",
        message: `Token count ${f.input_tokens} exceeds policy limit of ${policy.max_prompt_tokens}`,
        file: f.file,
      });
    }

    // block_injection_risk: flag files with high structural/injection risk
    if (policy.block_injection_risk === true) {
      const structuralDriver = f.risk_drivers.find((d) =>
        d.name.toLowerCase().includes("structural"),
      );
      if (structuralDriver && structuralDriver.impact >= 60 && f.risk_score >= 60) {
        violations.push({
          rule: "block_injection_risk",
          message: `High structural/injection risk detected (risk score: ${f.risk_score}, structural impact: ${structuralDriver.impact})`,
          file: f.file,
        });
      }
    }

    // require_schema_constraints: require explicit output format / schema in prompt
    if (policy.require_schema_constraints === true) {
      const structuralDriver = f.risk_drivers.find((d) =>
        d.name.toLowerCase().includes("structural"),
      );
      if (structuralDriver && structuralDriver.impact >= 60) {
        violations.push({
          rule: "require_schema_constraints",
          message: `Missing schema/output constraints (Structural Risk impact: ${structuralDriver.impact})`,
          file: f.file,
        });
      }
    }
  }

  return violations;
}
