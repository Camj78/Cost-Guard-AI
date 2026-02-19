"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/formatters";

interface TokenDisplayProps {
  tokens: number;
  isEstimated: boolean;
  usageRatio: number;
}

export function TokenDisplay({ tokens, isEstimated, usageRatio }: TokenDisplayProps) {
  // Dynamic estimation label: if usageRatio >= 0.85 AND estimated → higher uncertainty message
  const estimationLabel =
    isEstimated && usageRatio >= 0.85
      ? "Estimated (higher uncertainty near limits)"
      : isEstimated
      ? "Estimated ±5–8%"
      : "Exact";

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums">
          {isEstimated ? "~" : ""}
          {formatNumber(tokens)}
        </span>
        <span className="text-sm text-muted-foreground">tokens</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span
          className={`text-xs font-medium ${
            isEstimated
              ? usageRatio >= 0.85
                ? "text-amber-600"
                : "text-blue-500"
              : "text-emerald-600"
          }`}
        >
          {estimationLabel}
        </span>
        {isEstimated && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              This model uses a different tokenizer than OpenAI. Count is
              estimated using cl100k_base encoding with a correction factor.
              Actual token usage may vary by 5–10%.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
