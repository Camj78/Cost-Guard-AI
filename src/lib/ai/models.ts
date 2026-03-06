/**
 * CostGuardAI — AI Model Catalog
 * Re-exports from @costguard/core (packages/core/src/models.ts).
 * All existing imports of MODELS, DEFAULT_MODEL_ID, ModelConfig, etc. continue to work.
 */

export type { TokenStrategy, Provider, ModelConfig } from "../../../packages/core/src/models";

export {
  pricingLastUpdated,
  MODEL_CATALOG,
  MODELS,
  COMPAT_MAP,
  DEFAULT_MODEL,
  DEFAULT_MODEL_ID,
  DEFAULT_EXPECTED_OUTPUT,
  MIN_EXPECTED_OUTPUT,
  resolveModel,
  validateModel,
} from "../../../packages/core/src/models";
