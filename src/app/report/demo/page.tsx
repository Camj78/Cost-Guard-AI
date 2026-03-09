import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { GITHUB_APP_INSTALL_URL } from "@/config/github";
import { RiskScore } from "@/components/risk-score";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ANALYSIS_VERSION } from "@/lib/trust";
import type { Metadata } from "next";
import type { RiskAssessment } from "@/lib/risk";

export const metadata: Metadata = {
  title: "Demo Report | CostGuardAI",
  description: "CostGuardAI demo safety report — CostGuard Safety Score, risk drivers, and mitigations.",
};

// ---------------------------------------------------------------------------
// Static demo payload — no database query.
// Shaped to match RiskAssessment exactly.
// riskScore = 72 → CostGuard Safety Score = 28 (Unsafe)
// ---------------------------------------------------------------------------
const DEMO_ANALYSIS: RiskAssessment = {
  inputTokens: 3240,
  contextWindow: 128000,
  maxOutputTokens: 4096,
  expectedOutputTokens: 1200,
  remaining: 123560,
  usageRatio: 0.034,
  usagePercent: 3.4,
  estimatedCostInput: 0.01620,
  estimatedCostOutput: 0.01800,
  estimatedCostTotal: 0.03420,
  riskScore: 72,
  score_version: "v1.0",
  riskLevel: "high",
  riskExplanation:
    "High injection risk — untrusted user input is not isolated from system instructions. Cost explosion risk from open-ended output requirements.",
  isEstimated: false,
  riskFactors: [
    { name: "structural", points: 20, template: "User input not isolated from system instructions" },
    { name: "volatility", points: 18, template: "Output volatility phrases increase cost variance" },
    { name: "length",     points: 14, template: "Prompt length exceeds recommended threshold" },
    { name: "ambiguity",  points: 12, template: "Ambiguous quality modifiers reduce predictability" },
    { name: "context",    points: 8,  template: "Context window usage above 10%" },
  ],
  riskDrivers: [
    {
      name: "Injection Risk",
      impact: 85,
      fixes: [
        "Isolate user input from system prompts",
        "Apply input sanitization layer before injection",
      ],
    },
    {
      name: "Cost Explosion",
      impact: 70,
      fixes: [
        "Set strict max_output_tokens",
        "Use prompt caching for repeated context blocks",
      ],
    },
    {
      name: "Ambiguity Risk",
      impact: 55,
      fixes: [
        "Add concrete output format requirements",
        "Remove vague quality modifiers",
      ],
    },
  ],
  truncation: {
    level: "safe",
    message: "Context usage is within safe range for this model.",
  },
  explanation: {
    summary:
      "CostGuard Safety Score 28 (Unsafe) — high injection risk and cost explosion detected.",
    top_risk_drivers: ["Injection Risk", "Cost Explosion", "Ambiguity Risk"],
    contributing_factors: [
      "Untrusted user input embedded in system prompt",
      "Output volatility phrases increase cost variance",
      "Prompt length exceeds recommended threshold",
      "Ambiguous quality modifiers reduce predictability",
    ],
    mitigation_suggestions: [
      "Isolate user input from system prompts",
      "Set strict max_output_tokens",
      "Apply input sanitization layer",
      "Use prompt caching for repeated context",
      "Remove vague quality modifiers",
    ],
  },
};

const DEMO_MODEL_NAME = "gpt-4o";

const DEMO_COSTS = {
  costPer1k:       3.20,
  costPerCall:     0.0032,
  monthlyCost100k: 320,
  monthlyCost3m:   9600,
};

// ---------------------------------------------------------------------------

export default function DemoReportPage() {
  const analysis = DEMO_ANALYSIS;
  const safetyScore = 100 - analysis.riskScore; // 28

  function fmtCost(n: number): string {
    return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-lg space-y-4">

          {/* 1 — Report Header */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground border border-white/10 rounded-full px-3 py-1 bg-white/5">
              Demo · Safety report
            </span>
            <span className="text-xs text-muted-foreground">{DEMO_MODEL_NAME}</span>
          </div>

          {/* 2 — KPI Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">
                  Safety Score
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none text-orange-400">
                  {safetyScore}
                </p>
                <p className="text-xs mt-1 text-orange-400">Unsafe</p>
              </CardContent>
            </Card>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">
                  Cost / 1k
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none">
                  $3.20
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">
                  Monthly (100k)
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none">
                  $320
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">
                  Monthly (3M)
                </p>
                <p className="font-mono tabular-nums text-2xl font-semibold leading-none">
                  $9,600
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 3 — Integrity Status Rail */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground/50 leading-none">
            <span>Scan complete</span>
            <span aria-hidden="true">·</span>
            <span>Analyzer v0.2</span>
            <span aria-hidden="true">·</span>
            <span>Pricing loaded</span>
            <span aria-hidden="true">·</span>
            <span>Generated for demo review</span>
            <span aria-hidden="true">·</span>
            <span>Share-safe</span>
          </div>

          {/* ── 1. CostGuard Safety Score ── */}
          <Card className="glass-card shadow-none relative">
            <div className="absolute top-0 left-6 right-6 h-px bg-primary/30" />
            <CardContent className="pt-5 pb-4">
              <RiskScore
                score={analysis.riskScore}
                level={analysis.riskLevel}
                explanation={analysis.riskExplanation}
                riskDrivers={analysis.riskDrivers}
                showInlineDrivers={false}
              />
            </CardContent>
          </Card>

          {/* ── 2. What this score means ── */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                What this score means
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                CostGuard Safety Score measures how resistant a prompt is to prompt injection,
                system override, jailbreak behavior, token cost explosion, and tool misuse.
                Higher scores indicate stronger prompt isolation, safer structure, and lower
                operational risk.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  { range: "91–100", label: "Hardened", color: "text-emerald-400" },
                  { range: "71–90",  label: "Safe",     color: "text-blue-400" },
                  { range: "41–70",  label: "Needs Hardening", color: "text-amber-400" },
                  { range: "0–40",   label: "Unsafe",   color: "text-red-400" },
                ].map(({ range, label, color }) => (
                  <div key={range} className="flex items-center justify-between gap-2">
                    <span className="font-mono tabular-nums text-xs text-muted-foreground/60">{range}</span>
                    <span className={`text-xs font-semibold ${color}`}>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/50">
                Your score: {safetyScore}/100
              </p>
            </CardContent>
          </Card>

          {/* ── 3. Top Risk Drivers ── */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Top Risk Drivers
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              {analysis.riskDrivers.map((driver) => (
                <div key={driver.name} className="flex items-start justify-between gap-4">
                  <span className="text-xs text-foreground/80">{driver.name}</span>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">
                    {driver.impact >= 67 ? "High" : driver.impact >= 34 ? "Medium" : "Low"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── 4. Threat Intelligence ── */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Threat Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-1.5">
              <p className="text-xs text-muted-foreground">
                No known Prompt CVE match yet.
              </p>
              <p className="text-xs text-muted-foreground/60 leading-relaxed">
                This score is based on structural safety analysis and known exploit patterns.
              </p>
            </CardContent>
          </Card>

          {/* ── 5. Mitigations ── */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Mitigations
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ul className="space-y-1.5">
                {analysis.explanation.mitigation_suggestions.slice(0, 5).map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    · {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* 6 — Cost Impact */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Estimated Cost Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <p className="text-[11px] text-muted-foreground/50">Estimated workload cost</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Per call</span>
                <span className="font-mono tabular-nums text-xs text-right">{fmtCost(DEMO_COSTS.costPerCall)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Per 1k calls</span>
                <span className="font-mono tabular-nums text-xs text-right">{fmtCost(DEMO_COSTS.costPer1k)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Monthly (100k calls)</span>
                <span className="font-mono tabular-nums text-xs text-right">{fmtCost(DEMO_COSTS.monthlyCost100k)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Monthly (3M calls)</span>
                <span className="font-mono tabular-nums text-xs text-right">{fmtCost(DEMO_COSTS.monthlyCost3m)}</span>
              </div>
              <div className="border-t border-white/5 pt-2 flex items-start justify-between gap-4">
                <span className="text-xs text-muted-foreground">Model Mix</span>
                <span className="text-xs text-right text-muted-foreground/80">
                  gpt-4o-mini (classification) · gpt-4o (generation)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                Estimates based on current model pricing.
                Actual costs vary by provider and model version.
              </p>
            </CardContent>
          </Card>

          {/* 7 — Real Repo CTA Block */}
          <Card className="glass-card shadow-none border border-primary/20">
            <CardContent className="pt-5 pb-5">
              <p className="text-sm font-semibold tracking-tight mb-1">Protect a real repo next</p>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Run CostGuard on your own codebase to catch cost spikes, risky prompts, and model misconfiguration before shipping.
              </p>
              <div className="flex items-center gap-3">
                <Link
                  href="/?ref=demo-cta"
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Start free
                </Link>
                <Link
                  href={GITHUB_APP_INSTALL_URL}
                  className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Install GitHub App
                </Link>
              </div>
              <p className="text-[11px] text-muted-foreground/50 mt-3">
                No code changes required for first scan.
              </p>
            </CardContent>
          </Card>

          {/* 8 — Report Integrity */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Report Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Analysis Version</span>
                  <span className="font-mono tabular-nums text-xs text-right">{ANALYSIS_VERSION}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Score Version</span>
                  <span className="font-mono tabular-nums text-xs text-right">{analysis.score_version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Prompt</span>
                  <span className="font-mono tabular-nums text-xs text-right text-muted-foreground/60">
                    [demo — not stored]
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      <div className="mx-auto max-w-lg w-full px-4 pt-6 pb-4 flex items-center justify-between gap-3">
        <Link
          href="/?ref=demo-report"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Run your own preflight →
        </Link>
        <Link
          href="/methodology"
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          How CostGuard Safety Score works
        </Link>
      </div>

      <Footer />
    </div>
  );
}
