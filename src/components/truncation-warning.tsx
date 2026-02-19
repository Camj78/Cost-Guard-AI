"use client";

import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { type TruncationLevel } from "@/lib/risk";

interface TruncationWarningProps {
  truncation: TruncationLevel;
}

const CONFIG = {
  safe: {
    icon: CheckCircle,
    containerClass: "bg-emerald-50 border-emerald-200 text-emerald-700",
    iconClass: "text-emerald-500",
    label: "Output Safe",
  },
  warning: {
    icon: AlertTriangle,
    containerClass: "bg-amber-50 border-amber-200 text-amber-700",
    iconClass: "text-amber-500",
    label: "Truncation Risk",
  },
  danger: {
    icon: XCircle,
    containerClass: "bg-red-50 border-red-200 text-red-700",
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
        <span className="font-medium">{c.label}. </span>
        {truncation.message}
      </div>
    </div>
  );
}
