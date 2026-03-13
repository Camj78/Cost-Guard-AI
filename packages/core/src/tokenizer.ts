/**
 * CostGuardAI — Token counter.
 * Canonical source of truth used by BOTH the web app and CLI.
 */

import { getEncoding } from "js-tiktoken";
import type { ModelConfig } from "./models";

// Cache encodings to avoid re-initialization on every call.
// Each encoding loads BPE rank data (~2-4MB), so caching matters.
const encodingCache = new Map<string, ReturnType<typeof getEncoding>>();

function getOrCreateEncoding(encodingName: string) {
  let encoding = encodingCache.get(encodingName);
  if (!encoding) {
    encoding = getEncoding(encodingName as Parameters<typeof getEncoding>[0]);
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
