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
import { Zap } from "lucide-react";
import ProGate from "@/components/pro/ProGate";
import { SavedPromptsPanel } from "@/components/pro/saved-prompts-panel";
import { RiskHistoryPanel } from "@/components/pro/risk-history-panel";
import { ModelComparisonPanel } from "@/components/pro/model-comparison-panel";
import { BatchAnalysisPanel } from "@/components/pro/batch-analysis-panel";
import { PdfExportButton } from "@/components/pro/pdf-export-button";
import { getSavedPrompts } from "@/lib/saved-prompts";
import { addHistoryEntry } from "@/lib/analysis-history";

export default function Page() {
  const {
    prompt,
    modelId,
    expectedOutputTokens,
    analysis,
    isAnalyzing,
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
  } = usePreflight();

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
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* ✅ HERO (Phase 1) */}
<section className="border-b bg-background">
  <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
    <div className="max-w-2xl space-y-3">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        Preflight safety system for AI products in production.
      </h1>
      <p className="text-base sm:text-lg text-muted-foreground">
        Detect token overflow, cost drift, and production risk before you ship.
      </p>
      <p className="text-sm text-muted-foreground">
        Used by AI founders before every deploy.
        <div className="pt-2">
  <Button className="gap-2" onClick={() => window.scrollTo({ top: 500, behavior: "smooth" })}>
    Run Preflight <Zap className="w-4 h-4" />
  </Button>
</div>
      </p>
    </div>
  </div>
</section>
      {/* Main content */}
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

            {/* ── LEFT COLUMN: Input ── */}
            <div className="space-y-4">
              <PromptInput
                value={prompt}
                onChange={setPrompt}
                isLargePrompt={isLargePrompt}
              />

              {/* Model selector + assumptions link */}
              <div className="space-y-1.5">
                <ModelSelector selectedId={modelId} onSelect={setModelId} />
                <ModelAssumptions model={model} />
              </div>

              {/* Expected output slider */}
              <OutputSlider
                value={expectedOutputTokens}
                max={sliderMax}
                onChange={setExpectedOutputTokens}
              />

              {/* Manual analyze button (large prompts only) */}
              {needsManualAnalyze && (
                <Button
                  onClick={triggerManualAnalyze}
                  className="w-full gap-2"
                  size="default"
                >
                  <Zap className="w-4 h-4" />
                  Analyze prompt
                </Button>
              )}

              {/* Compression panel */}
              <CompressionPanel
                compressionPreview={compressionPreview}
                compressionDelta={compressionDelta}
                originalPrompt={prompt}
                model={model}
                onApply={applyCompression}
              />
            </div>

            {/* ── RIGHT COLUMN: Results ── */}
            <div className="lg:sticky lg:top-6 space-y-3">
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

              {/* Pro: Run Preflight + PDF Export */}
              <ProGate>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunPreflight}
                    disabled={!analysis || !selectedSavedPromptId}
                    className="gap-1.5 text-xs"
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

      {/* ✅ PRO: Saved Prompts + Risk History */}
      <ProGate>
        <section className="border-t bg-muted/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <SavedPromptsPanel
                prompt={prompt}
                modelId={modelId}
                onLoad={handleLoadSavedPrompt}
              />
              <RiskHistoryPanel
                savedPromptId={selectedSavedPromptId}
                historyVersion={historyVersion}
              />
            </div>
          </div>
        </section>
      </ProGate>

      {/* ✅ WHY THIS MATTERS */}
<section className="border-t bg-muted/30">
  <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
    <div className="text-center mb-8">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        Why This Matters
      </h2>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm sm:text-base">

      {/* Token Overflow */}
      <div className="space-y-2">
        <h3 className="font-semibold">Token Overflow</h3>
        <p className="text-muted-foreground">
          Truncation → broken outputs → silent failure in production.
        </p>
      </div>

      {/* Cost Drift */}
      <div className="space-y-2">
        <h3 className="font-semibold">Cost Drift</h3>
        <p className="text-muted-foreground">
          Margins collapse at scale when token usage expands unnoticed.
        </p>
      </div>

      {/* Risk Score */}
      <div className="space-y-2">
        <h3 className="font-semibold">Risk Score</h3>
        <p className="text-muted-foreground">
          Signal of production instability — not legal advice, just operational risk.
        </p>
      </div>
<ProGate>
  <div className="rounded-lg border bg-background p-4 space-y-1">
    <h3 className="font-semibold">Drift Tracking</h3>
    <p className="text-muted-foreground text-sm">
      Monitor token and cost drift across model versions over time.
    </p>
  </div>
</ProGate>

<ProGate>
  <div className="rounded-lg border bg-background p-4 space-y-1">
    <h3 className="font-semibold">Batch Analysis</h3>
    <p className="text-muted-foreground text-sm">
      Run preflight checks on multiple prompts simultaneously.
    </p>
  </div>
</ProGate>

<ProGate>
  <div className="rounded-lg border bg-background p-4 space-y-1">
    <h3 className="font-semibold">Model Comparison</h3>
    <p className="text-muted-foreground text-sm">
      Compare cost and risk across models before committing to one.
    </p>
  </div>
</ProGate>
    </div>
  </div>
</section>

<ProGate>
  <CostAtScalePanel
    analysis={analysis}
    model={model}
  />
</ProGate>

{/* ✅ PRO: Model Comparison */}
<ProGate>
  <section className="border-t bg-background">
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <ModelComparisonPanel
        prompt={prompt}
        expectedOutputTokens={expectedOutputTokens}
      />
    </div>
  </section>
</ProGate>

{/* ✅ PRO: Batch Analysis */}
<ProGate>
  <section className="border-t bg-muted/10">
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
      <BatchAnalysisPanel
        model={model}
        expectedOutputTokens={expectedOutputTokens}
      />
    </div>
  </section>
</ProGate>

{/* ✅ WHO THIS IS FOR */}
<section className="border-t bg-muted/20">
  <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
    <div className="text-center mb-10">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        Who This Is For
      </h2>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm sm:text-base">

      <div className="space-y-2">
        <h3 className="font-semibold">AI SaaS Founders</h3>
        <p className="text-muted-foreground">
          Shipping prompts into production and need cost + failure visibility before scaling.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Product & ML Teams</h3>
        <p className="text-muted-foreground">
          Monitoring token usage and drift across models and deployments.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">AI Infrastructure Engineers</h3>
        <p className="text-muted-foreground">
          Preventing overflow, runaway costs, and silent degradation.
        </p>
      </div>

    </div>
  </div>
</section>

      {/* ✅ HOW IT WORKS */}
<section className="border-t bg-background">
  <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
    <div className="text-center mb-10">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        How Preflight Works
      </h2>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm sm:text-base">

      <div className="space-y-2">
        <h3 className="font-semibold">1. Analyze</h3>
        <p className="text-muted-foreground">
          Estimate tokens, cost, compression, and risk before deployment.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">2. Simulate</h3>
        <p className="text-muted-foreground">
          Adjust output length and compare models to understand scale impact.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">3. Deploy Safely</h3>
        <p className="text-muted-foreground">
          Ship with predictable cost and reduced production risk.
        </p>
      </div>

    </div>
  </div>
</section>

      {/* ✅ PRICING */}
<section className="border-t bg-background">
  <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
    <div className="text-center mb-10">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
        Pricing
      </h2>
      <p className="text-muted-foreground mt-2">
        Built for teams shipping AI into production.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Free */}
      <div className="rounded-lg border p-6 space-y-4">
        <h3 className="text-xl font-semibold">Free</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Single preflight analysis</li>
          <li>• Token + cost + risk visibility</li>
          <li>• Manual usage</li>
        </ul>
        <div className="pt-4 text-sm font-medium">
          $0
        </div>
      </div>

      {/* Pro */}
      <div className="rounded-lg border p-6 space-y-4 bg-muted/30">
        <h3 className="text-xl font-semibold">Pro</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Unlimited preflights</li>
          <li>• Model comparison matrix</li>
          <li>• Historical drift tracking</li>
          <li>• Batch analysis</li>
          <li>• Team dashboard</li>
          <li>• Priority support</li>
        </ul>
        <div className="pt-4 text-lg font-semibold">
          $29 / month
        </div>
        <a
          href="/upgrade"
          className="inline-block text-sm font-medium underline underline-offset-4"
        >
          Upgrade to Pro →
        </a>
      </div>

    </div>
  </div>
</section>
      <Footer />
    </div>
  );
}
