"use client";

import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type ModelConfig } from "@/config/models";
import { formatNumber } from "@/lib/formatters";

interface ModelAssumptionsProps {
  model: ModelConfig;
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  meta: "Meta (via hosted API)",
};

export function ModelAssumptions({ model }: ModelAssumptionsProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          <Info className="w-3 h-3" />
          View model assumptions
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{model.name}</DialogTitle>
          <DialogDescription>
            Read-only configuration. Update{" "}
            <code className="text-xs bg-muted px-1 rounded">src/config/models.ts</code>{" "}
            to change these values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Row label="Provider" value={PROVIDER_NAMES[model.provider] ?? model.provider} />
          <Row
            label="Context window"
            value={`${formatNumber(model.contextWindow)} tokens`}
          />
          <Row
            label="Max output tokens"
            value={`${formatNumber(model.maxOutputTokens)} tokens`}
          />
          <div className="border-t border-border pt-3 space-y-3">
            <Row
              label="Input price"
              value={`$${model.inputPricePer1M.toFixed(2)} / 1M tokens`}
            />
            <Row
              label="Output price"
              value={`$${model.outputPricePer1M.toFixed(2)} / 1M tokens`}
            />
          </div>
          <div className="border-t border-border pt-3 space-y-3">
            <Row
              label="Token strategy"
              value={
                model.tokenStrategy === "exact"
                  ? "Exact (js-tiktoken)"
                  : "Estimated (cl100k_base)"
              }
            />
            <Row
              label="Correction factor"
              value={`${model.correctionFactor}×`}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          Prices configurable. Verify with provider before purchase decisions.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-mono text-right">{value}</span>
    </div>
  );
}
