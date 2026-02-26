"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { type RiskAssessment } from "@/lib/risk";
import { type ModelConfig } from "@/config/models";

interface ShareButtonProps {
  analysis: RiskAssessment | null;
  analysisId: string | null;
  model: ModelConfig;
  isAuthed: boolean;
}

type ShareState = "idle" | "loading" | "copied" | "fallback";

export function ShareButton({ analysis, analysisId, model, isAuthed }: ShareButtonProps) {
  const [state, setState] = useState<ShareState>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  if (!analysis) return null;

  const disabled = !isAuthed || !analysisId || state === "loading";

  async function handleShare() {
    if (disabled || !analysis) return;

    setState("loading");
    setShareUrl(null);

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysis_id: analysisId,
          snapshot: { analysis, modelId: model.id },
        }),
      });

      if (!res.ok) {
        setState("idle");
        return;
      }

      const data = await res.json() as { id?: string };
      if (!data.id) {
        setState("idle");
        return;
      }

      const url = `${window.location.origin}/s/${data.id}`;

      try {
        await navigator.clipboard.writeText(url);
        setState("copied");
        setTimeout(() => setState("idle"), 1500);
      } catch {
        setShareUrl(url);
        setState("fallback");
      }
    } catch {
      setState("idle");
    }
  }

  const button = (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={handleShare}
      className="gap-1.5 text-xs border-white/10 hover:bg-white/10 transition-colors duration-[200ms]"
    >
      {state === "copied" ? (
        <Check className="w-3 h-3" />
      ) : (
        <Link2 className="w-3 h-3" />
      )}
      {state === "loading" ? "Sharing…" : state === "copied" ? "Copied" : "Share"}
    </Button>
  );

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!isAuthed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{button}</span>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Sign in to share</TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      {state === "fallback" && shareUrl && (
        <input
          readOnly
          value={shareUrl}
          className="text-xs font-mono border border-white/10 bg-white/5 rounded px-2 py-1 w-64"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}
    </div>
  );
}
