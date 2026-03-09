/**
 * Canonical analysis engine version.
 *
 * Bump when risk scoring logic, prompt pipeline, or output contract changes.
 * Stored with every prompt_incidents record to isolate historical CVE data
 * from future scoring model upgrades.
 *
 * Format: semver string matching packages/core/src/version.ts
 */
export const ANALYSIS_VERSION = "1.0.0";
