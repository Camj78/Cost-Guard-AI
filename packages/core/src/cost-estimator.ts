/**
 * CostGuardAI — Deterministic Cost Impact Estimator
 * No external dependencies, no runtime fetches.
 * Same inputs always produce same outputs.
 */

import { estimateModelCost } from "./model-pricing";

/** Static monthly call baseline used for the estimated_monthly_cost field. */
export const MONTHLY_CALL_BASELINE = 100_000;

export interface CostImpact {
  /** Cost per single request (USD) */
  estimated_cost_per_call: number;
  /** Cost per 1,000 requests (USD) */
  estimated_cost_per_1k_calls: number;
  /** Estimated monthly cost at MONTHLY_CALL_BASELINE calls/month (USD) */
  estimated_monthly_cost: number;
}

/**
 * Compute deterministic cost impact for a given prompt + model.
 * Uses static MODEL_PRICING — no network calls, no side effects.
 */
export function estimateCostImpact({
  tokens_in,
  tokens_out,
  model,
}: {
  tokens_in: number;
  tokens_out: number;
  model: string;
}): CostImpact {
  const estimated_cost_per_call = estimateModelCost(tokens_in, tokens_out, model);
  const estimated_cost_per_1k_calls = estimated_cost_per_call * 1000;
  const estimated_monthly_cost = estimated_cost_per_call * MONTHLY_CALL_BASELINE;
  return {
    estimated_cost_per_call,
    estimated_cost_per_1k_calls,
    estimated_monthly_cost,
  };
}
