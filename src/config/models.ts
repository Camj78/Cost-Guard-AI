/**
 * @deprecated Prefer importing directly from "@/lib/ai/models".
 * This file re-exports the full model catalog for backward compatibility.
 * All existing imports of MODELS, DEFAULT_MODEL_ID, ModelConfig, etc. continue to work.
 */

export type { TokenStrategy, Provider, ModelConfig } from "@/lib/ai/models";

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
} from "@/lib/ai/models";
