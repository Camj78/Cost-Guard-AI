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
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { Zap } from "lucide-react";
import { GITHUB_APP_INSTALL_URL } from "@/config/github";

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

// ─── Mock data for Dashboard V1 (replace with live API in V2) ─────────────────

const MOCK_KPI = {
  riskScore: 72,
  aiCostToday: 18.42,
  projectedMonthly: 542,
  activeAlerts: 2,
};

type AlertSeverity = "high" | "medium";
type RepoStatus = "alert" | "warning" | "ok";

interface MockAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  repo: string;
  detail: string;
}

interface MockRepo {
  name: string;
  status: RepoStatus;
  riskScore: number;
  costPerDay: string;
}

interface MockScan {
  repo: string;
  ago: string;
  riskScore: number;
  status: RepoStatus;
}

const MOCK_ALERTS: MockAlert[] = [
  {
    id: "a1",
    severity: "high",
    title: "Prompt injection risk detected",
    repo: "checkout-service",
    detail: "Untrusted user input detected in system prompt template.",
  },
  {
    id: "a2",
    severity: "medium",
    title: "Token usage spike detected",
    repo: "summarizer-worker",
    detail: "Token usage 340% above 7-day baseline.",
  },
];

const MOCK_COST_TREND: Record<string, string | number>[] = [
  { day: "02-22", cost: 12.4 }, { day: "02-23", cost: 14.8 }, { day: "02-24", cost: 11.2 },
  { day: "02-25", cost: 15.6 }, { day: "02-26", cost: 13.9 }, { day: "02-27", cost: 16.2 },
  { day: "02-28", cost: 17.4 }, { day: "03-01", cost: 14.1 }, { day: "03-02", cost: 18.9 },
  { day: "03-03", cost: 16.5 }, { day: "03-04", cost: 15.8 }, { day: "03-05", cost: 19.2 },
  { day: "03-06", cost: 17.6 }, { day: "03-07", cost: 18.4 },
];

const MOCK_RISK_TREND: Record<string, string | number>[] = [
  { day: "02-22", score: 58 }, { day: "02-23", score: 62 }, { day: "02-24", score: 55 },
  { day: "02-25", score: 68 }, { day: "02-26", score: 64 }, { day: "02-27", score: 70 },
  { day: "02-28", score: 66 }, { day: "03-01", score: 72 }, { day: "03-02", score: 75 },
  { day: "03-03", score: 69 }, { day: "03-04", score: 71 }, { day: "03-05", score: 78 },
  { day: "03-06", score: 74 }, { day: "03-07", score: 72 },
];

const MOCK_REPOS: MockRepo[] = [
  { name: "checkout-service",  status: "alert",   riskScore: 72, costPerDay: "$8.40/day" },
  { name: "summarizer-worker", status: "warning",  riskScore: 58, costPerDay: "$6.20/day" },
  { name: "support-bot",       status: "ok",       riskScore: 31, costPerDay: "$3.82/day" },
];

const MOCK_RECENT_SCANS: MockScan[] = [
  { repo: "checkout-service",  ago: "12 min ago", riskScore: 72, status: "alert"   },
  { repo: "summarizer-worker", ago: "26 min ago", riskScore: 58, status: "warning" },
  { repo: "support-bot",       ago: "1 hr ago",   riskScore: 31, status: "ok"      },
];

// ─── Mini bar chart (inline SVG, no dependencies) ─────────────────────────────

function MiniBarChart({
  data,
  valueKey,
  labelKey,
  height = 80,
  colorClass = "fill-primary",
}: {
  data: Record<string, string | number>[];
  valueKey: string;
  labelKey: string;
  height?: number;
  colorClass?: string;
}) {
  if (data.length === 0) return null;
  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 1);
  const barW = 30;
  const gap = 3;
  const totalW = data.length * (barW + gap) - gap;
  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={height} aria-label="Trend chart" className="block">
        {data.map((d, i) => {
          const val = Number(d[valueKey]);
          const barH = Math.max(2, Math.round((val / max) * (height - 14)));
          const x = i * (barW + gap);
          const y = height - 14 - barH;
          return (
            <g key={i}>
              <title>{`${d[labelKey]}: ${val}`}</title>
              <rect x={x} y={y} width={barW} height={barH} rx={2} className={`${colorClass} opacity-60`} />
            </g>
          );
        })}
        {data.length > 1 && (
          <>
            <text x={0} y={height - 1} fontSize={9} className="fill-muted-foreground" fontFamily="monospace">
              {String(data[0][labelKey])}
            </text>
            <text x={totalW} y={height - 1} fontSize={9} textAnchor="end" className="fill-muted-foreground" fontFamily="monospace">
              {String(data[data.length - 1][labelKey])}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: RepoStatus }) {
  const cls =
    status === "alert"   ? "bg-red-400" :
    status === "warning" ? "bg-amber-400" :
                           "bg-emerald-400";
  return <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${cls}`} />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { isPro, isAuthed } = useUsage();

  // ── Onboarding state ───────────────────────────────────────────────────────
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cg_onboarding_completed") === "true";
  });
  const [onboardingModalVisible, setOnboardingModalVisible] = useState(true);

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
  } = usePreflight({
    onRecorded: fetchAnalyses,
    plan: isPro === null ? undefined : isPro ? "pro" : "free",
    onOnboardingComplete: useCallback(() => setOnboardingCompleted(true), []),
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchPrompts(controller.signal);
    fetchAnalyses(controller.signal);
    return () => controller.abort();
  }, [fetchPrompts, fetchAnalyses]);

  const hasPrompt = prompt.trim().length > 0;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleLoadExample(examplePrompt: string) {
    setPrompt(examplePrompt);
    setOnboardingModalVisible(false);
  }

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
      {!onboardingCompleted && onboardingModalVisible && (
        <OnboardingModal onLoadExample={handleLoadExample} />
      )}

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
            <h2 className="text-2xl font-semibold tracking-tight">AI Cost Command Center</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor AI cost, risk, and active alerts across your repos.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* ── KPI Strip ───────────────────────────────────────────────────── */}
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

              {/* RiskScore */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  RiskScore
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none text-orange-400">
                  {MOCK_KPI.riskScore}
                </p>
                <p className="text-xs mt-1 text-orange-400">High</p>
              </div>

              {/* AI Cost Today */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  AI Cost Today
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none">
                  ${MOCK_KPI.aiCostToday.toFixed(2)}
                </p>
              </div>

              {/* Projected Monthly */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Projected Monthly
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none">
                  ${MOCK_KPI.projectedMonthly}
                </p>
              </div>

              {/* Active Alerts */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Active Alerts
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none text-red-400">
                  {MOCK_KPI.activeAlerts}
                </p>
                <p className="text-xs mt-1 text-red-400">Needs attention</p>
              </div>

            </div>
          </section>

          {/* ── Active Alerts ────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Active Alerts
              </p>
              <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 font-mono tabular-nums">
                {MOCK_KPI.activeAlerts}
              </span>
            </div>

            <div className="glass-card divide-y divide-border">
              {MOCK_ALERTS.map((alert) => (
                <div key={alert.id} className="flex items-start gap-4 px-6 py-4">
                  <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] border ${
                    alert.severity === "high"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    {alert.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{alert.repo}</span>
                      {" · "}
                      {alert.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Trends ──────────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Trends — Last 14 Days
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* AI Cost Over Time */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    AI Cost Over Time
                  </p>
                  <p className="font-mono tabular-nums text-xs text-muted-foreground">
                    ${MOCK_KPI.aiCostToday.toFixed(2)} today
                  </p>
                </div>
                <MiniBarChart
                  data={MOCK_COST_TREND}
                  valueKey="cost"
                  labelKey="day"
                  height={80}
                />
              </div>

              {/* RiskScore Trend */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    RiskScore Trend
                  </p>
                  <p className="font-mono tabular-nums text-xs text-orange-400">
                    {MOCK_KPI.riskScore} today
                  </p>
                </div>
                <MiniBarChart
                  data={MOCK_RISK_TREND}
                  valueKey="score"
                  labelKey="day"
                  height={80}
                  colorClass="fill-orange-500"
                />
              </div>

            </div>
          </section>

          {/* ── Context Panels ───────────────────────────────────────────────── */}
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Monitored Repositories */}
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Monitored Repositories
                  </p>
                  <Link
                    href={GITHUB_APP_INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    + Add repo
                  </Link>
                </div>
                <div className="divide-y divide-border">
                  {MOCK_REPOS.map((repo) => (
                    <div key={repo.name} className="flex items-center justify-between gap-4 px-6 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={repo.status} />
                        <p className="text-sm font-mono truncate">{repo.name}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={`font-mono tabular-nums text-xs rounded-full px-2 py-0.5 font-medium ${riskBadgeClass(repo.riskScore)}`}>
                          {repo.riskScore}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono tabular-nums">
                          {repo.costPerDay}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Scans */}
              <div className="glass-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Recent Scans
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {MOCK_RECENT_SCANS.map((scan, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 px-6 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={scan.status} />
                        <p className="text-sm font-mono truncate">{scan.repo}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={`font-mono tabular-nums text-xs rounded-full px-2 py-0.5 font-medium ${riskBadgeClass(scan.riskScore)}`}>
                          {scan.riskScore}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {scan.ago}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>

          {/* ── Preflight Analysis ───────────────────────────────────────────── */}
          <div className="border-t border-white/5 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Preflight Analysis
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Run preflight, review results, and track drift over time.
            </p>
          </div>

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
