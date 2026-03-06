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
    title: "You've used 70% of your monthly limit.",
    body: "Free plan includes 25 analyses per month. Once you hit the cap, preflight runs stop being saved — and you lose drift visibility on your most-used prompts.",
    ctaLabel: "Upgrade to Pro — unlimited",
  },
  usage_100: {
    title: "Monthly limit reached.",
    body: "Analyses are no longer being recorded. Prompts you ship from here go dark — no risk history, no drift tracking, no record if something breaks.",
    ctaLabel: "Remove the limit",
  },
  share_cta: {
    title: "Run preflight before you ship.",
    body: "Catch token overflow, cost drift, and production failure risk before a single request goes out. No prompt data leaves your browser.",
    ctaLabel: "Start free — no card required",
  },
  pro_locked: {
    title: "Pro feature",
    body: "CI guardrails, cost impact estimation, observability, and replay audit trail are on Pro. Most teams cover the cost in avoided API waste in the first week.",
    ctaLabel: "Unlock Pro",
  },
  compare_locked: {
    title: "Cost impact estimation",
    body: "You're guessing what this prompt costs at production scale. Pro shows you the exact number before you ship.",
    bullets: [
      "Cost projection at 1k, 10k, 100k requests — not estimates",
      "Risk-weighted cost: spend × probability of failure",
      "Find the cheapest model that clears your risk threshold",
    ],
    ctaLabel: "Unlock cost impact",
  },
  history_locked: {
    title: "Observability dashboard",
    body: "Cost and risk drift are invisible until production breaks. Pro tracks every analysis run with full audit trail.",
    bullets: [
      "Usage trends by model, environment, and project",
      "Replay any past run with the exact inputs and scoring version",
      "Catch cost regressions before they multiply at scale",
    ],
    ctaLabel: "Unlock observability",
  },
  batch_locked: {
    title: "CI guardrails",
    body: "Shipping without a risk gate is the most common source of LLM cost incidents. Pro integrates preflight directly into your CI pipeline.",
    bullets: [
      "Block deploys when risk score exceeds your threshold",
      "JSON output for CI parsing — works with any pipeline",
      "Idempotent PR comments with pass/fail status",
    ],
    ctaLabel: "Unlock CI guardrails",
  },
};
