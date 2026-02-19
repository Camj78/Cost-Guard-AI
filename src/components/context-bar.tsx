"use client";

import { Progress } from "@/components/ui/progress";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { type RiskLevel } from "@/lib/risk";

interface ContextBarProps {
  inputTokens: number;
  contextWindow: number;
  usagePercent: number;
  riskLevel: RiskLevel;
}

// Map risk level to progress bar color (via CSS variable override)
const BAR_COLOR: Record<RiskLevel, string> = {
  safe: "[&>div]:bg-emerald-500",
  low: "[&>div]:bg-blue-500",
  warning: "[&>div]:bg-amber-500",
  high: "[&>div]:bg-orange-500",
  critical: "[&>div]:bg-red-500",
};

export function ContextBar({
  inputTokens,
  contextWindow,
  usagePercent,
  riskLevel,
}: ContextBarProps) {
  const clampedPercent = Math.min(usagePercent, 100);
  const barColor = BAR_COLOR[riskLevel];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Context usage</span>
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {formatNumber(inputTokens)} / {formatNumber(contextWindow)}
        </span>
      </div>
      <Progress
        value={clampedPercent}
        className={`h-2.5 ${barColor}`}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatPercent(clampedPercent)} used</span>
        <span>{formatNumber(Math.max(0, contextWindow - inputTokens))} remaining</span>
      </div>
    </div>
  );
}
