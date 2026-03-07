/**
 * Global plan enum — single source of truth for all plan identifiers.
 * Reference PLANS.PRO, never hardcode "pro".
 */
export const PLANS = {
  FREE: "free",
  PRO: "pro",
  TEAM: "team",
  ENTERPRISE: "enterprise",
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];
