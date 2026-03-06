import { createHash } from "crypto";
import { SCORING_WEIGHTS, AMBIGUOUS_TERMS, VOLATILITY_PHRASES } from "./risk";

/**
 * Stable fingerprint of the risk rule definitions.
 * Covers: scoring weights, ambiguous term list, volatility phrase list.
 * Recomputed at module load. Changes when risk rules change.
 */
const _fingerprint = JSON.stringify({
  weights: SCORING_WEIGHTS,
  ambiguous_terms: [...AMBIGUOUS_TERMS].sort(),
  volatility_phrases: [...VOLATILITY_PHRASES].sort(),
});

/** SHA-256 of current risk ruleset. Stable for a given engine version. */
export const RULESET_HASH: string = createHash("sha256")
  .update(_fingerprint, "utf8")
  .digest("hex");
