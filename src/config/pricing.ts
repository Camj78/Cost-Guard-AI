/**
 * Central pricing configuration.
 * Drives all pricing UI dynamically — never hardcode tiers in components.
 * Actual Stripe price IDs are resolved at runtime from env vars via src/lib/stripe/price-lookup.ts.
 */
import { PLANS } from "./plans";

export interface PricingTier {
  id: string;
  name: string;
  description: string;
  /** Monthly price in USD. null = custom/contact sales. 0 = free. */
  priceMonthly: number | null;
  /** Yearly price in USD (lump sum). Only defined for plans with annual billing. */
  priceYearly?: number;
  features: string[];
  /** Visually emphasize this card in the pricing grid. */
  highlighted?: boolean;
}

export const PRICING: PricingTier[] = [
  {
    id: PLANS.FREE,
    name: "Free",
    description: "Start analyzing prompts today.",
    priceMonthly: 0,
    features: [
      "Single preflight",
      "Token + cost + risk",
      "Manual usage",
    ],
  },
  {
    id: PLANS.PRO,
    name: "Pro",
    description: "For developers shipping AI into production.",
    priceMonthly: 29,
    priceYearly: 290,
    highlighted: true,
    features: [
      "Unlimited preflights",
      "Model comparison matrix",
      "Historical drift tracking",
      "Batch analysis",
    ],
  },
  {
    id: PLANS.TEAM,
    name: "Team",
    description: "For teams monitoring AI in production.",
    priceMonthly: 79,
    features: [
      "Team dashboard",
      "Shared alerts",
      "Repository monitoring",
      "Slack alerts",
      "Multi-user access",
    ],
  },
  {
    id: PLANS.ENTERPRISE,
    name: "Enterprise",
    description: "Custom pricing for large teams.",
    priceMonthly: null,
    features: [
      "Dedicated support",
      "Custom integrations",
      "Advanced observability",
      "Enterprise SLA",
    ],
  },
];
