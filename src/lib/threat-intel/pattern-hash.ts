/**
 * CostGuardAI — Pattern Hash (server-side)
 *
 * Computes SHA-256 of a structural signature using Node.js crypto.
 * Server-side only. For client-side hashing, use crypto.subtle with
 * buildStructureSignature from ./signature.ts.
 */

import { createHash } from "crypto";
import type { RiskAssessment } from "@/lib/risk";
import { buildStructureSignature } from "./signature";

/**
 * Computes the pattern_hash for a given RiskAssessment.
 * Result is deterministic: same structural pattern → same hash.
 * No raw prompt text is included in the hash input.
 */
export function computePatternHash(assessment: RiskAssessment): string {
  const sig = buildStructureSignature(assessment);
  return createHash("sha256").update(sig).digest("hex");
}
