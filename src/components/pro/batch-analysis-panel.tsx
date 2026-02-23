"use client";

import { useState } from "react";
import type { ModelConfig } from "@/config/models";
import { countTokens } from "@/lib/tokenizer";
import { assessRisk, type RiskLevel } from "@/lib/risk";
import { formatCost, formatNumber } from "@/lib/formatters";

const MAX_BATCH = 50;

interface BatchResult {
  promptTruncated: string;
  tokens: number;
  cost: number;
  riskScore: number;
  riskLevel: RiskLevel;
}

function riskBadgeClass(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case "safe": return "text-emerald-400 bg-emerald-500/10";
    case "low": return "text-blue-400 bg-blue-500/10";
    case "warning": return "text-amber-400 bg-amber-500/10";
    case "high": return "text-orange-400 bg-orange-500/10";
    case "critical": return "text-red-400 bg-red-500/10";
  }
}

interface BatchAnalysisPanelProps {
  model: ModelConfig;
  expectedOutputTokens: number;
}

export function BatchAnalysisPanel({ model, expectedOutputTokens }: BatchAnalysisPanelProps) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<BatchResult[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [totalCost, setTotalCost] = useState(0);

  const lineCount = input
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  function handleAnalyze() {
    const lines = input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const wasTruncated = lines.length > MAX_BATCH;
    const batch = lines.slice(0, MAX_BATCH);

    const batchResults: BatchResult[] = batch.map((prompt) => {
      const inputTokens = countTokens(prompt, model);
      const result = assessRisk({
        inputTokens,
        contextWindow: model.contextWindow,
        expectedOutputTokens,
        maxOutputTokens: model.maxOutputTokens,
        compressionDelta: 0,
        tokenStrategy: model.tokenStrategy,
        inputPricePer1M: model.inputPricePer1M,
        outputPricePer1M: model.outputPricePer1M,
      });
      return {
        promptTruncated: prompt.length > 60 ? prompt.slice(0, 60) + "…" : prompt,
        tokens: inputTokens,
        cost: result.estimatedCostTotal,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
      };
    });

    const total = batchResults.reduce((sum, r) => sum + r.cost, 0);

    setResults(batchResults);
    setTruncated(wasTruncated);
    setTotalCost(total);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Batch Analysis</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          One prompt per line. Uses <span className="font-medium text-foreground">{model.name}</span>.
          Max {MAX_BATCH} prompts.
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`One prompt per line (max ${MAX_BATCH})\nExample prompt 1\nExample prompt 2`}
          rows={6}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none font-mono"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {lineCount} prompt{lineCount !== 1 ? "s" : ""}
            {lineCount > MAX_BATCH && (
              <span className="text-yellow-600 ml-1">(only first {MAX_BATCH} will be analyzed)</span>
            )}
          </p>
          <button
            onClick={handleAnalyze}
            disabled={lineCount === 0}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Analyze Batch
          </button>
        </div>
      </div>

      {results !== null && (
        <div className="space-y-3">
          {truncated && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-400">
              Showing first {MAX_BATCH} of {input.split("\n").filter((l) => l.trim()).length} prompts.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Prompt</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Tokens</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cost</th>
                  <th className="text-right py-2 pl-2 font-medium text-muted-foreground">Risk</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-muted-foreground max-w-xs">
                      {r.promptTruncated}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatNumber(r.tokens)}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono">{formatCost(r.cost)}</td>
                    <td className="py-2.5 pl-2 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${riskBadgeClass(r.riskLevel)}`}>
                        {r.riskScore}
                      </span>
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="border-t-2 bg-muted/20 font-semibold">
                  <td className="py-2.5 pr-4">TOTAL</td>
                  <td className="py-2.5 px-2 text-right">—</td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-mono">{formatCost(totalCost)}</td>
                  <td className="py-2.5 pl-2 text-right">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
