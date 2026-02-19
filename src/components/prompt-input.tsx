"use client";

import { useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (v: string) => void;
  isLargePrompt: boolean;
}

const PERF_GUARD_CHARS = 200_000;

function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

export function PromptInput({ value, onChange, isLargePrompt }: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to max-height, then scroll
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }, [value]);

  const charCount = value.length;
  const wordCount = countWords(value);

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your prompt here to analyze token usage, cost, and risk…"
        className="min-h-[160px] max-h-[400px] resize-none font-mono text-sm leading-relaxed overflow-y-auto"
        spellCheck={false}
        aria-label="Prompt input"
      />

      {/* Stats row */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
        <div className="flex gap-3">
          <span>{charCount.toLocaleString()} chars</span>
          {charCount > 0 && <span>{wordCount.toLocaleString()} words</span>}
        </div>

        {/* Large prompt warning */}
        {isLargePrompt && (
          <div className="flex items-center gap-1 text-amber-600 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              &gt;{(PERF_GUARD_CHARS / 1000).toFixed(0)}K chars — realtime analysis paused. Click Analyze.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
