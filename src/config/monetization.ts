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
    body: "Risk history, model comparison, and saved prompts are on Pro. Most teams cover the cost in avoided API waste in the first week.",
    ctaLabel: "Unlock Pro",
  },
  compare_locked: {
    title: "Model comparison",
    body: "You're guessing which model costs less at your token volume. Pro shows you the exact number.",
    bullets: [
      "Side-by-side cost at your actual token counts — not estimates",
      "Risk scores across GPT-4o, Claude, Gemini on the same prompt",
      "Find the cheapest model that clears your risk threshold",
    ],
    ctaLabel: "Unlock model comparison",
  },
  history_locked: {
    title: "Risk history",
    body: "Prompt drift is invisible until production breaks. Pro tracks risk score changes across every version of every prompt you run.",
    bullets: [
      "See if your prompt got riskier after the last edit",
      "Catch cost regressions before they multiply at scale",
      "Baseline comparison: current risk vs. your last clean deploy",
    ],
    ctaLabel: "Unlock risk history",
  },
  batch_locked: {
    title: "Batch analysis",
    body: "Running 10 prompts one-at-a-time isn't a workflow. Pro runs up to 50 simultaneously — ranked by risk score.",
    bullets: [
      "Full preflight across your entire prompt suite in one pass",
      "Highest-risk prompts surface first",
      "Catches cross-prompt cost variance before you scale",
    ],
    ctaLabel: "Unlock batch analysis",
  },
};
