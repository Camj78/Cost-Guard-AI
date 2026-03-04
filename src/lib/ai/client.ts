/**
 * CostGuardAI — AI Provider Client Abstraction
 *
 * This is the single designated integration point for all AI provider calls.
 * CostGuardAI currently performs local analysis (tokenization + cost math) and
 * does NOT call provider APIs directly.
 *
 * This wrapper exists as the hook for future provider integrations:
 *   D3 — Public API endpoint
 *   D6 — Risk intelligence refinement (live model sampling)
 *
 * HARD RULE: All future live provider calls MUST route through callProvider().
 * Never instantiate provider SDKs (OpenAI, Anthropic, Google) outside this file.
 * Never expose provider API keys to the client layer.
 *
 * Usage (future):
 *   import { callProvider } from "@/lib/ai/client"
 *   const result = await callProvider({ model: "gpt-4o-mini", messages: [...] })
 */

export type { ModelConfig, TokenStrategy, Provider } from "@/lib/ai/models";

export {
  MODEL_CATALOG,
  MODELS,
  COMPAT_MAP,
  DEFAULT_MODEL,
  DEFAULT_MODEL_ID,
  DEFAULT_EXPECTED_OUTPUT,
  MIN_EXPECTED_OUTPUT,
  pricingLastUpdated,
  resolveModel,
  validateModel,
} from "@/lib/ai/models";

// ─── Provider Call Interface ───────────────────────────────────────────────

export interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ProviderCallOptions {
  /** Model ID — deprecated IDs are resolved via COMPAT_MAP. */
  model: string;
  messages: ProviderMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderCallResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// ─── Provider Router ───────────────────────────────────────────────────────

/**
 * Route a completion request to the correct provider SDK.
 * Not yet implemented — placeholder for D3/D6 phases.
 * Throws with a descriptive message including the resolved model.
 */
export async function callProvider(
  options: ProviderCallOptions
): Promise<ProviderCallResult> {
  const { resolveModel, MODEL_CATALOG } = await import("@/lib/ai/models");

  const model = resolveModel(options.model);
  if (!model) {
    const validIds = MODEL_CATALOG.map((m) => m.id).join(", ");
    throw new Error(
      `callProvider: unknown model "${options.model}". Valid IDs: ${validIds}`
    );
  }

  throw new Error(
    `callProvider: live API calls not yet implemented (phase D3). ` +
      `Resolved model: "${model.id}" (provider: ${model.provider}). ` +
      `Use local analysis utilities in src/lib/ for cost and risk calculation.`
  );
}
