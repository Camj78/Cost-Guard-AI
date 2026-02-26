"use client";

import { useState } from "react";
import { usePreflight } from "@/hooks/use-preflight";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PromptInput } from "@/components/prompt-input";
import { ModelSelector } from "@/components/model-selector";
import { OutputSlider } from "@/components/output-slider";
import { CompressionPanel } from "@/components/compression-panel";
import { ResultsPanel } from "@/components/results-panel";
import { CostAtScalePanel } from "@/components/cost-at-scale-panel";
import { ModelAssumptions } from "@/components/model-assumptions";
import { Button } from "@/components/ui/button";
import { Zap, Check } from "lucide-react";
import ProGate from "@/components/pro/ProGate";
import { SavedPromptsPanel } from "@/components/pro/saved-prompts-panel";
import { RiskHistoryPanel } from "@/components/pro/risk-history-panel";
import { ModelComparisonPanel } from "@/components/pro/model-comparison-panel";
import { BatchAnalysisPanel } from "@/components/pro/batch-analysis-panel";
import { PdfExportButton } from "@/components/pro/pdf-export-button";
import { ShareButton } from "@/components/share-button";
import { getSavedPrompts } from "@/lib/saved-prompts";
import { addHistoryEntry } from "@/lib/analysis-history";
import { useUsage } from "@/hooks/use-usage";
import { UsageMeter } from "@/components/usage-meter";

export default function Page() {
  const { isPro, isAuthed, usedThisMonth, limit, refetch } = useUsage();

  const {
    prompt,
    modelId,
    expectedOutputTokens,
    analysis,
    isAnalyzing,
    lastAnalysisId,
    compressionPreview,
    compressionDelta,
    compressedTokens,
    compressedCostTotal,
    tokenDelta,
    costDelta,
    isLargePrompt,
    needsManualAnalyze,
    model,
    sliderMax,
    setPrompt,
    setModelId,
    setExpectedOutputTokens,
    applyCompression,
    triggerManualAnalyze,
  } = usePreflight({ onRecorded: refetch });

  const hasPrompt = prompt.trim().length > 0;

  // Pro: saved prompts + history state
  const [selectedSavedPromptId, setSelectedSavedPromptId] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  function handleLoadSavedPrompt(loadedPrompt: string, loadedModelId: string, id: string) {
    setPrompt(loadedPrompt);
    setModelId(loadedModelId);
    setSelectedSavedPromptId(id);
  }

  function handleRunPreflight() {
    if (!analysis || !selectedSavedPromptId) return;
    // Only write if current prompt exactly matches the saved prompt text
    const savedPrompts = getSavedPrompts();
    const saved = savedPrompts.find((p) => p.id === selectedSavedPromptId);
    if (saved && prompt === saved.prompt) {
      addHistoryEntry(selectedSavedPromptId, analysis);
      setHistoryVersion((v) => v + 1);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {/* Radial glow overlay */}
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />

      <Header />

      {/* HERO SECTION */}
      <section className="py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl space-y-4">
            <h1 className="text-5xl font-black tracking-tight">
              Preflight safety system for AI products in production.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Detect token overflow, cost drift, and production risk before you ship.
            </p>
            <p className="text-sm text-muted-foreground">
              Used by AI founders before every deploy.
            </p>
            <div className="pt-2">
              <Button
                className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white border-0"
                onClick={() => window.scrollTo({ top: 500, behavior: "smooth" })}
              >
                Run Preflight <Zap className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

            {/* LEFT COLUMN: Input Controls */}
            <div className="space-y-4">
              <div className="glass-card p-6">
                <PromptInput
                  value={prompt}
                  onChange={setPrompt}
                  isLargePrompt={isLargePrompt}
                />
              </div>

              <div className="glass-card p-6 space-y-3">
                <ModelSelector selectedId={modelId} onSelect={setModelId} />
                <ModelAssumptions model={model} />
              </div>

              <div className="glass-card p-6">
                <OutputSlider
                  value={expectedOutputTokens}
                  max={sliderMax}
                  onChange={setExpectedOutputTokens}
                />
              </div>

              {needsManualAnalyze && (
                <Button
                  onClick={triggerManualAnalyze}
                  className="w-full gap-2 bg-indigo-600 hover:bg-indigo-500 text-white border-0"
                  size="default"
                >
                  <Zap className="w-4 h-4" />
                  Analyze prompt
                </Button>
              )}

              <div className="glass-card p-6">
                <CompressionPanel
                  compressionPreview={compressionPreview}
                  compressionDelta={compressionDelta}
                  originalPrompt={prompt}
                  model={model}
                  onApply={applyCompression}
                />
              </div>
            </div>

            {/* RIGHT COLUMN: Results Panel (Sticky) */}
            <div className="lg:sticky lg:top-20 space-y-3">
              <ResultsPanel
                analysis={analysis}
                isAnalyzing={isAnalyzing}
                hasPrompt={hasPrompt}
                originalText={prompt}
                compressedText={compressionPreview?.compressed ?? null}
                origTokens={analysis?.inputTokens ?? 0}
                compTokens={compressedTokens || null}
                origCost={analysis?.estimatedCostTotal ?? 0}
                compCost={compressedCostTotal || null}
                tokenDelta={tokenDelta || null}
                costDelta={costDelta || null}
                compressionDeltaPct={compressionDelta || null}
              />

              {/* Share button — authenticated users only, visible when analysis exists */}
              {analysis && (
                <ShareButton
                  analysis={analysis}
                  analysisId={lastAnalysisId}
                  model={model}
                  isAuthed={isAuthed}
                />
              )}

              {/* Free tier usage meter — only for authenticated non-Pro users */}
              {isAuthed && isPro === false && limit !== null && (
                <UsageMeter used={usedThisMonth} limit={limit} />
              )}

              {/* Pro: Run Preflight + PDF Export */}
              <ProGate>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunPreflight}
                    disabled={!analysis || !selectedSavedPromptId}
                    className="gap-1.5 text-xs border-white/10 hover:bg-white/10"
                  >
                    <Zap className="w-3 h-3" />
                    Run Preflight
                  </Button>
                  {analysis && (
                    <PdfExportButton
                      analysis={analysis}
                      model={model}
                      prompt={prompt}
                      compressionDelta={compressionDelta}
                    />
                  )}
                </div>
              </ProGate>
            </div>

          </div>
        </div>
      </main>

      {/* PRO: Saved Prompts + Risk History */}
      <ProGate>
        <section className="glass-section">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <SavedPromptsPanel
                  prompt={prompt}
                  modelId={modelId}
                  onLoad={handleLoadSavedPrompt}
                />
              </div>
              <div className="glass-card p-6">
                <RiskHistoryPanel
                  savedPromptId={selectedSavedPromptId}
                  historyVersion={historyVersion}
                />
              </div>
            </div>
          </div>
        </section>
      </ProGate>

      {/* WHY THIS MATTERS */}
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Why This Matters
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Token Overflow</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Truncation → broken outputs → silent failure in production.
              </p>
            </div>

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cost Drift</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Margins collapse at scale when token usage expands unnoticed.
              </p>
            </div>

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Risk Score</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Signal of production instability — not legal advice, just operational risk.
              </p>
            </div>

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Drift Tracking</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitor token and cost drift across model versions over time.
              </p>
            </div>

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Batch Analysis</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Run preflight checks on multiple prompts simultaneously.
              </p>
            </div>

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Model Comparison</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Compare cost and risk across models before committing to one.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRIMARY UPGRADE CTA — single canonical section */}
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
          <div className="glass-card p-8 max-w-lg mx-auto text-center space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Pro Features
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Unlock Advanced Risk Intelligence
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {["Model comparison", "Risk history", "Saved prompts", "Cost at scale"].map((f) => (
                <span
                  key={f}
                  className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1 bg-muted"
                >
                  {f}
                </span>
              ))}
            </div>
            <Button
              asChild
              className="bg-indigo-600 hover:bg-indigo-500 active:scale-[0.97] text-white px-6"
            >
              <a href="/upgrade">Upgrade to Pro</a>
            </Button>
            <p className="text-xs text-muted-foreground">
              No prompt data ever leaves your browser.
            </p>
          </div>
        </div>
      </section>

      <ProGate>
        <section className="glass-section">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
            <CostAtScalePanel
              analysis={analysis}
              model={model}
            />
          </div>
        </section>
      </ProGate>

      {/* PRO: Model Comparison */}
      <ProGate>
        <section className="glass-section">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
            <ModelComparisonPanel
              prompt={prompt}
              expectedOutputTokens={expectedOutputTokens}
            />
          </div>
        </section>
      </ProGate>

      {/* PRO: Batch Analysis */}
      <ProGate>
        <section className="glass-section">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
            <BatchAnalysisPanel
              model={model}
              expectedOutputTokens={expectedOutputTokens}
            />
          </div>
        </section>
      </ProGate>

      {/* WHO THIS IS FOR */}
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Who This Is For
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">AI SaaS Founders</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Shipping prompts into production and need cost + failure visibility before scaling.
              </p>
            </div>

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Product & ML Teams</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitoring token usage and drift across models and deployments.
              </p>
            </div>

            <div className="glass-card p-6 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">AI Infrastructure Engineers</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Preventing overflow, runaway costs, and silent degradation.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              How Preflight Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            <div className="glass-card p-6 space-y-3">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">1</span>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Analyze</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Estimate tokens, cost, compression, and risk before deployment.
              </p>
            </div>

            <div className="glass-card p-6 space-y-3">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">2</span>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Simulate</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Adjust output length and compare models to understand scale impact.
              </p>
            </div>

            <div className="glass-card p-6 space-y-3">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-bold">3</span>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Deploy Safely</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ship with predictable cost and reduced production risk.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Pricing
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Built for teams shipping AI into production.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">

            {/* Free */}
            <div className="glass-card p-8 space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Free</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Single preflight analysis</li>
                <li>• Token + cost + risk visibility</li>
                <li>• Manual usage</li>
              </ul>
              <div className="pt-2">
                <span className="text-3xl font-semibold font-mono">$0</span>
              </div>
            </div>

            {/* Pro */}
            <div className="rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/60 backdrop-blur-xl p-8 space-y-4" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pro</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Unlimited preflights</span>
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Model comparison matrix</span>
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Historical drift tracking</span>
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Batch analysis</span>
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Team dashboard</span>
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Priority support</span>
                </li>
              </ul>
              <div className="pt-2">
                <span className="text-4xl font-black font-mono tracking-tight">$29</span>
                <div className="text-xs text-muted-foreground mt-1">per month</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Pays for itself at ~10K req/day
                </div>
              </div>
              <Button
                asChild
                variant="outline"
                className="w-full active:scale-[0.97]"
              >
                <a href="/upgrade">Upgrade to Pro</a>
              </Button>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
