"use client";

interface UsageMeterProps {
  used: number;
  limit: number;
}

export function UsageMeter({ used, limit }: UsageMeterProps) {
  const usedClamped = limit > 0 ? Math.min(used, limit) : used;
  const pct = limit > 0 ? Math.min(100, Math.round((usedClamped / limit) * 100)) : 0;
  const isAtLimit = usedClamped >= limit;
  const isApproaching = pct >= 80 && !isAtLimit;

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
        <p className="text-xs text-muted-foreground">
          Analysis won&apos;t be saved —{" "}
          <a
            href="/upgrade"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Upgrade to Pro
          </a>
        </p>
      )}
    </div>
  );
}
