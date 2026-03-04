"use client";

import { useState } from "react";
import { Loader2, Info, ScanLine, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { RiskScore } from "@/components/risk-score";
import { TokenDisplay } from "@/components/token-display";
import { CostDisplay } from "@/components/cost-display";
import { ContextBar } from "@/components/context-bar";
import { TruncationWarning } from "@/components/truncation-warning";
import { type RiskAssessment } from "@/lib/risk";
import { formatCost } from "@/lib/formatters";

interface ResultsPanelProps {
  analysis: RiskAssessment | null;
  isAnalyzing: boolean;
  hasPrompt: boolean;
  // Compression diff props
  originalText: string;
  compressedText: string | null;
  origTokens: number;
  compTokens: number | null;
  origCost: number;
  compCost: number | null;
  tokenDelta: number | null;
  costDelta: number | null;
  compressionDeltaPct: number | null;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1 align-middle" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

export function ResultsPanel({
  analysis,
  isAnalyzing,
  hasPrompt,
  originalText,
  compressedText,
  origTokens,
  compTokens,
  origCost,
  compCost,
  tokenDelta,
  costDelta,
  compressionDeltaPct,
}: ResultsPanelProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!compressedText) return;
    navigator.clipboard.writeText(compressedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  // Empty state
  if (!hasPrompt && !isAnalyzing) {
    return (
      <div className="glass-card flex flex-col items-center justify-center min-h-[320px] text-center p-8 gap-5">
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
          <ScanLine className="w-6 h-6 text-muted-foreground" />
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
      <div className="glass-card flex flex-col items-center justify-center min-h-[320px] gap-3 text-muted-foreground p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Analyzing prompt…</p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-4">
      {/* 1. Failure Risk Score — THE moat */}
      <Card className="glass-card shadow-none relative animate-data-arrive transition-all duration-100 hover:-translate-y-[1px] hover:border-white/[0.14]" style={{ animationDelay: "0ms" }}>
        <div className="absolute top-0 left-6 right-6 h-px bg-primary/30" />
        <CardContent className="pt-5 pb-4">
          <RiskScore
            score={analysis.riskScore}
            level={analysis.riskLevel}
            explanation={analysis.riskExplanation}
            riskDrivers={analysis.riskDrivers}
          />
        </CardContent>
      </Card>

      {/* 2. Token count */}
      <Card className="glass-card shadow-none animate-data-arrive transition-all duration-100 hover:-translate-y-[1px] hover:border-white/[0.14]" style={{ animationDelay: "50ms" }}>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Token count
            <InfoTooltip text="Your prompt may exceed model context limits, causing truncation or failure." />
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
      <Card className="glass-card shadow-none">
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
      <Card className="glass-card shadow-none animate-data-arrive transition-all duration-100 hover:-translate-y-[1px] hover:border-white/[0.14]" style={{ animationDelay: "100ms" }}>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Cost estimate
            <InfoTooltip text="Small inefficiencies multiply significantly at high request volume." />
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

      {/* 5. Compression diff */}
      {compressedText && (
        <Card className="glass-card shadow-none animate-data-arrive transition-all duration-100 hover:-translate-y-[1px] hover:border-white/[0.14]" style={{ animationDelay: "150ms" }}>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Compression diff
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Original */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Original</p>
                <div className="rounded border border-white/10 bg-white/5 p-2 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {originalText}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens</span>
                    <span className="font-mono tabular-nums">{origTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono tabular-nums">{formatCost(origCost)}</span>
                  </div>
                </div>
              </div>
              {/* Compressed */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Compressed</p>
                  <button
                    onClick={handleCopy}
                    aria-label="Copy compressed text"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="rounded border border-white/10 bg-white/5 p-2 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                  {compressedText}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens</span>
                    <span className="font-mono tabular-nums">{compTokens?.toLocaleString() ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono tabular-nums">{compCost != null ? formatCost(compCost) : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delta row */}
            <div className="border-t border-white/10 pt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Tokens saved</p>
                <p className={`font-mono tabular-nums font-medium ${
                  tokenDelta == null ? "text-muted-foreground" : tokenDelta > 0 ? "text-emerald-400" : tokenDelta < 0 ? "text-red-400" : "text-muted-foreground"
                }`}>
                  {tokenDelta == null ? "—" : `${tokenDelta > 0 ? "-" : "+"}${Math.abs(tokenDelta).toLocaleString()}`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">% saved</p>
                <p className={`font-mono tabular-nums font-medium ${
                  compressionDeltaPct == null ? "text-muted-foreground" : compressionDeltaPct > 0 ? "text-emerald-400" : compressionDeltaPct < 0 ? "text-red-400" : "text-muted-foreground"
                }`}>
                  {compressionDeltaPct == null ? "—" : `${compressionDeltaPct.toFixed(1)}%`}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost saved</p>
                <p className={`font-mono tabular-nums font-medium ${
                  costDelta == null ? "text-muted-foreground" : costDelta > 0 ? "text-emerald-400" : costDelta < 0 ? "text-red-400" : "text-muted-foreground"
                }`}>
                  {costDelta == null ? "—" : `${costDelta > 0 ? "-" : "+"}${formatCost(Math.abs(costDelta))}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Truncation warning */}
      <TruncationWarning truncation={analysis.truncation} />
    </div>
  );
}
