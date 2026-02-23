"use client";

import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { type TruncationLevel } from "@/lib/risk";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface TruncationWarningProps {
  truncation: TruncationLevel;
}

const CONFIG = {
  safe: {
    icon: CheckCircle,
    containerClass: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    iconClass: "text-emerald-500",
    label: "Output Safe",
  },
  warning: {
    icon: AlertTriangle,
    containerClass: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    iconClass: "text-amber-500",
    label: "Truncation Risk",
  },
  danger: {
    icon: XCircle,
    containerClass: "bg-red-500/10 border-red-500/20 text-red-400",
    iconClass: "text-red-500",
    label: "Truncation Likely",
  },
};

export function TruncationWarning({ truncation }: TruncationWarningProps) {
  const c = CONFIG[truncation.level];
  const Icon = c.icon;

  return (
    <div className={`flex gap-2.5 rounded-md border p-3 ${c.containerClass}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${c.iconClass}`} />
      <div className="text-sm leading-snug">
        <span className="font-medium">
          {c.label}.{" "}
          {truncation.level === "warning" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-amber-500 cursor-help inline-block ml-0.5 align-middle" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] text-xs">
                The model may cut off its response before completion.
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        {truncation.message}
      </div>
    </div>
  );
}
