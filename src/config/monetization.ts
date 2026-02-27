export type UpgradeMoment =
  | "usage_70"
  | "usage_100"
  | "share_cta"
  | "pro_locked"
  | "compare_locked"
  | "history_locked"
  | "batch_locked";

export const copyByMoment: Record<
  UpgradeMoment,
  { title: string; body: string; bullets?: string[]; ctaLabel: string }
> = {
  usage_70: {
    title: "Approaching limit",
    body: "You're at 70%+ of your monthly analyses.",
    ctaLabel: "Upgrade to Pro",
  },
  usage_100: {
    title: "Limit reached",
    body: "Analyses won't be saved this month.",
    ctaLabel: "Upgrade to Pro",
  },
  share_cta: {
    title: "Run your own preflight",
    body: "Analyze prompts, compare models, and catch risk before you deploy.",
    ctaLabel: "Upgrade to Pro",
  },
  pro_locked: {
    title: "Pro feature",
    body: "Unlock saved prompts, risk history, and model comparison.",
    ctaLabel: "Upgrade to Pro",
  },
  compare_locked: {
    title: "Model comparison",
    body: "Compare cost and risk across all models side-by-side.",
    bullets: [
      "See which model is cheapest at your token volume",
      "Compare risk scores across providers",
      "Spot the best cost-to-risk tradeoff before committing",
    ],
    ctaLabel: "Unlock model comparison",
  },
  history_locked: {
    title: "Risk history",
    body: "Track prompt drift and risk scores over time.",
    bullets: [
      "Monitor token and cost changes across versions",
      "Catch regressions before they reach production",
      "Compare current vs. baseline risk score",
    ],
    ctaLabel: "Unlock risk history",
  },
  batch_locked: {
    title: "Batch analysis",
    body: "Run preflight on up to 50 prompts simultaneously.",
    bullets: [
      "Analyze entire prompt suites in one pass",
      "Flag high-risk prompts across your codebase",
      "Built for teams shipping multiple AI features",
    ],
    ctaLabel: "Unlock batch analysis",
  },
};
