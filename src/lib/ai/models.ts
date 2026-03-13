/**
 * CostGuardAI — AI Model Catalog
 * Single source of truth for all provider model data.
 *
 * To add a model:    append to MODEL_CATALOG, bump pricingLastUpdated.
 * To retire a model: add its id to COMPAT_MAP → replacement id.
 * To change default: update DEFAULT_MODEL.
 *
 * pricingLastUpdated must be bumped on every pricing change.
 */

export const pricingLastUpdated = "2026-01-01";

export type TokenStrategy = "exact" | "estimated";
export type Provider = "openai" | "anthropic" | "google" | "meta";

export interface ModelConfig {
  id: string;
  name: string;
  provider: Provider;
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePer1M: number;
  outputPricePer1M: number;
  tikTokenEncoding: string;
  tokenStrategy: TokenStrategy;
  correctionFactor: number;
}

export const MODEL_CATALOG: ModelConfig[] = [
  // --- OpenAI (exact tokenization via js-tiktoken) ---
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputPricePer1M: 2.5,
    outputPricePer1M: 10.0,
    tikTokenEncoding: "o200k_base",
    tokenStrategy: "exact",
    correctionFactor: 1.0,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.6,
    tikTokenEncoding: "o200k_base",
    tokenStrategy: "exact",
    correctionFactor: 1.0,
  },
  // --- Anthropic (estimated via cl100k_base * correctionFactor) ---
  // Replaces: claude-sonnet-4 → claude-sonnet-4-6
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    inputPricePer1M: 3.0,
    outputPricePer1M: 15.0,
    tikTokenEncoding: "cl100k_base",
    tokenStrategy: "estimated",
    correctionFactor: 1.05,
  },
  // Replaces: claude-3.5-haiku → claude-haiku-4-5
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    inputPricePer1M: 0.8,
    outputPricePer1M: 4.0,
    tikTokenEncoding: "cl100k_base",
    tokenStrategy: "estimated",
    correctionFactor: 1.05,
  },
  // --- Google (estimated) ---
  // Replaces: gemini-1.5-pro → gemini-2.0-flash → gemini-2.5-flash-lite
  // gemini-2.5-flash-lite is the current non-retiring successor per Google/Firebase guidance.
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    inputPricePer1M: 0.075,
    outputPricePer1M: 0.3,
    tikTokenEncoding: "cl100k_base",
    tokenStrategy: "estimated",
    correctionFactor: 1.08,
  },
  // --- Meta (estimated, priced at typical hosted API rates) ---
  // Replaces: llama-3.1-70b → llama-3.3-70b
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B",
    provider: "meta",
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    inputPricePer1M: 0.59,
    outputPricePer1M: 0.79,
    tikTokenEncoding: "cl100k_base",
    tokenStrategy: "estimated",
    correctionFactor: 1.1,
  },
];

/**
 * Backward-compatibility map: deprecated model id → current model id.
 * resolveModel() applies this silently so old stored IDs keep working.
 */
export const COMPAT_MAP: Record<string, string> = {
  // Anthropic renames
  "claude-sonnet-4":           "claude-sonnet-4-6",
  "claude-3.5-haiku":          "claude-haiku-4-5",
  "claude-3-5-sonnet-20241022":"claude-sonnet-4-6",
  "claude-3-5-haiku-20241022": "claude-haiku-4-5",
  // Google deprecations (chain: 1.5-pro → 2.0-flash → 2.5-flash-lite)
  "gemini-1.5-pro":            "gemini-2.5-flash-lite",
  "gemini-1.5-flash":          "gemini-2.5-flash-lite",
  "gemini-2.0-flash":          "gemini-2.5-flash-lite",
  // Meta updates
  "llama-3.1-70b":             "llama-3.3-70b",
  "llama-3.1-8b":              "llama-3.3-70b",
};

/**
 * Default model: best performance/cost balance.
 * gpt-4o-mini — $0.15/$0.60 per 1M tokens, exact tokenization.
 */
export const DEFAULT_MODEL = "gpt-4o-mini";

/** Alias for backward compatibility with harness imports. */
export const DEFAULT_MODEL_ID = DEFAULT_MODEL;

export const DEFAULT_EXPECTED_OUTPUT = 512;
export const MIN_EXPECTED_OUTPUT = 256;

/**
 * Canonical MODELS array — backward-compatible alias for MODEL_CATALOG.
 * All existing code that imports MODELS from @/config/models continues to work.
 */
export const MODELS = MODEL_CATALOG;

/**
 * Resolve a model ID, applying COMPAT_MAP if the ID is deprecated.
 * Returns ModelConfig if found, null for completely unknown IDs.
 * Use this for all model lookups so stale IDs keep resolving correctly.
 */
export function resolveModel(id: string): ModelConfig | null {
  const canonical = COMPAT_MAP[id] ?? id;
  return MODEL_CATALOG.find((m) => m.id === canonical) ?? null;
}

/**
 * Strict catalog lookup — no compat mapping applied.
 * Returns ModelConfig only for current canonical IDs.
 * Use when you explicitly want to reject deprecated IDs.
 */
export function validateModel(id: string): ModelConfig | null {
  return MODEL_CATALOG.find((m) => m.id === id) ?? null;
}
