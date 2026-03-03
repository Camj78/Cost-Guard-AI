"use client";

import { useState, useEffect, useCallback } from "react";
import { getHistory, type HistoryEntry } from "@/lib/analysis-history";
import { formatCost, formatNumber } from "@/lib/formatters";

interface RiskHistoryPanelProps {
  savedPromptId: string | null;
  historyVersion: number; // increment to force refresh after addHistoryEntry
}

function Sparkline({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length < 2) return null;

  const costs = entries.map((e) => e.cost);
  const maxCost = Math.max(...costs);
  const minCost = Math.min(...costs);
  const range = maxCost - minCost || 1;

  const width = 120;
  const height = 32;
  const pad = 2;

  // Oldest first for left-to-right trend
  const chronological = [...entries].reverse();
  const n = chronological.length;

  const points = chronological
    .map((e, i) => {
      const x = pad + (i / (n - 1)) * (width - pad * 2);
      const normalized = (e.cost - minCost) / range;
      const y = pad + (1 - normalized) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground/60"
      />
    </svg>
  );
}

function riskLevelLabel(score: number): string {
  if (score <= 24) return "Safe";
  if (score <= 49) return "Low";
  if (score <= 69) return "Warning";
  if (score <= 84) return "High";
  return "Critical";
}

function riskBadgeClass(score: number): string {
  if (score <= 24) return "text-emerald-400 bg-emerald-500/10";
  if (score <= 49) return "text-blue-400 bg-blue-500/10";
  if (score <= 69) return "text-amber-400 bg-amber-500/10";
  if (score <= 84) return "text-orange-400 bg-orange-500/10";
  return "text-red-400 bg-red-500/10";
}

export function RiskHistoryPanel({ savedPromptId, historyVersion }: RiskHistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const reload = useCallback(() => {
    if (!savedPromptId) {
      setEntries([]);
      return;
    }
    setEntries(getHistory(savedPromptId));
  }, [savedPromptId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload, historyVersion]);

  if (!savedPromptId) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Risk History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Load a saved prompt and click Run Preflight to track history.
          </p>
        </div>
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-xs text-muted-foreground">No saved prompt selected.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Risk History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last {Math.min(entries.length, 20)} runs — newest first.
          </p>
        </div>
        {entries.length >= 2 && (
          <div className="flex flex-col items-end gap-0.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cost trend</p>
            <Sparkline entries={entries} />
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            No runs yet. Click Run Preflight to record.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Date</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Tokens in</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Tokens out</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cost</th>
                <th className="text-right py-2 pl-2 font-medium text-muted-foreground">Risk</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatNumber(e.tokens_in)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatNumber(e.tokens_out)}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-mono">{formatCost(e.cost)}</td>
                  <td className="py-2 pl-2 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${riskBadgeClass(e.riskScore)}`}
                    >
                      {e.riskScore} {riskLevelLabel(e.riskScore)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
