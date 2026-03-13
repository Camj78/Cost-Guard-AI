import { createHash } from "crypto";

/**
 * Normalize prompt text for stable, reproducible hashing.
 * Rules: trim edges, normalize line endings, strip trailing whitespace per line.
 */
export function normalizePrompt(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, "\n")      // CRLF → LF
    .replace(/\r/g, "\n")         // CR → LF
    .replace(/[ \t]+\n/g, "\n")   // trailing whitespace per line
    .replace(/[ \t]+$/, "");      // trailing whitespace at end
}

/**
 * SHA-256 hash of normalized prompt text.
 * Identical prompts always produce identical hashes.
 */
export function hashInput(prompt: string): string {
  const normalized = normalizePrompt(prompt);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
