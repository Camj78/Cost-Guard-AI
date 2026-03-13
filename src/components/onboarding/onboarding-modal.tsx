"use client";

import { Button } from "@/components/ui/button";

const EXAMPLE_PROMPT =
  "Write a detailed product roadmap for an AI SaaS startup including hiring plan, go-to-market strategy, and financial projections.";

const STEPS = [
  "Paste your prompt",
  "Click Analyze",
  "Review the cost and risk report",
];

interface OnboardingModalProps {
  onLoadExample: (prompt: string) => void;
}

export function OnboardingModal({ onLoadExample }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md mx-4 p-8 space-y-6">

        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Run your first CostGuard analysis
          </h2>
          <p className="text-sm text-muted-foreground">
            Paste an AI prompt and instantly see token cost, truncation risk,
            and optimization suggestions.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Steps
          </p>
          <ol className="space-y-3">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] flex items-center justify-center font-mono tabular-nums font-semibold">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <Button
          onClick={() => onLoadExample(EXAMPLE_PROMPT)}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border-0"
        >
          Load Example Prompt
        </Button>

      </div>
    </div>
  );
}
