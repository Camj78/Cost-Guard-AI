"use client";

import { useState } from "react";
import { formatCost } from "@/lib/formatters";

interface CostDisplayProps {
  estimatedCostInput: number;
  estimatedCostOutput: number;
  estimatedCostTotal: number;
  isEstimated: boolean;
}

const SCALES = [
  { label: "1K calls/day", multiplier: 1_000 },
  { label: "10K calls/day", multiplier: 10_000 },
  { label: "100K calls/day", multiplier: 100_000 },
] as const;

export function CostDisplay({
  estimatedCostInput,
  estimatedCostOutput,
  estimatedCostTotal,
  isEstimated,
}: CostDisplayProps) {
  const [scaleIdx, setScaleIdx] = useState(0);
  const scale = SCALES[scaleIdx];
  const dailyCost = estimatedCostTotal * scale.multiplier;
  const monthlyCost = dailyCost * 30;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Input</span>
        <span className="font-mono tabular-nums">
          {formatCost(estimatedCostInput)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Output (estimated)</span>
        <span className="font-mono tabular-nums">
          {isEstimated ? "~" : ""}
          {formatCost(estimatedCostOutput)}
        </span>
      </div>
      <div className="border-t border-border pt-2 flex items-center justify-between">
        <span className="text-sm font-medium">Total per call</span>
        <span className="font-mono font-semibold tabular-nums text-base">
          {isEstimated ? "~" : ""}
          {formatCost(estimatedCostTotal)}
        </span>
      </div>

      {/* Scale toggle */}
      <div className="pt-3 space-y-2">
        <div className="flex gap-1">
          {SCALES.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setScaleIdx(i)}
              className={`flex-1 py-1 text-xs rounded border font-medium transition-colors ${
                scaleIdx === i
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Daily</p>
            <p className="font-mono tabular-nums font-medium">{formatCost(dailyCost)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Monthly (×30)</p>
            <p className="font-mono tabular-nums font-medium">{formatCost(monthlyCost)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
