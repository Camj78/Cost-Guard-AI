/**
 * CostGuardAI — Cost Estimator re-export
 * Re-exports from @costguard/core. Import from this path within the web app.
 */

export {
  estimateCostImpact,
  MONTHLY_CALL_BASELINE,
} from "../../packages/core/src/cost-estimator";
export type { CostImpact } from "../../packages/core/src/cost-estimator";

export {
  estimateModelCost,
  MODEL_PRICING,
} from "../../packages/core/src/model-pricing";
export type { ModelPricing } from "../../packages/core/src/model-pricing";
