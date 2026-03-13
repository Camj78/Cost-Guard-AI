"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Header } from "@/components/header";
import { formatNumber } from "@/lib/formatters";
import type { ObsPayload, DailyRow, TopModelRow, TopPromptRow } from "@/app/api/observability/route";

// ── Spark bar chart (inline SVG, no dependencies) ─────────────────────────────

function BarChart({
  data,
  valueKey,
  labelKey,
  height = 80,
}: {
  data: Record<string, number | string>[];
  valueKey: string;
  labelKey: string;
  height?: number;
}) {
  if (data.length === 0) return null;

  const values = data.map((d) => Number(d[valueKey]));
  const max = Math.max(...values, 1);
  const barW = Math.max(4, Math.floor(560 / data.length) - 2);
  const gap = 2;
  const totalW = data.length * (barW + gap);

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalW}
        height={height}
        aria-label="Bar chart"
        className="block"
      >
        {data.map((d, i) => {
          const val = Number(d[valueKey]);
          const barH = Math.max(2, Math.round((val / max) * (height - 16)));
          const x = i * (barW + gap);
          const y = height - 16 - barH;
          return (
            <g key={String(d[labelKey]) + i}>
              <title>{`${d[labelKey]}: ${formatNumber(val)}`}</title>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                className="fill-primary opacity-70"
              />
            </g>
          );
        })}
        {/* X-axis label: first + last */}
        {data.length > 1 && (
          <>
            <text
              x={0}
              y={height - 2}
              fontSize={9}
              className="fill-muted-foreground"
              fontFamily="monospace"
            >
              {String(data[0][labelKey]).slice(5)}
            </text>
            <text
              x={totalW}
              y={height - 2}
              fontSize={9}
              textAnchor="end"
              className="fill-muted-foreground"
              fontFamily="monospace"
            >
              {String(data[data.length - 1][labelKey]).slice(5)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ── Aggregated daily data helpers ─────────────────────────────────────────────

function aggregateDailyByDay(rows: DailyRow[]) {
  const map = new Map<string, { day: string; calls: number; total_tokens: number }>();
  for (const r of rows) {
    const existing = map.get(r.day);
    if (existing) {
      existing.calls += r.calls;
      existing.total_tokens += r.total_tokens;
    } else {
      map.set(r.day, { day: r.day, calls: r.calls, total_tokens: r.total_tokens });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
}

// ── Main component ─────────────────────────────────────────────────────────────

type DaysOption = 7 | 30 | 90;

export default function ObservabilityPage() {
  const [data, setData] = useState<ObsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [days, setDays] = useState<DaysOption>(30);
  const [modelFilter, setModelFilter] = useState("");
  const [envFilter, setEnvFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ days: String(days) });
        if (modelFilter) params.set("model", modelFilter);
        if (envFilter) params.set("env", envFilter);
        if (projectFilter) params.set("project", projectFilter);

        const res = await fetch(`/api/observability?${params}`, { signal });
        if (!res.ok) {
          setError("Failed to load observability data.");
          return;
        }
        const json = (await res.json()) as ObsPayload;
        setData(json);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setError("Failed to load observability data.");
      } finally {
        setLoading(false);
      }
    },
    [days, modelFilter, envFilter, projectFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const dailyAgg = data ? aggregateDailyByDay(data.daily) : [];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Status bar */}
      <div className="border-b border-white/5 bg-white/[0.02] px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-5xl flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            &larr; Dashboard
          </Link>
          <span className="text-border">·</span>
          <span>AI Usage Observability</span>
        </div>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-5xl space-y-10">

          {/* Page heading */}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">AI Usage Observability</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Spend, token usage, and top drivers across all analysis endpoints.
            </p>
          </div>

          {/* Filters */}
          <div className="glass-card p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-4">
              Filters
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

              {/* Date range */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Date range</label>
                <select
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) as DaysOption)}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>

              {/* Model */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Model</label>
                <select
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">All models</option>
                  {data?.filters.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Env */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Environment</label>
                <select
                  value={envFilter}
                  onChange={(e) => setEnvFilter(e.target.value)}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">All envs</option>
                  {data?.filters.envs.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              {/* Project */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Project</label>
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">All projects</option>
                  {data?.filters.projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Loading */}
          {loading && (
            <div className="glass-card p-10 text-center text-sm text-muted-foreground">
              Loading&hellip;
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && data && data.totalCalls === 0 && (
            <div className="glass-card p-10 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">
                No usage events in this window.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Events are recorded for every call to <code className="font-mono">/api/v1/analyze</code>.
              </p>
            </div>
          )}

          {/* Summary cards */}
          {!loading && !error && data && data.totalCalls > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Total Calls
                </p>
                <p className="text-2xl font-semibold tracking-tight font-mono tabular-nums mt-2">
                  {formatNumber(data.totalCalls)}
                </p>
              </div>
              <div className="glass-card p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Total Tokens
                </p>
                <p className="text-2xl font-semibold tracking-tight font-mono tabular-nums mt-2">
                  {formatNumber(data.totalTokens)}
                </p>
              </div>
            </div>
          )}

          {/* Spend trend chart */}
          {!loading && !error && data && dailyAgg.length > 0 && (
            <div className="glass-card p-6 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Token Usage — Daily
              </p>
              <BarChart
                data={dailyAgg as unknown as Record<string, number | string>[]}
                valueKey="total_tokens"
                labelKey="day"
                height={80}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {formatNumber(dailyAgg.length)} days shown
              </p>
            </div>
          )}

          {/* Call volume chart */}
          {!loading && !error && data && dailyAgg.length > 0 && (
            <div className="glass-card p-6 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Call Volume — Daily
              </p>
              <BarChart
                data={dailyAgg as unknown as Record<string, number | string>[]}
                valueKey="calls"
                labelKey="day"
                height={60}
              />
            </div>
          )}

          {/* Top models table */}
          {!loading && !error && data && data.topModels.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Top Models by Token Usage
              </p>
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-6 font-medium text-muted-foreground">Model</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Calls</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Tokens In</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Tokens Out</th>
                        <th className="text-right py-3 px-6 font-medium text-muted-foreground">Total Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.topModels as TopModelRow[]).map((row) => (
                        <tr key={row.model} className="border-b border-border last:border-0 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-6 font-mono text-foreground">{row.model}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{formatNumber(row.calls)}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{formatNumber(row.total_tokens_in)}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{formatNumber(row.total_tokens_out)}</td>
                          <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold">{formatNumber(row.tokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Top prompts table */}
          {!loading && !error && data && data.topPrompts.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Top Prompts by Token Usage
              </p>
              <p className="text-xs text-muted-foreground -mt-1">
                Identified by SHA-256 hash. Token counts only — prompt text is never shown.
              </p>
              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-6 font-medium text-muted-foreground">Prompt Hash</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Calls</th>
                        <th className="text-right py-3 px-6 font-medium text-muted-foreground">Total Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.topPrompts as TopPromptRow[]).slice(0, 20).map((row) => (
                        <tr key={row.prompt_hash} className="border-b border-border last:border-0 hover:bg-white/5 transition-colors">
                          <td className="py-3 px-6 font-mono text-muted-foreground truncate max-w-[240px]">
                            {row.prompt_hash.slice(0, 16)}&hellip;
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{formatNumber(row.calls)}</td>
                          <td className="py-3 px-6 text-right font-mono tabular-nums font-semibold">{formatNumber(row.tokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
