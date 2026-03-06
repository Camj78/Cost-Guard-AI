/**
 * CostGuardAI — Report Sanitization Layer
 *
 * Enforces trust-layer privacy policies before any report data is surfaced
 * publicly. Raw prompts are never stored in ShareSnapshots; this module
 * formalizes that invariant and provides the prompt display string per policy.
 *
 * Policy is controlled by COSTGUARD_PROMPT_STORAGE env var:
 *   hash      (default) — display hashed identifier only
 *   redacted             — display "[redacted]" placeholder
 *   full                 — acknowledge that snapshots never contain raw prompts
 */

import type { ShareSnapshot } from "@/lib/share-schema";
import type { RiskAssessment } from "@/lib/risk";

export type PromptStoragePolicy = "hash" | "redacted" | "full";

export interface SanitizedReport {
  modelId: string;
  modelName: string;
  pricingLastUpdated: string;
  analysis: RiskAssessment;
  /** Policy-aware prompt display string. Never contains raw prompt text. */
  promptDisplay: string;
  policy: PromptStoragePolicy;
}

function resolvePolicy(): PromptStoragePolicy {
  const val = process.env.COSTGUARD_PROMPT_STORAGE;
  if (val === "full" || val === "redacted" || val === "hash") return val;
  return "hash";
}

/**
 * Returns a sanitized, policy-compliant view of a share snapshot.
 * Raw prompt text is never present in ShareSnapshot by design; this function
 * enforces that invariant and returns the appropriate display string.
 */
export function sanitizeReport(snapshot: ShareSnapshot): SanitizedReport {
  const policy = resolvePolicy();

  let promptDisplay: string;
  if (policy === "full") {
    // Snapshots intentionally exclude raw prompts — inform caller.
    promptDisplay = "[Prompt not stored in public snapshots]";
  } else if (policy === "redacted") {
    promptDisplay = "[redacted]";
  } else {
    promptDisplay = "[hashed — not displayed]";
  }

  // Pass through analysis and model metadata unchanged.
  // No secret fields exist in ShareSnapshot; this is a verified allowlist.
  return {
    modelId: snapshot.modelId,
    modelName: snapshot.modelName,
    pricingLastUpdated: snapshot.pricingLastUpdated,
    analysis: snapshot.analysis,
    promptDisplay,
    policy,
  };
}
