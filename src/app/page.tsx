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
import { PdfExportButton } from "@/components/pro/pdf-export-button";
import { ShareButton } from "@/components/share-button";
import { useUsage } from "@/hooks/use-usage";
import { UsageMeter } from "@/components/usage-meter";
import { PricingCard } from "@/components/pricing-card";
import { PRICING } from "@/config/pricing";
import { PLANS } from "@/config/plans";

export default function Page() {
  const { isPro, isAuthed, usedThisMonth, limit, refetch, proJustActivated } = useUsage();

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
  const currentStage = analysis ? "review" : isAnalyzing ? "analyze" : "input";

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {/* Radial glow overlay */}
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />

      <Header />

      {proJustActivated && (
        <div className="border-b border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-center text-sm text-emerald-400">
          Pro activated — all features are now unlocked.
        </div>
      )}

      {/* HERO SECTION */}
      <section className="relative py-16 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-center">

            {/* Left: text content */}
            <div className="space-y-5 animate-fade-in-up">
              <h1 className="text-5xl md:text-6xl font-black tracking-tight">
                Catch risky, expensive AI prompts before they ship.
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                CostGuardAI scans prompts and AI workflows for jailbreak risk, ambiguity, hallucination risk, and cost blowups — before they hit production.
              </p>

              {/* CLI install block — above the fold, copy-paste ready */}
              <div
                id="install"
                className="bg-black/50 border border-white/[0.08] rounded-lg px-4 py-3 space-y-1 font-mono text-sm"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50 mb-2">
                  Quick install
                </div>
                <div>
                  <span className="text-muted-foreground/40 select-none">$ </span>
                  <span className="text-foreground">npm install -g @camj78/costguardai</span>
                </div>
                <div>
                  <span className="text-muted-foreground/40 select-none">$ </span>
                  <span className="text-foreground">costguardai analyze prompt.txt</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Get a CostGuardAI Safety Score, top risks, and fix recommendations in seconds.
              </p>

              {/* Primary + secondary CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                >
                  <a href="#install">Try the CLI</a>
                </Button>
                <a
                  href="/report/demo"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-4 py-2 rounded-md transition-colors"
                >
                  View Demo Report →
                </a>
                {isAuthed && (
                  <a
                    href="/dashboard"
                    className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Command Center →
                  </a>
                )}
              </div>

              {/* Proof bullets */}
              <ul className="space-y-1.5 pt-1">
                {[
                  "CLI-first workflow",
                  "Static shareable reports",
                  "GitHub + CI ready",
                ].map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0" aria-hidden="true" />
                    {bullet}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0" aria-hidden="true" />
                  <a href="/benchmarks" className="hover:text-foreground transition-colors">
                    See Benchmarks →
                  </a>
                </li>
              </ul>
            </div>

            {/* Right: static product preview — no animation, pointer-events-none */}
            <div className="hidden lg:block">
              <div className="glass-card p-6 space-y-4 pointer-events-none select-none">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Preflight Analysis
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                    gpt-4o
                  </span>
                </div>

                {/* CostGuardAI Safety Score — tier first, score subordinate */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400">
                    HIGH RISK
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black font-mono tabular-nums text-amber-400">72</span>
                    <span className="text-sm text-muted-foreground">/ 100</span>
                  </div>
                  <div className="flex gap-1 h-1.5">
                    <div className="flex-1 rounded-full bg-emerald-500/60" />
                    <div className="flex-1 rounded-full bg-amber-500/80" />
                    <div className="flex-1 rounded-full bg-red-500/25" />
                  </div>
                </div>

                {/* Token + Cost */}
                <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Input tokens</span>
                    <div className="text-lg font-mono tabular-nums font-bold">4,293</div>
                    <span className="text-xs text-muted-foreground">3.3% of 128K ctx</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cost / call</span>
                    <div className="text-lg font-mono tabular-nums font-bold">$0.0043</div>
                    <span className="text-xs text-muted-foreground">$430/day @ 100K</span>
                  </div>
                </div>

                {/* Top risk driver */}
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400">
                    Top Risk Factor
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Long instruction block with ambiguous scope raises hallucination probability at scale.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="px-4 sm:px-6 pb-4">
        <div className="mx-auto max-w-5xl space-y-2">
          {/* Row 1: Provider badges with precision tier */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-mono border border-white/[0.07] bg-white/[0.03] rounded-full px-3 py-1">
              <span className="text-muted-foreground">OpenAI</span>
              <span className="text-[10px] text-emerald-400">exact</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs font-mono border border-white/[0.07] bg-white/[0.03] rounded-full px-3 py-1">
              <span className="text-muted-foreground">Anthropic</span>
              <span className="text-[10px] text-foreground/60">±5–8%</span>
            </span>
            <span className="flex items-center gap-1.5 text-xs font-mono border border-white/[0.07] bg-white/[0.03] rounded-full px-3 py-1">
              <span className="text-muted-foreground">Gemini</span>
              <span className="text-[10px] text-foreground/60">±5–8%</span>
            </span>
          </div>
          {/* Row 2: Workflow integration chips */}
          <div className="flex flex-wrap items-center gap-2">
            {["API", "CLI", "CI/CD"].map((chip) => (
              <span key={chip} className="text-xs font-mono text-muted-foreground border border-white/[0.07] bg-white/[0.03] rounded-full px-3 py-1">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* WHY DEVELOPERS TRUST COSTGUARD */}
      <section className="px-4 sm:px-6 py-10 border-t border-white/[0.06]">
        <div className="mx-auto max-w-5xl space-y-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Why developers trust CostGuard
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            <div className="glass-card p-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Versioned Safety Score
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Benchmark-calibrated scoring with published methodology.
              </p>
            </div>

            <div className="glass-card p-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Prompt CVE Intelligence
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Detects known prompt vulnerability patterns with PCVE tracking.
              </p>
            </div>

            <div className="glass-card p-5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Privacy-Safe Analysis
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No raw prompts stored. Only anonymized structural fingerprints retained.
              </p>
            </div>

          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {[
              { label: "Methodology", href: "/methodology" },
              { label: "Vulnerabilities", href: "/vulnerabilities" },
              { label: "Examples", href: "/examples" },
              { label: "Benchmarks", href: "/benchmarks" },
              { label: "Calibration", href: "/methodology/calibration" },
            ].map(({ label, href }, i) => (
              <span key={label} className="flex items-center gap-4">
                {i > 0 && <span className="text-muted-foreground/20" aria-hidden="true">·</span>}
                <a
                  href={href}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {label} →
                </a>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* DISASTER GALLERY CARD */}
      <section className="px-4 sm:px-6 pb-8">
        <div className="mx-auto max-w-5xl">
          <div className="glass-card p-5 border border-red-900/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                AI Cost Disaster Gallery
              </p>
              <p className="text-sm font-semibold tracking-tight">
                5 real prompt failure patterns, before and after.
              </p>
              <p className="text-xs text-muted-foreground">
                Token explosion, prompt injection, runaway tool calls — see how CostGuardAI catches them before deploy.
              </p>
            </div>
            <a
              href="/examples"
              className="shrink-0 inline-flex items-center gap-2 text-xs font-semibold text-foreground/80 hover:text-foreground border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] px-4 py-2 rounded-md transition-colors"
            >
              View examples →
            </a>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Stage indicator — system state label, no decoration */}
          <div className="mb-4 flex items-center text-xs font-mono">
            {(["input", "analyze", "review", "ship"] as const).map((s, i) => (
              <span key={s}>
                {i > 0 && <span className="mx-2 text-muted-foreground/20">·</span>}
                <span className={currentStage === s ? "text-foreground" : "text-muted-foreground/30"}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              </span>
            ))}
          </div>
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
                  className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border-0"
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

              {/* Risk-based upgrade nudge — high/critical risk, free tier only */}
              {analysis && isAuthed && isPro === false && analysis.riskScore >= 60 && (
                <div className="glass-card p-4 space-y-2 border border-amber-500/20">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-400">
                    {analysis.riskScore >= 80 ? "Critical risk detected" : "High risk detected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {analysis.riskScore >= 80
                      ? `Risk score: ${analysis.riskScore}/100. At this level, structural issues and context saturation create high probability of silent failure at scale.`
                      : `Risk score: ${analysis.riskScore}/100. Track how this changes as you iterate — prompt drift is invisible without history.`}
                  </p>
                  <a
                    href="/upgrade"
                    className="inline-flex items-center text-xs text-primary/80 hover:text-primary font-medium transition-colors"
                  >
                    Unlock risk history to track drift →
                  </a>
                </div>
              )}

              {/* Pro: PDF Export */}
              {isPro && analysis && (
                <PdfExportButton
                  analysis={analysis}
                  model={model}
                  prompt={prompt}
                  compressionDelta={compressionDelta}
                />
              )}
            </div>

          </div>
        </div>
      </main>

      {/* HOW PREFLIGHT WORKS */}
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              How Preflight Works
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            <div className="glass-card p-6 space-y-3">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">1</span>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Analyze</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Estimate tokens, cost, compression, and risk before deployment.
              </p>
            </div>

            <div className="glass-card p-6 space-y-3">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">2</span>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Simulate</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Adjust output length and compare models to understand scale impact.
              </p>
            </div>

            <div className="glass-card p-6 space-y-3 border border-primary/20">
              <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">3</span>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Deploy Safely</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ship with predictable cost and reduced production risk.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* WHY THIS MATTERS */}
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Why This Matters
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            <div className="glass-card p-4 space-y-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Token Overflow</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Truncation → broken outputs → silent failure in production.
              </p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cost Drift</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Margins collapse at scale when token usage expands unnoticed.
              </p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">CostGuardAI Safety Score</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Signal of production instability — not legal advice, just operational risk.
              </p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Drift Tracking</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Monitor token and cost drift across model versions over time.
              </p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Batch Analysis</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Run preflight checks on multiple prompts simultaneously.
              </p>
            </div>

            <div className="glass-card p-4 space-y-1">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Model Comparison</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Compare cost and risk across models before committing to one.
              </p>
            </div>
          </div>
        </div>
      </section>

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PRICING.filter((t) => t.id !== PLANS.ENTERPRISE).map((tier) => (
              <PricingCard
                key={tier.id}
                tier={tier}
                interval="monthly"
                comingSoon={tier.id === PLANS.TEAM}
              />
            ))}
          </div>
        </div>
      </section>

      {/* UPGRADE CTA — conditional, only for non-Pro users, directly beneath Pricing */}
      {isPro === false && (
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
                className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] px-6"
              >
                <a href="/upgrade">Upgrade to Pro</a>
              </Button>
              <p className="text-xs text-muted-foreground">
                No prompt data ever leaves your browser.
              </p>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
