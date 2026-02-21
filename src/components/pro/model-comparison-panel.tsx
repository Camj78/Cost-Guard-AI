"use client";

import { useState } from "react";
import { MODELS } from "@/config/models";
import { countTokens } from "@/lib/tokenizer";
import { assessRisk } from "@/lib/risk";
import { formatCost, formatNumber } from "@/lib/formatters";

interface ComparisonResult {
  modelId: string;
  modelName: string;
  estTokens: number;
  estCost: number;
  riskScore: number;
  riskLevel: string;
  deltaPct: number | null; // null for cheapest
}

function riskBadgeClass(riskLevel: string): string {
  switch (riskLevel) {
    case "safe": return "text-green-700 bg-green-50";
    case "low": return "text-blue-700 bg-blue-50";
    case "warning": return "text-yellow-700 bg-yellow-50";
    case "high": return "text-orange-700 bg-orange-50";
    case "critical": return "text-red-700 bg-red-50";
    default: return "text-muted-foreground bg-muted";
  }
}

interface ModelComparisonPanelProps {
  prompt: string;
  expectedOutputTokens: number;
}

export function ModelComparisonPanel({ prompt, expectedOutputTokens }: ModelComparisonPanelProps) {
  const [results, setResults] = useState<ComparisonResult[] | null>(null);

  function handleCompare() {
    if (!prompt.trim()) return;

    const raw = MODELS.map((model) => {
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
        modelId: model.id,
        modelName: model.name,
        estTokens: inputTokens,
        estCost: result.estimatedCostTotal,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
      };
    });

    // Sort by cost ascending
    raw.sort((a, b) => a.estCost - b.estCost);

    const minCost = raw[0].estCost;

    const compared: ComparisonResult[] = raw.map((r, i) => ({
      ...r,
      deltaPct: i === 0 ? null : ((r.estCost - minCost) / (minCost || 1)) * 100,
    }));

    setResults(compared);
  }

  // Find lowest risk score index
  const lowestRiskIdx =
    results !== null
      ? results.reduce(
          (minIdx, r, i, arr) => (r.riskScore < arr[minIdx].riskScore ? i : minIdx),
          0
        )
      : -1;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Model Comparison</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Compare all models on the current prompt. Sorted by cost.
        </p>
      </div>

      <button
        onClick={handleCompare}
        disabled={!prompt.trim()}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        Compare Models
      </button>

      {results !== null && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Model</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Est. tokens</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Est. cost</th>
                <th className="text-right py-2 px-2 font-medium text-muted-foreground">Risk</th>
                <th className="text-right py-2 pl-2 font-medium text-muted-foreground">% delta</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const isCheapest = i === 0;
                const isLowestRisk = i === lowestRiskIdx;
                return (
                  <tr
                    key={r.modelId}
                    className={`border-b last:border-0 transition-colors ${
                      isLowestRisk ? "bg-green-50 dark:bg-green-950" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="py-2.5 pr-4 font-medium">{r.modelName}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatNumber(r.estTokens)}</td>
                    <td className={`py-2.5 px-2 text-right tabular-nums font-mono ${isCheapest ? "font-bold" : ""}`}>
                      {formatCost(r.estCost)}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${riskBadgeClass(r.riskLevel)}`}>
                        {r.riskScore}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right tabular-nums text-muted-foreground">
                      {r.deltaPct === null ? "—" : `+${r.deltaPct.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground mt-2">
            Green row = lowest risk. Bold cost = cheapest.
          </p>
        </div>
      )}
    </div>
  );
}
