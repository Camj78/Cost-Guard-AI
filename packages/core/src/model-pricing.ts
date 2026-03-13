/**
 * CostGuardAI — Static Model Pricing Table
 * Derived from MODEL_CATALOG — single source of truth.
 * No runtime fetches. All values are deterministic.
 */

import { MODEL_CATALOG } from "./models";

export interface ModelPricing {
  /** Input price per 1,000 tokens (USD) */
  input_per_1k: number;
  /** Output price per 1,000 tokens (USD) */
  output_per_1k: number;
}

/**
 * Per-1k-token pricing for every model in the catalog.
 * Derived from inputPricePer1M / 1000 and outputPricePer1M / 1000.
 */
export const MODEL_PRICING: Record<string, ModelPricing> = Object.fromEntries(
  MODEL_CATALOG.map((m) => [
    m.id,
    {
      input_per_1k: m.inputPricePer1M / 1000,
      output_per_1k: m.outputPricePer1M / 1000,
    },
  ])
);

/**
 * Compute the cost for a single request given token counts and a model ID.
 * Returns 0 if the model is not in the pricing table.
 */
export function estimateModelCost(
  tokens_in: number,
  tokens_out: number,
  model: string
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (tokens_in / 1000) * pricing.input_per_1k +
         (tokens_out / 1000) * pricing.output_per_1k;
}
