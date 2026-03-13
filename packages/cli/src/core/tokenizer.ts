/**
 * CostGuardAI — Token counter.
 * Vendored copy for self-contained CLI distribution.
 * Source of truth: packages/core/src/tokenizer.ts
 */

import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";
import type { ModelConfig } from "./models";

// o200k_base (GPT-4o) lacks a .cjs dist file in js-tiktoken@1.0.21;
// cl100k_base is a close approximation (within ~1% for typical text).
const RANK_DATA: Record<string, typeof cl100k_base> = {
  cl100k_base,
  o200k_base: cl100k_base,
};

const encodingCache = new Map<string, Tiktoken>();

function getOrCreateEncoding(encodingName: string): Tiktoken {
  let encoding = encodingCache.get(encodingName);
  if (!encoding) {
    const ranks = RANK_DATA[encodingName] ?? cl100k_base;
    encoding = new Tiktoken(ranks);
    encodingCache.set(encodingName, encoding);
  }
  return encoding;
}

/**
 * Count tokens for the given text using the model's tokenizer.
 * - OpenAI models: exact count via js-tiktoken
 * - Others: cl100k_base count * correctionFactor (estimated)
 */
export function countTokens(text: string, model: ModelConfig): number {
  if (!text || text.length === 0) return 0;

  try {
    const encoding = getOrCreateEncoding(model.tikTokenEncoding);
    const rawCount = encoding.encode(text).length;
    return Math.ceil(rawCount * model.correctionFactor);
  } catch {
    return 0;
  }
}
