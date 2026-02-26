"use client";

import { useState, useEffect } from "react";
import { type RiskLevel, type RiskDriver, getRiskLevel } from "@/lib/risk";
import { Badge } from "@/components/ui/badge";

interface RiskScoreProps {
  score: number;
  level: RiskLevel;
  explanation: string;
  riskDrivers?: RiskDriver[];
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

export function RiskScore({ score, level, explanation, riskDrivers }: RiskScoreProps) {
  const config = LEVEL_CONFIG[level];

  // Animated count-up: 0 → score over 800ms, ease-out cubic
  const [displayScore, setDisplayScore] = useState(0);
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    setIsSettled(false);
    const target = score;
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
  }, [score]);

  const drivers = riskDrivers ?? [];

  return (
    <div className="space-y-3">
      {/* Score + badge row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold font-mono tabular-nums ${config.scoreClass} ${isSettled ? "animate-count-settle" : ""}`}>
            {displayScore}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <Badge variant="outline" className={config.badgeClass}>
          {config.label}
        </Badge>
      </div>

      {/* Severity meter — 3-segment pill */}
      <div className="flex gap-1">
        <div className={`flex-1 h-2 rounded-l-full bg-emerald-500 ${score <= 33 ? "opacity-100" : "opacity-20"}`} />
        <div className={`flex-1 h-2 bg-yellow-400 ${score >= 34 && score <= 66 ? "opacity-100" : "opacity-20"}`} />
        <div className={`flex-1 h-2 rounded-r-full bg-red-500 ${score >= 67 ? "opacity-100" : "opacity-20"}`} />
      </div>

      {/* Label */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Failure Risk Score (heuristic)
      </p>

      {/* Explanation */}
      {explanation && (
        <p className="text-sm text-foreground/80 leading-relaxed">
          {explanation}
        </p>
      )}

      {/* Top Risk Drivers */}
      {drivers.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/[0.07]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Top Risk Drivers
          </p>
          {drivers.map((driver) => {
            const driverLevel = getRiskLevel(driver.impact);
            const driverConfig = LEVEL_CONFIG[driverLevel];
            return (
              <div key={driver.name} className="space-y-1">
                {/* Driver name + impact */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-foreground/80">{driver.name}</span>
                  <span className={`text-xs font-mono tabular-nums ${driverConfig.color}`}>
                    {driver.impact}
                  </span>
                </div>
                {/* Impact bar */}
                <div className="h-1 rounded-full bg-white/[0.07]">
                  <div
                    className={`h-1 rounded-full ${driverConfig.barClass}`}
                    style={{ width: `${driver.impact}%` }}
                  />
                </div>
                {/* Fix suggestions — collapsed by default */}
                {driver.fixes.length > 0 && (
                  <details className="group">
                    <summary className="text-xs text-muted-foreground cursor-pointer list-none select-none hover:text-foreground/60 transition-colors duration-100">
                      Fix suggestions ({driver.fixes.length})
                    </summary>
                    <ul className="mt-1.5 space-y-1 pl-3">
                      {driver.fixes.map((fix, i) => (
                        <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                          — {fix}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
