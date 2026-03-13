/**
 * Trust layer re-exports — deterministic version stamps and input hashing.
 * Server-side only (uses Node.js crypto).
 */
export { ANALYSIS_VERSION } from "../../packages/core/src/version";
export { RULESET_HASH } from "../../packages/core/src/ruleset-hash";
export { hashInput, normalizePrompt } from "../../packages/core/src/input-hash";
