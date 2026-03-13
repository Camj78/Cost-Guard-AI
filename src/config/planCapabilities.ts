/**
 * Feature capability map per plan.
 * Use PLAN_CAPABILITIES[plan].feature for all feature gating.
 */
import { PLANS, type Plan } from "./plans";

interface PlanCapabilities {
  unlimitedPreflight: boolean;
  teamDashboard: boolean;
  sharedAlerts: boolean;
  enterpriseFeatures: boolean;
}

export const PLAN_CAPABILITIES: Record<Plan, PlanCapabilities> = {
  [PLANS.FREE]: {
    unlimitedPreflight: false,
    teamDashboard: false,
    sharedAlerts: false,
    enterpriseFeatures: false,
  },
  [PLANS.PRO]: {
    unlimitedPreflight: true,
    teamDashboard: false,
    sharedAlerts: false,
    enterpriseFeatures: false,
  },
  [PLANS.TEAM]: {
    unlimitedPreflight: true,
    teamDashboard: true,
    sharedAlerts: true,
    enterpriseFeatures: false,
  },
  [PLANS.ENTERPRISE]: {
    unlimitedPreflight: true,
    teamDashboard: true,
    sharedAlerts: true,
    enterpriseFeatures: true,
  },
};
