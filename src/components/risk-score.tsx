"use client";

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

  return (
    <div className="space-y-3">
      {/* Score + badge row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold tabular-nums ${config.scoreClass}`}>
            {score}
          </span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
        <Badge variant="outline" className={config.badgeClass}>
          {config.label}
        </Badge>
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
