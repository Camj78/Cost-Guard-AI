"use client";

import { UpgradeButton } from "@/components/upgrade-button";

interface UsageMeterProps {
  used: number;
  limit: number;
}

export function UsageMeter({ used, limit }: UsageMeterProps) {
  const usedClamped = limit > 0 ? Math.min(used, limit) : used;
  const pct = limit > 0 ? Math.min(100, Math.round((usedClamped / limit) * 100)) : 0;
  const isAtLimit = usedClamped >= limit;
  const isApproaching = pct >= 80 && !isAtLimit;
  const isNearing = pct >= 70 && !isAtLimit;

  const fillColor = isAtLimit
    ? "bg-red-500"
    : isApproaching
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <div className="glass-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Usage This Month
        </span>
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {usedClamped} / {limit}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted/30">
        <div
          className={`h-full rounded-full ${fillColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {isAtLimit && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <p className="text-xs text-muted-foreground">
            Analysis won&apos;t be saved this month.
          </p>
          <UpgradeButton moment="usage_100" />
        </div>
      )}

      {isNearing && !isAtLimit && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <p className="text-xs text-muted-foreground">Approaching limit.</p>
          <UpgradeButton moment="usage_70" variant="outline" />
        </div>
      )}
    </div>
  );
}
