/**
 * Internal app plan model.
 *
 * free       → base access, 25 analyses/month
 * pro        → unlimited analyses, history, compare, CI
 * team       → all Pro features + shared team history, alerts
 * enterprise → all Team features + dedicated support, custom integrations
 *
 * Team and Enterprise are supersets of Pro. Use hasProAccess() for any paid-feature gate.
 */
import { PLANS } from "@/config/plans";

export type AppPlan = "free" | "pro" | "team" | "enterprise";

/** True for any paid plan (pro, team, or enterprise). */
export function hasProAccess(plan: string): boolean {
  return plan === PLANS.PRO || plan === PLANS.TEAM || plan === PLANS.ENTERPRISE;
}

/** True only for the team plan. */
export function isTeam(plan: string): boolean {
  return plan === PLANS.TEAM;
}

/** True only for the enterprise plan. */
export function isEnterprise(plan: string): boolean {
  return plan === PLANS.ENTERPRISE;
}
