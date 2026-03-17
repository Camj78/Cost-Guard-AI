import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Safety Score Methodology | CostGuardAI",
  description:
    "CostGuard Safety Score methodology — how the score is defined, computed, benchmarked, and versioned.",
};

const COMPONENTS = [
  {
    id: "prompt-injection",
    label: "Prompt Injection",
    internal: "structural",
    weight: "20%",
    description:
      "Structural susceptibility to authority confusion or role override via untrusted input paths. Evaluated by detecting absence of explicit separators between system instructions and user content.",
    indicators: [
      "No separator between system instructions and user input",
      "Absence of explicit role or boundary markers",
      "Open-ended instruction blocks accepting raw user content",
    ],
  },
  {
    id: "system-override",
    label: "System Override",
    internal: "structural",
    weight: "20%",
    description:
      "Susceptibility to instruction hijacking — the ability of embedded content to override system-level directives. Detected by absence of output format constraints and section delimiters.",
    indicators: [
      "No explicit output format instruction",
      "No output constraints (max, limit, exactly)",
      "No section headers isolating system context",
    ],
  },
  {
    id: "jailbreak",
    label: "Jailbreak Behavior",
    internal: "ambiguity",
    weight: "20%",
    description:
      "Open-ended output directives and underspecified constraint language that enable constraint bypass. Measured by ambiguous qualitative term density.",
    indicators: [
      "Qualitative modifiers without concrete definitions (improve, optimize, better, high quality)",
      "Missing refusal boundaries",
      "Absence of explicit format requirements",
    ],
  },
  {
    id: "token-cost-explosion",
    label: "Token Cost Explosion",
    internal: "length + context + volatility",
    weight: "60%combined",
    description:
      "Risk that a prompt triggers unbounded or disproportionate token generation. Driven by prompt length relative to context window, context saturation, and open-ended output directives.",
    indicators: [
      "Phrases: write a detailed, comprehensive, in depth, as much as possible",
      "Expected output tokens exceeding 2× input tokens",
      "Prompt length over 50% of the model's context window",
    ],
  },
  {
    id: "tool-abuse",
    label: "Tool Abuse",
    internal: "ambiguity + structural",
    weight: "40%combined",
    description:
      "Structural ambiguity that leads to unpredictable tool invocations in agentic systems. High ambiguity density combined with absent output constraints creates unintended tool calls.",
    indicators: [
      "High instruction ambiguity density",
      "No explicit output format instruction",
      "Absence of scope constraints on tool use",
    ],
  },
];

const BANDS = [
  { range: "85–100", label: "Safe",    color: "text-emerald-400", description: "Prompt is structurally sound and resistant to exploitation." },
  { range: "70–84",  label: "Low",     color: "text-blue-400",    description: "Meets baseline requirements with minor structural gaps." },
  { range: "40–69",  label: "Warning", color: "text-amber-400",   description: "Structural weaknesses that should be addressed before deployment." },
  { range: "0–39",   label: "High",    color: "text-red-400",     description: "High exploitation risk. Do not deploy without remediation." },
];

const CVE_ADJUSTMENTS = [
  { severity: "Critical", adjustment: "+10 pts to risk_score", css_impact: "CSS decreases by up to 10", color: "text-red-400" },
  { severity: "High",     adjustment: "+7 pts to risk_score",  css_impact: "CSS decreases by up to 7",  color: "text-orange-400" },
  { severity: "Medium",   adjustment: "+3 pts to risk_score",  css_impact: "CSS decreases by up to 3",  color: "text-amber-400" },
];

export default function MethodologyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-10">

          {/* Page header */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Scoring Methodology
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              CostGuard Safety Score
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              The CostGuard Safety Score (CSS) is a deterministic, heuristic-based measure of how
              resistant a prompt is to adversarial exploitation and operational failure. This page
              documents exactly how the score is defined, computed, benchmarked, and versioned.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <span className="font-mono text-xs text-muted-foreground/60 border border-white/10 rounded px-2 py-0.5">
                Spec v1.1.0
              </span>
              <Link
                href="/methodology/calibration"
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Calibration history →
              </Link>
            </div>
          </div>

          {/* 1. What the score measures */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              1. What CostGuard Safety Score Measures
            </h2>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground">Range</span>
                    <span className="font-mono tabular-nums text-xs text-right">0–100</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground">Direction</span>
                    <span className="font-mono tabular-nums text-xs text-right">Higher = safer</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground">Formula</span>
                    <span className="font-mono tabular-nums text-xs text-right">CSS = 100 − risk_score</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  CSS measures structural resistance to five classes of adversarial and operational risk:
                  prompt injection, system override, jailbreak behavior, token cost explosion, and tool abuse.
                  A higher score indicates a prompt is structurally isolated, explicitly constrained, and
                  less likely to produce runaway costs or exploitable behavior in production.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 2. The five components */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              2. The Five Scoring Components
            </h2>
            <div className="space-y-3">
              {COMPONENTS.map((c) => (
                <Card key={c.id} className="glass-card shadow-none">
                  <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-sm font-semibold tracking-tight">
                      {c.label}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground/60 font-mono">
                      internal component: {c.internal}
                    </p>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {c.description}
                    </p>
                    <div className="pt-1 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                        Structural indicators
                      </p>
                      <ul className="space-y-0.5">
                        {c.indicators.map((ind) => (
                          <li key={ind} className="text-xs text-muted-foreground/70">
                            · {ind}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* 3. Score bands */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              3. Score Bands
            </h2>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-4 space-y-3">
                {BANDS.map(({ range, label, color, description }) => (
                  <div key={range} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className={`text-xs font-semibold ${color}`}>{label}</span>
                      <span className="font-mono tabular-nums text-xs text-muted-foreground/60">{range}</span>
                    </div>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">
                      {description}
                    </p>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground/50 pt-1 leading-relaxed">
                  Band boundaries are fixed per specification version. A band boundary change requires
                  a major version increment, documented rationale, and full benchmark review.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 4. Threat intelligence */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              4. How Threat Intelligence Affects Scores
            </h2>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  CostGuardAI aggregates anonymized structural incident patterns into a global threat
                  intelligence database. When a prompt&apos;s structural signature matches a known high-risk
                  pattern, a bounded additive adjustment is applied to the base{" "}
                  <span className="font-mono">risk_score</span>.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Threat intelligence influence is <strong className="text-foreground/80">additive but band-limited</strong>.
                  No single pattern match can reduce CSS by more than 10 points. This prevents
                  disproportionate score swings from any single signal.
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Pattern matching is performed on structural hashes — no raw prompt text is used
                  in matching. See Section 8 for privacy details.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 5. Prompt CVE influence */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              5. How Prompt CVEs Influence Scores
            </h2>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Prompt CVEs (format: <span className="font-mono">PCVE-YYYY-XXXX</span>) are generated
                  when a structural pattern accumulates 25 or more observed incidents. A CVE match applies
                  a bounded risk adjustment:
                </p>
                <div className="space-y-1.5">
                  {CVE_ADJUSTMENTS.map(({ severity, adjustment, css_impact, color }) => (
                    <div key={severity} className="flex items-center justify-between gap-4">
                      <span className={`text-xs font-semibold ${color}`}>{severity}</span>
                      <span className="font-mono text-xs text-muted-foreground text-right">{adjustment}</span>
                      <span className="text-xs text-muted-foreground/60 text-right">{css_impact}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  The final risk_score is capped at 100 before computing CSS. No CVE match alone
                  can push a prompt below the Unsafe band boundary.
                </p>
                <Link
                  href="/cve"
                  className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View Prompt CVE Explorer →
                </Link>
              </CardContent>
            </Card>
          </section>

          {/* 6. Benchmark calibration */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              6. Benchmark Calibration
            </h2>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  CostGuardAI maintains a canonical benchmark suite of structural fixtures spanning
                  all five risk categories. The benchmark suite is run against every scoring engine
                  change to verify that:
                </p>
                <ul className="space-y-1">
                  {[
                    "Each fixture&apos;s risk_score falls within its expected range",
                    "No fixture crosses a score band boundary unintentionally",
                    "The overall pass rate remains 100% before release",
                  ].map((item) => (
                    <li key={item} className="text-xs text-muted-foreground">
                      · <span dangerouslySetInnerHTML={{ __html: item }} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Benchmark summaries are persisted as versioned JSON artifacts in{" "}
                  <span className="font-mono">artifacts/benchmarks/</span> for longitudinal
                  calibration tracking.
                </p>
                <Link
                  href="/methodology/calibration"
                  className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  View calibration history →
                </Link>
              </CardContent>
            </Card>
          </section>

          {/* 7. Versioning */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              7. Versioning and Score Stability
            </h2>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-4 space-y-2">
                {[
                  { label: "patch bump", desc: "Bug fix with no scoring behavior change" },
                  { label: "minor bump", desc: "New ambiguity term or volatility phrase added to catalogs" },
                  { label: "major bump", desc: "Weight or bucket threshold change — full benchmark review required" },
                ].map(({ label, desc }) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <span className="font-mono text-xs text-muted-foreground/80 shrink-0">{label}</span>
                    <span className="text-xs text-muted-foreground text-right">{desc}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground/60 pt-1 leading-relaxed">
                  Every API response and shareable report includes{" "}
                  <span className="font-mono">analysis_version</span>,{" "}
                  <span className="font-mono">score_version</span>, and{" "}
                  <span className="font-mono">ruleset_hash</span> for independent verification.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* 8. Privacy */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              8. Why the Score is Privacy-Safe
            </h2>
            <Card className="glass-card shadow-none">
              <CardContent className="pt-4 pb-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  CostGuard Safety Score is computed from structural characteristics of prompts —
                  not from their semantic content. Threat intelligence pattern matching uses
                  structural hashes, not raw text.
                </p>
                <ul className="space-y-1">
                  {[
                    "No raw prompt text is stored in threat intelligence records",
                    "Pattern hashes use token bands (xs/sm/md/lg/xl/xxl) — not exact token counts",
                    "Prompt CVEs expose only structural category, severity, and incident counts",
                    "Pattern hashes are one-way — they cannot be reversed to recover prompt content",
                  ].map((item) => (
                    <li key={item} className="text-xs text-muted-foreground">
                      · {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* CTA row */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <Link
              href="/?ref=methodology"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Run your own preflight →
            </Link>
            <Link
              href="/cve"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Prompt CVE Explorer →
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
