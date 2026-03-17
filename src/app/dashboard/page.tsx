"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import Link from "next/link";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { MODELS } from "@/config/models";
import { formatCost, formatNumber } from "@/lib/formatters";
import {
  deriveAlerts,
  estimateCostSaved,
  type DerivedAlert,
  type AlertSeverity,
} from "@/lib/alerts/deriveAlerts";
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
import { addHistoryEntry } from "@/lib/analysis-history";
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

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getModelName(modelId: string): string {
  return MODELS.find((m) => m.id === modelId)?.name ?? modelId;
}

/** Badge styling based on CostGuardAI Safety Score band (input is risk_score 0–100). */
function riskBadgeClass(score: number): string {
  const s = 100 - score; // convert to safety score
  if (s >= 85) return "text-emerald-400 bg-emerald-500/10";
  if (s >= 70) return "text-blue-400 bg-blue-500/10";
  if (s >= 40) return "text-amber-400 bg-amber-500/10";
  return "text-red-400 bg-red-500/10";
}

/** Safety band label based on CostGuardAI Safety Score (input is risk_score 0–100). */
function riskLabel(score: number): string {
  const s = 100 - score; // convert to safety score
  if (s >= 85) return "Safe";
  if (s >= 70) return "Low";
  if (s >= 40) return "Warning";
  return "High";
}

// ─── Dashboard helpers ─────────────────────────────────────────────────────────

type RepoStatus = "alert" | "warning" | "ok";

function riskToStatus(score: number): RepoStatus {
  if (score >= 70) return "alert";
  if (score >= 50) return "warning";
  return "ok";
}

function timeAgo(isoStr: string): string {
  const ms = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} days ago`;
}

function getTodayCost(analyses: AnalysisEntry[]): number {
  const today = new Date().toDateString();
  return analyses
    .filter((a) => new Date(a.created_at).toDateString() === today)
    .reduce((sum, a) => sum + a.cost_total, 0);
}

function getProjectedMonthly(analyses: AnalysisEntry[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = analyses.filter(
    (a) => new Date(a.created_at).getTime() >= cutoff
  );
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, a) => sum + a.cost_total, 0);
  return (total / 7) * 30;
}

function buildCostTrend(
  analyses: AnalysisEntry[],
  days = 14
): Record<string, string | number>[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = analyses.filter(
    (a) => new Date(a.created_at).getTime() >= cutoff
  );
  const byDay = new Map<string, number>();
  inWindow.forEach((a) => {
    const day = new Date(a.created_at).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
    });
    byDay.set(day, (byDay.get(day) ?? 0) + a.cost_total);
  });
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, cost]) => ({ day, cost }));
}

function buildRiskTrend(
  analyses: AnalysisEntry[],
  days = 14
): Record<string, string | number>[] {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const inWindow = analyses.filter(
    (a) => new Date(a.created_at).getTime() >= cutoff
  );
  const byDay = new Map<string, number[]>();
  inWindow.forEach((a) => {
    const day = new Date(a.created_at).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
    });
    const arr = byDay.get(day) ?? [];
    arr.push(100 - a.risk_score);
    byDay.set(day, arr);
  });
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, scores]) => ({
      day,
      score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    }));
}

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
  const { isPro, plan, isAuthed, firstName, isFounder } = useUsage();

  // ── Onboarding state ───────────────────────────────────────────────────────
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cg_onboarding_completed") === "true";
  });
  const [onboardingModalVisible, setOnboardingModalVisible] = useState(true);

  // ── Server data state ──────────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [loadingAnalyses, setLoadingAnalyses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsUpgradeRedirect, setNeedsUpgradeRedirect] = useState(false);

  // ── Personalized greeting ───────────────────────────────────────────────────
  const [emailFallback, setEmailFallback] = useState("");
  const [sessionGreeting, setSessionGreeting] = useState("");
  const greetingInitRef = useRef(false);

  // ── Save form state ────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savePromptText, setSavePromptText] = useState("");
  const [saveModelId, setSaveModelId] = useState(MODELS[0].id);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  // ── Selected prompt (for RiskHistoryPanel) ────────────────────────────────
  const [selectedSavedPromptId, setSelectedSavedPromptId] = useState<string | null>(null);

  // ── Risk History version (increment to trigger RiskHistoryPanel refresh) ───
  const [historyVersion, setHistoryVersion] = useState(0);
  const prevAnalysisRef = useRef<object | null>(null);

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

  const fetchRepos = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/github/repos", { signal });
      if (res.ok) {
        const d = await res.json();
        setRepos(d.repos ?? []);
      }
    } catch {
      // Non-critical — repos panel degrades to empty state
    }
  }, []);

  // Redirect on 401 — kept in a dedicated effect so fetchPrompts stays stable ([] deps)
  useEffect(() => {
    if (!needsUpgradeRedirect) return;
    router.replace("/upgrade?next=/dashboard");
  }, [needsUpgradeRedirect, router]);

  // ── Greeting init (runs once per mount, session-stable) ────────────────────
  useEffect(() => {
    if (greetingInitRef.current) return;
    greetingInitRef.current = true;

    const WITTY: string[] = [
      "Ready to catch token drift before production does?",
      "Let's make sure your prompts don't cost you sleep tonight.",
      "Time to run preflight before you ship.",
      "Your prompts are waiting for a safety check.",
      "Cheaper tokens start with smarter preflight.",
    ];

    const KEY = "cg_session_greeting";
    const stored = sessionStorage.getItem(KEY);
    if (stored) {
      setSessionGreeting(stored);
    } else {
      const chosen = WITTY[Math.floor(Math.random() * WITTY.length)];
      sessionStorage.setItem(KEY, chosen);
      setSessionGreeting(chosen);
    }

    const sb = getSupabaseBrowser();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setEmailFallback((user.email ?? "").split("@")[0]);
    });
  }, []);

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
    plan: plan ?? undefined,
    onOnboardingComplete: useCallback(() => setOnboardingCompleted(true), []),
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchPrompts(controller.signal);
    fetchAnalyses(controller.signal);
    fetchRepos(controller.signal);
    return () => controller.abort();
  }, [fetchPrompts, fetchAnalyses, fetchRepos]);

  // ── GitHub install success: re-fetch repos and clean the URL ───────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_install") !== "success") return;
    fetchRepos().then(() => {
      router.replace("/dashboard");
    });
  }, [fetchRepos, router]);

  // ── Record analysis to Risk History when a new result arrives ──────────────
  useEffect(() => {
    if (analysis && analysis !== prevAnalysisRef.current && selectedSavedPromptId) {
      addHistoryEntry(selectedSavedPromptId, analysis);
      setHistoryVersion((v) => v + 1);
    }
    prevAnalysisRef.current = analysis;
  }, [analysis, selectedSavedPromptId]);

  const hasPrompt = prompt.trim().length > 0;
  const currentStage = analysis ? "review" : isAnalyzing ? "analyze" : "input";

  // ── Derived dashboard metrics ───────────────────────────────────────────────
  const derivedAlerts: DerivedAlert[] = deriveAlerts({ analysisHistory: analyses });
  const aiCostToday = getTodayCost(analyses);
  const projectedMonthly = getProjectedMonthly(analyses);
  const latestRiskScore = analyses[0]?.risk_score ?? null;
  const costSaved = estimateCostSaved(analyses);
  const costTrend = buildCostTrend(analyses);
  const riskTrend = buildRiskTrend(analyses);
  const recentScans = analyses.slice(0, 5);

  // ── Greeting display name (firstName always wins; email prefix as fallback) ─
  const displayName = firstName?.trim() || emailFallback || "there";

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
      {!onboardingCompleted && onboardingModalVisible && isPro === true && (
        <OnboardingModal onLoadExample={handleLoadExample} />
      )}

      <Header />

      {/* Free plan gate — render nothing until plan is resolved from /api/me */}
      {plan === null ? null : isAuthed && plan === "free" ? (
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-20">
          <div className="max-w-md w-full border border-white/[0.07] rounded-lg p-8 space-y-6">
            {/* Personalized greeting */}
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                Hi {displayName},
              </h2>
              {sessionGreeting && (
                <p className="text-sm text-muted-foreground">{sessionGreeting}</p>
              )}
            </div>

            {/* Gate label + Pro benefits */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                AI Cost Command Center
              </p>
              <p className="text-sm text-muted-foreground">
                Pro unlocks three things you need once you&apos;re shipping:
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted-foreground" />
                  Historical usage visibility
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted-foreground" />
                  Saved analysis workflow
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-muted-foreground" />
                  Personal AI cost command center
                </li>
              </ul>
            </div>

            <a
              href="/pricing"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2.5 text-sm font-medium transition-colors"
            >
              View pricing
            </a>
            <p className="text-xs text-muted-foreground">
              <Link href="/" className="hover:underline">← Back to preflight tool</Link>
            </p>
          </div>
        </main>
      ) : (
        <>
          {/* STATUS BAR */}
          <div className="border-b border-white/5 bg-white/[0.02] px-4 sm:px-6 py-3">
            <div className="mx-auto max-w-5xl flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Home
              </Link>
              {isPro && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center font-medium text-primary border border-primary/30 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]">
                    Pro
                  </span>
                  <span>Pro plan active</span>
                  <span className="text-border">·</span>
                  <span>Priority features enabled</span>
                </>
              )}
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
              {isFounder && (
                <>
                  <span className="text-border">·</span>
                  <Link
                    href="/founder"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Founder Dashboard
                  </Link>
                </>
              )}
            </div>
          </div>

          <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-12">

          {/* Personalized greeting */}
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Hi {displayName},
            </h2>
            {sessionGreeting && (
              <p className="text-sm text-muted-foreground">{sessionGreeting}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* ── KPI Strip ───────────────────────────────────────────────────── */}
          <section>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

              {/* Safety Score (inverted from raw risk_score) */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Safety Score
                </p>
                {latestRiskScore !== null ? (
                  <>
                    <p className={`font-mono tabular-nums text-2xl font-semibold leading-none ${riskBadgeClass(latestRiskScore).split(" ")[0]}`}>
                      {100 - latestRiskScore}
                    </p>
                    <p className={`text-xs mt-1 ${riskBadgeClass(latestRiskScore).split(" ")[0]}`}>
                      {riskLabel(latestRiskScore)}
                    </p>
                  </>
                ) : (
                  <p className="font-mono tabular-nums text-2xl font-semibold leading-none text-muted-foreground">—</p>
                )}
              </div>

              {/* AI Cost Today */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  AI Cost Today
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none">
                  {aiCostToday > 0 ? formatCost(aiCostToday) : "—"}
                </p>
              </div>

              {/* Projected Monthly */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Projected Monthly
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none">
                  {projectedMonthly > 0 ? formatCost(projectedMonthly) : "—"}
                </p>
              </div>

              {/* Active Alerts */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Active Alerts
                </p>
                {derivedAlerts.length > 0 ? (
                  <>
                    <p className="font-mono tabular-nums text-2xl font-semibold leading-none text-red-400">
                      {derivedAlerts.length}
                    </p>
                    <p className="text-xs mt-1 text-red-400">Needs attention</p>
                  </>
                ) : (
                  <>
                    <p className="font-mono tabular-nums text-2xl font-semibold leading-none text-emerald-400">0</p>
                    <p className="text-xs mt-1 text-emerald-400">All clear</p>
                  </>
                )}
              </div>

              {/* Estimated Cost Saved */}
              <div className="glass-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  Est. Cost Saved
                </p>
                {costSaved > 0 ? (
                  <>
                    <p className="font-mono tabular-nums text-2xl font-semibold leading-none text-emerald-400">
                      {formatCost(costSaved)}
                    </p>
                    <p className="text-xs mt-1 text-emerald-400">via risk flags</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">No savings calculated yet</p>
                )}
              </div>

            </div>
          </section>

          {/* ── Active Alerts ────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Active Alerts
              </p>
              {derivedAlerts.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 font-mono tabular-nums">
                  {derivedAlerts.length}
                </span>
              )}
            </div>

            <div className="glass-card divide-y divide-border">
              {derivedAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 py-5 text-center">
                  No active alerts.
                </p>
              ) : (
                derivedAlerts.map((alert) => (
                  <div key={alert.id} className="flex items-start gap-4 px-6 py-4">
                    <span className={`mt-0.5 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] border ${
                      alert.severity === "high"
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : alert.severity === "medium"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/20"
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
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        Detected {timeAgo(alert.detectedAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
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
                    {aiCostToday > 0 ? `${formatCost(aiCostToday)} today` : "No data yet"}
                  </p>
                </div>
                {costTrend.length > 0 ? (
                  <MiniBarChart
                    data={costTrend}
                    valueKey="cost"
                    labelKey="day"
                    height={80}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Run a preflight to start tracking.</p>
                )}
              </div>

              {/* Safety Score Trend */}
              <div className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Safety Score Trend
                  </p>
                  {latestRiskScore !== null && (
                    <p className={`font-mono tabular-nums text-xs ${riskBadgeClass(latestRiskScore).split(" ")[0]}`}>
                      {100 - latestRiskScore} today
                    </p>
                  )}
                </div>
                {riskTrend.length > 0 ? (
                  <MiniBarChart
                    data={riskTrend}
                    valueKey="score"
                    labelKey="day"
                    height={80}
                    colorClass="fill-orange-500"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Run a preflight to start tracking.</p>
                )}
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
                {repos.length > 0 ? (
                  <div className="divide-y divide-border">
                    {repos.slice(0, 8).map((repo) => (
                      <div key={repo.id} className="flex items-center justify-between gap-4 px-6 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusDot status="ok" />
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-mono truncate hover:text-primary transition-colors"
                          >
                            {repo.full_name}
                          </a>
                        </div>
                        {repo.private && (
                          <span className="shrink-0 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                            private
                          </span>
                        )}
                      </div>
                    ))}
                    {repos.length > 8 && (
                      <p className="px-6 py-3 text-xs text-muted-foreground">
                        +{repos.length - 8} more
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">No repositories connected.</p>
                    <Link
                      href={GITHUB_APP_INSTALL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Install the GitHub app to monitor repos →
                    </Link>
                  </div>
                )}
              </div>

              {/* Recent Scans */}
              <div className="glass-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Recent Preflight Runs
                  </p>
                </div>
                {recentScans.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-6 py-5 text-center">
                    No analyses recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {recentScans.map((scan) => (
                      <div key={scan.id} className="flex items-center justify-between gap-4 px-6 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusDot status={riskToStatus(scan.risk_score)} />
                          <p className="text-sm font-mono truncate">{getModelName(scan.model_id)}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className={`font-mono tabular-nums text-xs rounded-full px-2 py-0.5 font-medium ${riskBadgeClass(scan.risk_score)}`}>
                            {100 - scan.risk_score}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {timeAgo(scan.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Step 1 — Input
              </p>
              {/* Stage indicator — mirrors home page workflow framing */}
              <div className="flex items-center text-xs font-mono">
                {(["input", "analyze", "review", "ship"] as const).map((s, i) => (
                  <span key={s}>
                    {i > 0 && <span className="mx-2 text-muted-foreground/20">·</span>}
                    <span className={currentStage === s ? "text-foreground" : "text-muted-foreground/30"}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </span>
                  </span>
                ))}
              </div>
            </div>

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
                  historyVersion={historyVersion}
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
                                {100 - a.risk_score} {riskLabel(a.risk_score)}
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
      </>
    )}
    </div>
  );
}
