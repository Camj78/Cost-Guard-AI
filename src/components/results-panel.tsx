"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskScore } from "@/components/risk-score";
import { TokenDisplay } from "@/components/token-display";
import { CostDisplay } from "@/components/cost-display";
import { ContextBar } from "@/components/context-bar";
import { TruncationWarning } from "@/components/truncation-warning";
import { type RiskAssessment } from "@/lib/risk";

interface ResultsPanelProps {
  analysis: RiskAssessment | null;
  isAnalyzing: boolean;
  hasPrompt: boolean;
}

export function ResultsPanel({
  analysis,
  isAnalyzing,
  hasPrompt,
}: ResultsPanelProps) {
  // Empty state
  if (!hasPrompt && !isAnalyzing) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center px-6 gap-5">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-3xl">
          ⚡
        </div>
        <div className="space-y-1.5">
          <p className="font-semibold text-foreground text-base">
            Paste a prompt above
          </p>
          <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
            Token count, cost estimate, and Failure Risk Score appear as you type — no account needed.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Exact counts for OpenAI models
          </span>
          <span className="flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            Estimated for Anthropic, Google, Meta
          </span>
          <span className="flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            1-click compression saves tokens
          </span>
        </div>
      </div>
    );
  }

  // Loading / analyzing state — only shown while waiting for first analysis
  // (subsequent analyses update in-place, keeping previous results visible)
  if (!analysis && hasPrompt) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Analyzing prompt…</p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-4">
      {/* 1. Failure Risk Score — THE moat */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <RiskScore
            score={analysis.riskScore}
            level={analysis.riskLevel}
            explanation={analysis.riskExplanation}
          />
        </CardContent>
      </Card>

      {/* 2. Token count */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Token count
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <TokenDisplay
            tokens={analysis.inputTokens}
            isEstimated={analysis.isEstimated}
            usageRatio={analysis.usageRatio}
          />
        </CardContent>
      </Card>

      {/* 3. Context usage */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <ContextBar
            inputTokens={analysis.inputTokens}
            contextWindow={analysis.contextWindow}
            usagePercent={analysis.usagePercent}
            riskLevel={analysis.riskLevel}
          />
        </CardContent>
      </Card>

      {/* 4. Cost estimate */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cost estimate
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <CostDisplay
            estimatedCostInput={analysis.estimatedCostInput}
            estimatedCostOutput={analysis.estimatedCostOutput}
            estimatedCostTotal={analysis.estimatedCostTotal}
            isEstimated={analysis.isEstimated}
          />
        </CardContent>
      </Card>

      {/* 5. Truncation warning */}
      <TruncationWarning truncation={analysis.truncation} />
    </div>
  );
}
