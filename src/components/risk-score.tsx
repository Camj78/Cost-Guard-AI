"use client";

import { useState, useEffect } from "react";
import { type RiskLevel, type RiskDriver, getRiskLevel } from "@/lib/risk";

interface RiskScoreProps {
  score: number;
  level: RiskLevel;
  explanation: string;
  riskDrivers?: RiskDriver[];
  /** Set to false on report pages where drivers are rendered as a separate card. Default: true */
  showInlineDrivers?: boolean;
}

const LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; badgeClass: string; scoreClass: string; barClass: string }
> = {
  safe: {
    label: "Safe",
    color: "text-emerald-400",
    badgeClass:
      "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20",
    scoreClass: "text-emerald-400",
    barClass: "bg-emerald-400",
  },
  low: {
    label: "Low",
    color: "text-blue-400",
    badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/20",
    scoreClass: "text-blue-400",
    barClass: "bg-blue-400",
  },
  warning: {
    label: "Warning",
    color: "text-amber-400",
    badgeClass:
      "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20",
    scoreClass: "text-amber-400",
    barClass: "bg-amber-400",
  },
  high: {
    label: "High",
    color: "text-orange-400",
    badgeClass:
      "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/20",
    scoreClass: "text-orange-400",
    barClass: "bg-orange-400",
  },
  critical: {
    label: "Critical",
    color: "text-red-400",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20",
    scoreClass: "text-red-400",
    barClass: "bg-red-400",
  },
};

/** Maps a CostGuard Safety Score (0–100, higher = safer) to a band label. */
function getSafetyBand(safetyScore: number): string {
  if (safetyScore >= 91) return "Hardened";
  if (safetyScore >= 71) return "Safe";
  if (safetyScore >= 41) return "Needs Hardening";
  return "Unsafe";
}

/** Maps a driver impact (0–100, higher = riskier) to a severity label. */
function getImpactLabel(impact: number): string {
  if (impact >= 67) return "High";
  if (impact >= 34) return "Medium";
  return "Low";
}

export function RiskScore({ score, level, explanation, riskDrivers, showInlineDrivers = true }: RiskScoreProps) {
  const config = LEVEL_CONFIG[level];

  // Safety Score = 100 − riskScore (higher = safer, more hardened)
  const safetyScore = 100 - score;
  const band = getSafetyBand(safetyScore);

  // Animated count-up: 0 → safetyScore over 800ms, ease-out cubic
  const [displayScore, setDisplayScore] = useState(0);
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSettled(false);
    const target = safetyScore;
    const start = performance.now();
    const duration = 800;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * target));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setIsSettled(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safetyScore]);

  const drivers = riskDrivers ?? [];

  return (
    <div className="space-y-3">
      {/* Label — Level 3 type */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        CostGuard Safety Score
      </p>

      {/* Score + band */}
      <div className="flex items-baseline gap-2">
        <span
          className={`text-4xl font-bold font-mono tabular-nums ${config.scoreClass} ${isSettled ? "animate-count-settle" : ""}`}
        >
          {displayScore}
        </span>
        <span className="text-sm text-muted-foreground">/100</span>
        <span className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${config.color} ml-1`}>
          {band}
        </span>
      </div>

      {/* Severity meter — 3-segment pill.
          Meter conditions use internal riskScore (score prop), not safetyScore.
          Semantics: green = low risk = high safety; red = high risk = low safety. */}
      <div className="flex gap-1">
        <div className={`flex-1 h-2 rounded-l-full bg-emerald-500 ${score <= 33 ? "opacity-100" : "opacity-20"}`} />
        <div className={`flex-1 h-2 bg-yellow-400 ${score >= 34 && score <= 66 ? "opacity-100" : "opacity-20"}`} />
        <div className={`flex-1 h-2 rounded-r-full bg-red-500 ${score >= 67 ? "opacity-100" : "opacity-20"}`} />
      </div>

      {/* Explanation */}
      {explanation && (
        <p className="text-sm text-foreground/80 leading-relaxed">
          {explanation}
        </p>
      )}

      {/* Top Risk Drivers — always visible (suppressed on report pages that have a dedicated card) */}
      {showInlineDrivers && drivers.length > 0 && (
        <div className="border-t border-white/[0.07] pt-3 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Top Risk Drivers
          </p>
          <div className="space-y-2 pt-1">
            {drivers.map((driver) => {
              const driverLevel = getRiskLevel(driver.impact);
              const driverConfig = LEVEL_CONFIG[driverLevel];
              const impactLabel = getImpactLabel(driver.impact);
              return (
                <div key={driver.name} className="space-y-1">
                  {/* Driver name + severity label */}
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-foreground/80">{driver.name}</span>
                    <span className={`text-xs font-semibold ${driverConfig.color}`}>
                      {impactLabel}
                    </span>
                  </div>
                  {/* Impact bar */}
                  <div className="h-1 rounded-full bg-white/[0.07]">
                    <div
                      className={`h-1 rounded-full ${driverConfig.barClass}`}
                      style={{ width: `${driver.impact}%` }}
                    />
                  </div>
                  {/* Concise per-driver explanation (first fix hint) */}
                  {driver.fixes.length > 0 && (
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      {driver.fixes[0]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
