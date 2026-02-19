"use client";

import { formatCost } from "@/lib/formatters";

interface CostDisplayProps {
  estimatedCostInput: number;
  estimatedCostOutput: number;
  estimatedCostTotal: number;
  isEstimated: boolean;
}

export function CostDisplay({
  estimatedCostInput,
  estimatedCostOutput,
  estimatedCostTotal,
  isEstimated,
}: CostDisplayProps) {
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
    </div>
  );
}
