"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { MODELS } from "@/config/models";
import { formatCost, formatNumber } from "@/lib/formatters";
import { usePreflight } from "@/hooks/use-preflight";
import { useUsage } from "@/hooks/use-usage";
import { PromptInput } from "@/components/prompt-input";
import { ModelSelector } from "@/components/model-selector";
import { OutputSlider } from "@/components/output-slider";
import { CompressionPanel } from "@/components/compression-panel";
import { ResultsPanel } from "@/components/results-panel";
import { ModelAssumptions } from "@/components/model-assumptions";
import { CostAtScalePanel } from "@/components/cost-at-scale-panel";
import { ModelComparisonPanel } from "@/components/pro/model-comparison-panel";
import { BatchAnalysisPanel } from "@/components/pro/batch-analysis-panel";
import { RiskHistoryPanel } from "@/components/pro/risk-history-panel";
import { ShareButton } from "@/components/share-button";
import { PdfExportButton } from "@/components/pro/pdf-export-button";
import { Zap } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  model_id: string;
  created_at: string;
  updated_at: string;
}

interface AnalysisEntry {
  id: string;
  prompt_hash: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_total: number;
  risk_score: number;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getModelName(modelId: string): string {
  return MODELS.find((m) => m.id === modelId)?.name ?? modelId;
}

function riskBadgeClass(score: number): string {
  if (score <= 24) return "text-emerald-400 bg-emerald-500/10";
  if (score <= 49) return "text-blue-400 bg-blue-500/10";
  if (score <= 69) return "text-amber-400 bg-amber-500/10";
  if (score <= 84) return "text-orange-400 bg-orange-500/10";
  return "text-red-400 bg-red-500/10";
}

function riskLabel(score: number): string {
  if (score <= 24) return "Safe";
  if (score <= 49) return "Low";
  if (score <= 69) return "Warning";
  if (score <= 84) return "High";
  return "Critical";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { isPro, isAuthed } = useUsage();

  // ── Server data state ──────────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgradeRedirect, setNeedsUpgradeRedirect] = useState(false);

  // ── Save form state ────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savePromptText, setSavePromptText] = useState("");
  const [saveModelId, setSaveModelId] = useState(MODELS[0].id);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  // ── Selected prompt (for RiskHistoryPanel) ────────────────────────────────
  const [selectedSavedPromptId, setSelectedSavedPromptId] = useState<string | null>(null);

  // ── Fetch callbacks (defined before usePreflight so we can pass fetchAnalyses) ──
  const fetchPrompts = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/prompts", { signal });
      if (res.status === 401) {
        setNeedsUpgradeRedirect(true);
        return;
      }
      if (res.status === 403) {
        return;
      }
      const d = await res.json();
      setPrompts(d.prompts ?? []);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError("Failed to load saved prompts.");
    } finally {
      setLoadingPrompts(false);
    }
  }, []);

  const fetchAnalyses = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/analyses", { signal });
      if (res.ok) {
        const d = await res.json();
        setAnalyses(d.analyses ?? []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingAnalyses(false);
    }
  }, []);

  // Redirect on 401 — kept in a dedicated effect so fetchPrompts stays stable ([] deps)
  useEffect(() => {
    if (!needsUpgradeRedirect) return;
    router.replace("/upgrade?next=/dashboard");
  }, [needsUpgradeRedirect, router]);

  // ── Preflight tool ─────────────────────────────────────────────────────────
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
  } = usePreflight({ onRecorded: fetchAnalyses });

  useEffect(() => {
    const controller = new AbortController();
    fetchPrompts(controller.signal);
    fetchAnalyses(controller.signal);
    return () => controller.abort();
  }, [fetchPrompts, fetchAnalyses]);

  const hasPrompt = prompt.trim().length > 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      if (selectedSavedPromptId === id) setSelectedSavedPromptId(null);
    }
  }

  function handleLoad(p: SavedPrompt) {
    setPrompt(p.prompt);
    setModelId(p.model_id);
    setSelectedSavedPromptId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const name = saveName.trim();
    const prompt = savePromptText.trim();
    if (!name || !prompt) return;

    setSaveBusy(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt, model_id: saveModelId }),
      });
      const d = await res.json();
      if (!res.ok) {
        setSaveError(d.error ?? "Failed to save prompt.");
      } else {
        setPrompts((prev) => [d.prompt, ...prev]);
        setSaveName("");
        setSavePromptText("");
        setSaveModelId(MODELS[0].id);
        setIsSaving(false);
      }
    } catch {
      setSaveError("Something went wrong.");
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* STATUS BAR */}
      <div className="border-b border-white/5 bg-white/[0.02] px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-5xl flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Home
          </Link>
          <span className="text-border">·</span>
          {isPro && (
            <span className="inline-flex items-center font-medium text-primary border border-primary/30 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]">
              Pro
            </span>
          )}
          <span>Pro plan active</span>
          <span className="text-border">·</span>
          <span>Priority features enabled</span>
          {analyses[0] && (
            <>
              <span className="text-border">·</span>
              <span>
                Last run:{" "}
                {new Date(analyses[0].created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </>
          )}
        </div>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-12">

          {/* Page heading */}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Command Center</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Run preflight, review results, and track drift over time.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* ── Step 1 — Input ──────────────────────────────────────────────── */}
          <section className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Step 1 — Input
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

              {/* Left: Input controls */}
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

              {/* Right: Results (sticky) */}
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

                {analysis && (
                  <ShareButton
                    analysis={analysis}
                    analysisId={lastAnalysisId}
                    model={model}
                    isAuthed={isAuthed}
                  />
                )}

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
          </section>

          {/* ── Step 2 — Track ──────────────────────────────────────────────── */}
          <section className="space-y-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Step 2 — Track
            </p>

            {/* Saved Prompts + Risk History — Pro only */}
            {isPro === true && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Saved Prompts */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Saved Prompts
                  </h3>
                  {!isSaving && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-white/10 hover:bg-white/10"
                      onClick={() => setIsSaving(true)}
                    >
                      Save prompt
                    </Button>
                  )}
                </div>

                {/* Save form */}
                {isSaving && (
                  <form
                    onSubmit={handleSave}
                    className="glass-card p-6 space-y-3"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                      New saved prompt
                    </p>
                    <input
                      type="text"
                      required
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <textarea
                      required
                      value={savePromptText}
                      onChange={(e) => setSavePromptText(e.target.value)}
                      placeholder="Prompt text"
                      rows={4}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <select
                        value={saveModelId}
                        onChange={(e) => setSaveModelId(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {MODELS.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={saveBusy}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 border-0 text-xs"
                      >
                        {saveBusy ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs border-white/10 hover:bg-white/10"
                        onClick={() => {
                          setIsSaving(false);
                          setSaveError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    {saveError && (
                      <p className="text-xs text-destructive">{saveError}</p>
                    )}
                  </form>
                )}

                <div className="glass-card overflow-hidden">
                  {loadingPrompts ? (
                    <p className="text-sm text-muted-foreground p-6 text-center">
                      Loading…
                    </p>
                  ) : prompts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-lg">
                      No saved prompts yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {prompts.map((p) => (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between gap-4 px-6 py-4 transition-colors ${
                            selectedSavedPromptId === p.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {getModelName(p.model_id)} &middot;{" "}
                              {new Date(p.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-white/10 hover:bg-white/10"
                              onClick={() => handleLoad(p)}
                            >
                              Load
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                              onClick={() => handleDelete(p.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Risk History */}
              <div className="glass-card p-6">
                <RiskHistoryPanel
                  savedPromptId={selectedSavedPromptId}
                  historyVersion={0}
                />
              </div>

            </div>
            )}

            {/* Analysis History */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Analysis History
              </h3>
              <p className="text-xs text-muted-foreground -mt-1">
                Last 50 runs. Token counts and cost only — prompt text is never stored.
              </p>

              <div className="glass-card overflow-hidden">
                {loadingAnalyses ? (
                  <p className="text-sm text-muted-foreground p-6 text-center">
                    Loading…
                  </p>
                ) : analyses.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-lg">
                    No analyses recorded yet. Run a preflight above.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-6 font-medium text-muted-foreground">
                            Date
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                            Model
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                            Tokens in
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                            Tokens out
                          </th>
                          <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                            Cost
                          </th>
                          <th className="text-right py-3 px-6 font-medium text-muted-foreground">
                            Risk
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyses.map((a) => (
                          <tr
                            key={a.id}
                            className="border-b border-border last:border-0 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-3 px-6 text-muted-foreground whitespace-nowrap">
                              {new Date(a.created_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                              {getModelName(a.model_id)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {formatNumber(a.input_tokens)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {formatNumber(a.output_tokens)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              {formatCost(a.cost_total)}
                            </td>
                            <td className="py-3 px-6 text-right">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${riskBadgeClass(
                                  a.risk_score
                                )}`}
                              >
                                {a.risk_score} {riskLabel(a.risk_score)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Step 3 — Simulate (Pro only) ────────────────────────────────── */}
          {isPro && (
            <section className="space-y-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Step 3 — Simulate
              </p>

              <CostAtScalePanel
                analysis={analysis}
                model={model}
              />

              <ModelComparisonPanel
                prompt={prompt}
                expectedOutputTokens={expectedOutputTokens}
              />

              <BatchAnalysisPanel
                model={model}
                expectedOutputTokens={expectedOutputTokens}
              />
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
