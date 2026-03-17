import Link from "next/link";
import * as fs from "fs";
import * as path from "path";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calibration History | CostGuardAI",
  description:
    "Longitudinal benchmark calibration history — CostGuard Safety Score stability across analysis versions.",
};

interface FixtureResult {
  id: string;
  passed: boolean;
  riskScore: number;
  safetyScore: number;
  expectedRiskRange: [number, number];
  riskLevel: string;
  topDriver: string;
  drift?: string;
}

interface BenchmarkSummary {
  analysis_version: string;
  timestamp: string;
  pass_rate: number;
  fixture_count: number;
  fixture_results: FixtureResult[];
  score_band_distribution: Record<string, number>;
}

function loadSummaries(): BenchmarkSummary[] {
  const artifactsDir = path.join(process.cwd(), "artifacts", "benchmarks");
  try {
    if (!fs.existsSync(artifactsDir)) return [];
    const files = fs
      .readdirSync(artifactsDir)
      .filter((f) => f.endsWith("-summary.json"))
      .sort()
      .reverse(); // newest first
    return files.map((f) => {
      const raw = fs.readFileSync(path.join(artifactsDir, f), "utf-8");
      return JSON.parse(raw) as BenchmarkSummary;
    });
  } catch {
    return [];
  }
}

const BAND_COLORS: Record<string, string> = {
  Safe:    "text-emerald-400",
  Low:     "text-blue-400",
  Warning: "text-amber-400",
  High:    "text-red-400",
};

export default function CalibrationHistoryPage() {
  const summaries = loadSummaries();

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Page header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
              <Link href="/methodology" className="hover:text-muted-foreground transition-colors">
                Methodology
              </Link>
              <span aria-hidden="true">›</span>
              <span>Calibration History</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Calibration History
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              Each entry below corresponds to a benchmark run against the canonical fixture suite.
              Pass rates and score band distributions confirm that CostGuard Safety Score bands
              remain stable across <span className="font-mono">analysis_version</span> updates.
            </p>
          </div>

          {/* Content */}
          {summaries.length === 0 ? (
            <Card className="glass-card shadow-none">
              <CardContent className="pt-6 pb-6 space-y-2">
                <p className="text-xs text-muted-foreground">
                  No calibration records found.
                </p>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">
                  Run <span className="font-mono">pnpm benchmark</span> to generate the first
                  benchmark summary artifact.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {summaries.map((summary) => (
                <Card key={summary.analysis_version} className="glass-card shadow-none">
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <CardTitle className="font-mono text-sm font-semibold">
                          v{summary.analysis_version}
                        </CardTitle>
                        <p className="text-[11px] text-muted-foreground/60">
                          {new Date(summary.timestamp).toISOString().split("T")[0]}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold font-mono tabular-nums ${
                          summary.pass_rate === 1 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {Math.round(summary.pass_rate * 100)}% pass
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-3">
                    {/* Stats row */}
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-[11px] text-muted-foreground/60">Fixtures</p>
                        <p className="font-mono tabular-nums text-xs text-muted-foreground">
                          {summary.fixture_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground/60">Passed</p>
                        <p className="font-mono tabular-nums text-xs text-muted-foreground">
                          {Math.round(summary.pass_rate * summary.fixture_count)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground/60">Failed</p>
                        <p className="font-mono tabular-nums text-xs text-muted-foreground">
                          {summary.fixture_count - Math.round(summary.pass_rate * summary.fixture_count)}
                        </p>
                      </div>
                    </div>

                    {/* Band distribution */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                        Score Band Distribution
                      </p>
                      {Object.entries(summary.score_band_distribution).map(([band, count]) => (
                        <div key={band} className="flex items-center justify-between gap-4">
                          <span className={`text-xs ${BAND_COLORS[band] ?? "text-muted-foreground"}`}>
                            {band}
                          </span>
                          <span className="font-mono tabular-nums text-xs text-muted-foreground">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Fixture table */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                        Fixture Results
                      </p>
                      {summary.fixture_results.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-semibold uppercase ${
                                r.passed ? "text-emerald-400" : "text-red-400"
                              }`}
                            >
                              {r.passed ? "PASS" : "FAIL"}
                            </span>
                            <span className="text-xs text-muted-foreground/80 font-mono">
                              {r.id}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums text-xs text-muted-foreground text-right">
                            risk={r.riskScore} css={r.safetyScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            Benchmark summaries are generated by <span className="font-mono">pnpm benchmark</span>{" "}
            and persisted to <span className="font-mono">artifacts/benchmarks/</span>.
          </p>

        </div>
      </main>

      <Footer />
    </div>
  );
}
