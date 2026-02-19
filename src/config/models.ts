// Single source of truth for all model data.
// Update pricingLastUpdated when prices change.

export const pricingLastUpdated = "2025-05-01";

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

export const MODELS: ModelConfig[] = [
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
  {
    id: "claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    inputPricePer1M: 3.0,
    outputPricePer1M: 15.0,
    tikTokenEncoding: "cl100k_base",
    tokenStrategy: "estimated",
    correctionFactor: 1.05,
  },
  {
    id: "claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
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
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    inputPricePer1M: 1.25,
    outputPricePer1M: 5.0,
    tikTokenEncoding: "cl100k_base",
    tokenStrategy: "estimated",
    correctionFactor: 1.08,
  },
  // --- Meta (estimated, priced at typical hosted API rates) ---
  {
    id: "llama-3.1-70b",
    name: "Llama 3.1 70B",
    provider: "meta",
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    inputPricePer1M: 0.88,
    outputPricePer1M: 0.88,
    tikTokenEncoding: "cl100k_base",
    tokenStrategy: "estimated",
    correctionFactor: 1.1,
  },
];

export const DEFAULT_MODEL_ID = "gpt-4o";
export const DEFAULT_EXPECTED_OUTPUT = 512;
export const MIN_EXPECTED_OUTPUT = 256;
