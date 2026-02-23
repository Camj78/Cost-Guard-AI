"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type CompressionResult } from "@/lib/compressor";
import { type ModelConfig } from "@/config/models";
import { countTokens } from "@/lib/tokenizer";

interface CompressionPanelProps {
  compressionPreview: CompressionResult | null;
  compressionDelta: number;
  originalPrompt: string;
  model: ModelConfig;
  onApply: () => void;
}

const MIN_DELTA_TO_SHOW = 5; // only show panel if we can save >5%

export function CompressionPanel({
  compressionPreview,
  compressionDelta,
  originalPrompt,
  model,
  onApply,
}: CompressionPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);

  // Reset applied state when prompt changes (new content)
  if (!originalPrompt && applied) setApplied(false);

  if (!compressionPreview || compressionDelta < MIN_DELTA_TO_SHOW) return null;
  if (compressionPreview.techniques.includes("Prompt is already concise")) return null;

  const originalTokens = countTokens(originalPrompt, model);
  const compressedTokens = countTokens(compressionPreview.compressed, model);
  const savedTokens = Math.max(0, originalTokens - compressedTokens);
  const isEstimatedDelta = model.tokenStrategy === "estimated";

  function handleApply() {
    onApply();
    setApplied(true);
    setExpanded(false);
  }

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-amber-400">
              Save {isEstimatedDelta ? "~" : ""}{compressionDelta.toFixed(0)}% tokens
            </span>
            {isEstimatedDelta && (
              <span className="text-xs text-amber-400 ml-1">(~estimated)</span>
            )}
            <span className="text-xs text-amber-400 ml-2">
              ~{savedTokens.toLocaleString()} tokens saved
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-amber-400 underline underline-offset-2 hover:text-amber-300 flex items-center gap-0.5"
          >
            {expanded ? "Hide preview" : "Preview"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {applied ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" /> Applied
            </span>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleApply}
            >
              Use compressed
            </Button>
          )}
        </div>
      </div>

      {/* Expanded preview */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-4 py-3 space-y-3">
          {/* Techniques */}
          <div>
            <p className="text-xs font-medium text-amber-400 mb-1">Applied:</p>
            <ul className="text-xs text-amber-400 space-y-0.5">
              {compressionPreview.techniques.map((t, i) => (
                <li key={i} className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Compressed preview */}
          <div>
            <p className="text-xs font-medium text-amber-400 mb-1">
              Compressed prompt:
            </p>
            <div className="bg-white/5 border border-amber-500/20 rounded p-2.5 max-h-32 overflow-y-auto">
              <p className="text-xs font-mono whitespace-pre-wrap text-foreground/80 leading-relaxed">
                {compressionPreview.compressed}
              </p>
            </div>
          </div>

          {/* Token comparison */}
          <div className="flex items-center gap-4 text-xs text-amber-400">
            <span>Before: {originalTokens.toLocaleString()} tokens</span>
            <span>→</span>
            <span>
              After: {isEstimatedDelta ? "~" : ""}{compressedTokens.toLocaleString()} tokens
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
