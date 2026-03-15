/**
 * CostGuardAI — CostGuardAI Safety Score engine
 * Re-exports from @costguard/core (packages/core/src/risk.ts).
 * All existing imports continue to work.
 */

export type { RiskLevel, RiskFactor, RiskDriver, TruncationLevel, RiskAssessment, RiskInputs } from "../../packages/core/src/risk";

export {
  SCORE_VERSION,
  RISK_LEVELS,
  getRiskLevel,
  AMBIGUOUS_TERMS,
  VOLATILITY_PHRASES,
  SCORING_WEIGHTS,
  assessRisk,
  computeRequestCost,
} from "../../packages/core/src/risk";

export type { Explanation, DriverExplanationMeta } from "../../packages/core/src/explanations";
export { DRIVER_EXPLANATIONS } from "../../packages/core/src/explanations";
export { buildExplanation } from "../../packages/core/src/explanation-builder";
