import * as fs from "fs";
import * as path from "path";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Score Change Log | CostGuardAI",
  description:
    "Versioned history of CostGuard Safety Score changes — analysis version, release date, benchmark pass rates, and component modifications.",
};

interface ChangelogEntry {
  version: string;
  release_date: string;
  summary: string;
  benchmarkPassRate: number;
  fixtureCount: number;
  cveAdjustments: Array<{ severity: string; adjustment: string }>;
  components: string[];
  notes: string[];
}

// Static changelog derived from docs/score-changelog/ files.
// Add new entries here as versions are released.
function loadChangelog(): ChangelogEntry[] {
  const dir = path.join(process.cwd(), "docs", "score-changelog");
  try {
    if (!fs.existsSync(dir)) return FALLBACK;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return FALLBACK;
    // Return parsed static entries; for now use fallback which mirrors v1.0.0.md
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}

// Mirrors docs/score-changelog/v1.0.0.md
const FALLBACK: ChangelogEntry[] = [
  {
    version: "1.0.0",
    release_date: "2026-03-09",
    summary: "Initial scoring release. Establishes CostGuard Safety Score (CSS) as a deterministic, heuristic-based measure of prompt security and operational reliability.",
    benchmarkPassRate: 100,
    fixtureCount: 5,
    cveAdjustments: [
      { severity: "Critical", adjustment: "+10 risk_score" },
      { severity: "High", adjustment: "+7 risk_score" },
      { severity: "Medium", adjustment: "+3 risk_score" },
    ],
    components: [
      "Prompt Injection (structural, 20%)",
      "System Override (structural, 20%)",
      "Jailbreak Behavior (ambiguity, 20%)",
      "Token Cost Explosion (length + context + volatility, 60% combined)",
      "Tool Abuse (ambiguity + structural, 40% combined)",
    ],
    notes: [
      "Score bands established: Hardened (91–100), Safe (71–90), Needs Hardening (41–70), Unsafe (0–40)",
      "Ambiguous term catalog (v1.0): improve, optimize, better, good, high quality, fast, efficient, robust, flexible, clean, scalable, advanced, modern",
      "Volatility phrase catalog (v1.0): write a detailed, comprehensive, in depth, as much as possible, thoroughly explain",
      "Threat intelligence CVE adjustments introduced and bounded",
      "All benchmark fixtures passing at 5/5 (100%)",
    ],
  },
];

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "text-red-400",
  High: "text-orange-400",
  Medium: "text-amber-400",
};

export default function ScoreChangeLogPage() {
  const changelog = loadChangelog();

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Link href="/methodology" className="hover:text-muted-foreground transition-colors">
              Methodology
            </Link>
            <span aria-hidden="true">›</span>
            <span>Score Changes</span>
          </div>

          {/* Page header */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Versioned History
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Score Change Log
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              Every change to CostGuard Safety Score weights, thresholds, or term catalogs
              increments <span className="font-mono">analysis_version</span>. This log records
              what changed, when it changed, and the benchmark pass rate at release.
            </p>
          </div>

          {/* Versioning rules reference */}
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
            </CardContent>
          </Card>

          {/* Changelog entries */}
          <div className="space-y-4">
            {changelog.map((entry) => (
              <Card key={entry.version} className="glass-card shadow-none">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <CardTitle className="font-mono text-sm font-semibold">
                        v{entry.version}
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground/60">
                        {entry.release_date}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold font-mono tabular-nums ${
                        entry.benchmarkPassRate === 100 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {entry.benchmarkPassRate}% pass
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="pb-4 space-y-4">
                  {/* Summary */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {entry.summary}
                  </p>

                  {/* Benchmark stats */}
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[11px] text-muted-foreground/60">Fixtures</p>
                      <p className="font-mono tabular-nums text-xs text-muted-foreground">
                        {entry.fixtureCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground/60">Passed</p>
                      <p className="font-mono tabular-nums text-xs text-emerald-400">
                        {Math.round(entry.benchmarkPassRate / 100 * entry.fixtureCount)}
                      </p>
                    </div>
                  </div>

                  {/* Components */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                      Scoring Components
                    </p>
                    <ul className="space-y-0.5">
                      {entry.components.map((c) => (
                        <li key={c} className="text-xs text-muted-foreground">
                          · {c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CVE adjustments */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                      Threat Intelligence Adjustments
                    </p>
                    <div className="space-y-1">
                      {entry.cveAdjustments.map(({ severity, adjustment }) => (
                        <div key={severity} className="flex items-center justify-between gap-4">
                          <span className={`text-xs font-semibold ${SEVERITY_COLOR[severity] ?? "text-muted-foreground"}`}>
                            {severity}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground text-right">
                            {adjustment}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                      Notes
                    </p>
                    <ul className="space-y-0.5">
                      {entry.notes.map((n, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          · {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <Link
              href="/methodology/calibration"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Calibration history →
            </Link>
            <Link
              href="/methodology"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Full methodology →
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
