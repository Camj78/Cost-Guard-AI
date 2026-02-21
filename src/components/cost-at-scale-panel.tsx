"use client";

import { useState } from "react";
import { MODELS, type ModelConfig } from "@/config/models";
import { type RiskAssessment, computeRequestCost } from "@/lib/risk";
import { formatCost, formatNumber } from "@/lib/formatters";

interface CostAtScalePanelProps {
  analysis: RiskAssessment | null;
  model: ModelConfig;
}

export function CostAtScalePanel({ analysis, model }: CostAtScalePanelProps) {
  const [requestsPerDay, setRequestsPerDay] = useState(10_000);
  const [daysPerMonth, setDaysPerMonth] = useState(30);

  const hasValidData = analysis !== null;

  // ── Cost: only use pre-computed value from risk engine ────────────────────
  const costPerRequest = hasValidData ? analysis.estimatedCostTotal : null;
  const monthlyCost =
    costPerRequest != null
      ? costPerRequest * requestsPerDay * daysPerMonth
      : null;
  const yearlyCost = monthlyCost != null ? monthlyCost * 12 : null;

  // ── Comparison models: dynamic, sorted by total unit price, exclude selected
  const comparisonModels = [...MODELS]
    .filter((m) => m.id !== model.id)
    .sort(
      (a, b) =>
        a.inputPricePer1M +
        a.outputPricePer1M -
        (b.inputPricePer1M + b.outputPricePer1M)
    )
    .slice(0, 2);

  // ── Risk amplification ────────────────────────────────────────────────────
  const badResponsesPerDay = Math.round(requestsPerDay * 0.01);
  const riskScore = analysis?.riskScore ?? null;

  // ── Shared volume inputs (always rendered) ────────────────────────────────
  const volumeInputs = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 max-w-lg">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Requests / day</label>
        <input
          type="number"
          min={1}
          step={1}
          value={requestsPerDay}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n > 0) setRequestsPerDay(n);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono tabular-nums"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Days / month</label>
        <input
          type="number"
          min={1}
          max={31}
          step={1}
          value={daysPerMonth}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n > 0) setDaysPerMonth(n);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono tabular-nums"
        />
      </div>
    </div>
  );

  // ── Placeholder state ─────────────────────────────────────────────────────
  if (!hasValidData) {
    return (
      <section className="border-t bg-background">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Cost at Scale
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Project monthly and yearly infrastructure cost at production
              volumes.
            </p>
          </div>
          {volumeInputs}
          <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center max-w-xl">
            <p className="text-muted-foreground text-sm">
              Enter a prompt above to see cost projections at scale.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Full panel ────────────────────────────────────────────────────────────
  return (
    <section className="border-t bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Cost at Scale
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Using{" "}
            <span className="font-medium text-foreground">{model.name}</span>{" "}
            — adjust volume to project infrastructure spend.
          </p>
        </div>

        {volumeInputs}

        {/* Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Monthly cost
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {monthlyCost != null ? formatCost(monthlyCost) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(requestsPerDay)} req/day × {daysPerMonth} days
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Yearly cost
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {yearlyCost != null ? formatCost(yearlyCost) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Monthly × 12</p>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
              Cost per request
            </p>
            <p className="text-3xl font-bold tabular-nums">
              {costPerRequest != null ? formatCost(costPerRequest) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(analysis.inputTokens)} in /{" "}
              {formatNumber(analysis.expectedOutputTokens)} out tokens
            </p>
          </div>
        </div>

        {/* Comparison + risk row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Model comparison */}
          {comparisonModels.length > 0 && monthlyCost != null && (
            <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
              <p className="text-sm font-semibold">Model comparison</p>
              <p className="text-xs text-muted-foreground">
                vs. cheaper alternatives at the same volume
              </p>
              <div className="space-y-4">
                {comparisonModels.map((compModel) => {
                  const compMonthlyCost =
                    computeRequestCost(
                      analysis.inputTokens,
                      analysis.expectedOutputTokens,
                      compModel.inputPricePer1M,
                      compModel.outputPricePer1M
                    ) *
                    requestsPerDay *
                    daysPerMonth;
                  const delta = monthlyCost - compMonthlyCost;
                  const isMoreExpensive = delta > 0;
                  return (
                    <div key={compModel.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium">
                          {compModel.name}
                        </span>
                        <span
                          className={
                            isMoreExpensive
                              ? "text-red-600 font-mono tabular-nums text-xs"
                              : delta < 0
                              ? "text-emerald-600 font-mono tabular-nums text-xs"
                              : "text-muted-foreground font-mono tabular-nums text-xs"
                          }
                        >
                          {delta === 0
                            ? "Same cost"
                            : `${isMoreExpensive ? "+" : "-"}${formatCost(Math.abs(delta))}/mo`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isMoreExpensive ? "bg-red-400" : "bg-emerald-400"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              (Math.abs(delta) / (monthlyCost || 1)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risk amplification */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold">Risk at scale</p>
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3 space-y-0.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  1% failure rate
                </p>
                <p className="text-lg font-bold tabular-nums">
                  {formatNumber(badResponsesPerDay)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    bad responses/day
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  At {formatNumber(requestsPerDay)} req/day
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                    Failure Risk Score
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Relative risk (not a probability).
                  </p>
                </div>
                <span className="text-3xl font-bold tabular-nums">
                  {riskScore ?? "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
