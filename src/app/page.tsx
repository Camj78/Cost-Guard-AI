"use client";

import { usePreflight } from "@/hooks/use-preflight";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { PromptInput } from "@/components/prompt-input";
import { ModelSelector } from "@/components/model-selector";
import { OutputSlider } from "@/components/output-slider";
import { CompressionPanel } from "@/components/compression-panel";
import { ResultsPanel } from "@/components/results-panel";
import { ModelAssumptions } from "@/components/model-assumptions";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function Page() {
  const {
    prompt,
    modelId,
    expectedOutputTokens,
    analysis,
    isAnalyzing,
    compressionPreview,
    compressionDelta,
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
            <div className="lg:sticky lg:top-6">
              <ResultsPanel
                analysis={analysis}
                isAnalyzing={isAnalyzing}
                hasPrompt={hasPrompt}
              />
            </div>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
