/**
 * Internal app plan model.
 *
 * free  → base access, 25 analyses/month
 * pro   → unlimited analyses, history, compare, CI
 * team  → all Pro features (shared team history, exports — future)
 *
 * Team is a superset of Pro. Use hasProAccess() for any paid-feature gate.
 */

export type AppPlan = "free" | "pro" | "team";

/** True for any paid plan (pro or team). */
export function hasProAccess(plan: string): boolean {
  return plan === "pro" || plan === "team";
}

/** True only for the team plan. */
export function isTeam(plan: string): boolean {
  return plan === "team";
}
