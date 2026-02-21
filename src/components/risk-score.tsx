"use client";

import { useState, useEffect } from "react";
import { type RiskLevel } from "@/lib/risk";
import { Badge } from "@/components/ui/badge";

interface RiskScoreProps {
  score: number;
  level: RiskLevel;
  explanation: string;
}

const LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; badgeClass: string; scoreClass: string }
> = {
  safe: {
    label: "Safe",
    color: "text-emerald-600",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    scoreClass: "text-emerald-600",
  },
  low: {
    label: "Low",
    color: "text-blue-600",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50",
    scoreClass: "text-blue-600",
  },
  warning: {
    label: "Warning",
    color: "text-amber-600",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
    scoreClass: "text-amber-600",
  },
  high: {
    label: "High",
    color: "text-orange-600",
    badgeClass:
      "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50",
    scoreClass: "text-orange-600",
  },
  critical: {
    label: "Critical",
    color: "text-red-600",
    badgeClass: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
    scoreClass: "text-red-600",
  },
};

export function RiskScore({ score, level, explanation }: RiskScoreProps) {
  const config = LEVEL_CONFIG[level];

  // Animated count-up: 0 → score over 800ms, ease-out cubic
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const target = score;
    const start = performance.now();
    const duration = 800;
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div className="space-y-3">
      {/* Score + badge row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold tabular-nums ${config.scoreClass}`}>
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
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        Failure Risk Score (heuristic)
      </p>

      {/* Explanation */}
      {explanation && (
        <p className="text-sm text-foreground/80 leading-relaxed">
          {explanation}
        </p>
      )}
    </div>
  );
}
