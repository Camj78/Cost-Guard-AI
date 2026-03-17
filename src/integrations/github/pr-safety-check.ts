/**
 * CostGuardAI — GitHub PR Safety Check (scaffold)
 *
 * Interface placeholder for future GitHub Pull Request integration.
 * This module defines the expected input/output contract for the PR safety
 * check feature. Full implementation will be added in a future sprint.
 *
 * Intended usage:
 *   - Triggered by GitHub webhook on pull_request events
 *   - Receives the PR diff and extracts prompt-like structures
 *   - Runs CostGuard preflight analysis against extracted content
 *   - Returns a structured result for posting as a PR comment
 *
 * PR comment format:
 *
 *   ⚠ CostGuard Safety Check
 *   Safety Score: 41/100
 *   Matches: PCVE-2026-0007
 *   Recommendation: Isolate system instructions from user input.
 */

export interface PrSafetyCheckInput {
  /** Raw PR diff content (unified diff format) */
  diff: string;
  /** Optional PR metadata for context */
  prNumber?: number;
  repoFullName?: string;
}

export interface CveMatch {
  cveId: string;
  severity: "critical" | "high" | "medium";
  description: string;
}

export interface PrSafetyCheckResult {
  /** CostGuard Safety Score 0–100 (higher = safer) */
  safetyScore: number;
  /** Risk level label */
  riskLevel: "low" | "moderate" | "high" | "critical";
  /** Matched CVE entries (empty if none found) */
  cveMatches: CveMatch[];
  /** Human-readable recommendation for the PR author */
  recommendation: string;
  /** Full formatted PR comment body (Markdown) */
  commentBody: string;
}

/**
 * runPromptSafetyCheck — placeholder implementation.
 *
 * Analyzes the provided PR diff for prompt-like structures and returns
 * a safety check result.
 *
 * @param input - PR diff and optional metadata
 * @returns PrSafetyCheckResult with score, CVE matches, and comment body
 *
 * @todo Implement diff parsing to extract prompt candidates
 * @todo Wire up /api/v1/analyze for scoring
 * @todo Implement CVE pattern matching against extracted structures
 */
export async function runPromptSafetyCheck(
  input: PrSafetyCheckInput
): Promise<PrSafetyCheckResult> {
  // Scaffold: returns a neutral placeholder result.
  // Replace with real implementation when GitHub App integration is built.
  void input;

  const safetyScore = 100;
  const riskLevel = "low" as const;
  const cveMatches: CveMatch[] = [];
  const recommendation = "No prompt structures detected in this diff.";

  const commentBody = formatCommentBody({ safetyScore, riskLevel, cveMatches, recommendation });

  return { safetyScore, riskLevel, cveMatches, recommendation, commentBody };
}

function formatCommentBody(result: Omit<PrSafetyCheckResult, "commentBody">): string {
  const lines: string[] = [
    "<!-- costguard-pr-safety-check -->",
    "### CostGuard Safety Check",
    "",
    `**Safety Score:** ${result.safetyScore}/100 · ${riskLevelLabel(result.riskLevel)}`,
    "",
  ];

  if (result.cveMatches.length > 0) {
    lines.push("**Matched Vulnerabilities:**");
    for (const match of result.cveMatches) {
      lines.push(`- [\`${match.cveId}\`](https://costguardai.io/vulnerabilities/${match.cveId}) — ${match.description}`);
    }
    lines.push("");
  }

  lines.push(`**Recommendation:** ${result.recommendation}`);
  lines.push("");
  lines.push("---");
  lines.push("_[CostGuardAI](https://costguardai.io) · Prompt preflight for AI products_");

  return lines.join("\n");
}

function riskLevelLabel(level: PrSafetyCheckResult["riskLevel"]): string {
  switch (level) {
    case "low":      return "Safe";
    case "moderate": return "Warning";
    case "high":     return "High";
    case "critical": return "High";
  }
}
