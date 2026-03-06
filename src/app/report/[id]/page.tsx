import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { RiskScore } from "@/components/risk-score";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeReport } from "@/lib/reports/sanitize-report";
import { ANALYSIS_VERSION } from "@/lib/trust";
import type { ShareSnapshot } from "@/lib/share-schema";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Risk Report | CostGuardAI",
  description: "CostGuardAI preflight risk report — RiskScore, drivers, and mitigations.",
};

function NotFoundCard() {
  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Risk report
          </p>
          <p className="text-base font-semibold">This report is no longer available.</p>
          <p className="text-sm text-muted-foreground">
            It may have been revoked or the link may be incorrect.
          </p>
          <Link
            href="/"
            className="inline-block text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
          >
            Run your own analysis
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default async function RiskReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // RLS enforces revoked=false and expiry automatically
  const { data: shareLink } = await supabase
    .from("share_links")
    .select("id, snapshot")
    .eq("id", id)
    .single();

  if (!shareLink) {
    return <NotFoundCard />;
  }

  const snapshot = shareLink.snapshot as ShareSnapshot;
  const report = sanitizeReport(snapshot);
  const { analysis, modelName, pricingLastUpdated } = report;

  function fmtCost(n: number): string {
    return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
  }

  const costPer1kCalls = analysis.estimatedCostTotal * 1000;
  const costMonthly    = analysis.estimatedCostTotal * 100_000;

  const riskBandColor: Record<string, string> = {
    safe: "text-green-400",
    low: "text-green-300",
    warning: "text-yellow-400",
    high: "text-orange-400",
    critical: "text-red-400",
  };

  const bandColor = riskBandColor[analysis.riskLevel] ?? "text-muted-foreground";

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-10">
        <div className="mx-auto max-w-lg space-y-4">

          {/* Badge row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground border border-white/10 rounded-full px-3 py-1 bg-white/5">
                Public · Risk report
              </span>
              <span className="text-xs text-muted-foreground">{modelName}</span>
            </div>
            <span className="text-xs text-muted-foreground/60">
              Pricing as of {pricingLastUpdated}
            </span>
          </div>

          {/* Risk Score */}
          <Card className="glass-card shadow-none relative">
            <div className="absolute top-0 left-6 right-6 h-px bg-primary/30" />
            <CardContent className="pt-5 pb-4">
              <RiskScore
                score={analysis.riskScore}
                level={analysis.riskLevel}
                explanation={analysis.riskExplanation}
                riskDrivers={analysis.riskDrivers}
              />
            </CardContent>
          </Card>

          {/* Cost Impact */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Estimated Cost Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Per 1k calls</span>
                <span className="font-mono tabular-nums text-xs text-right">{fmtCost(costPer1kCalls)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Monthly at 100k calls</span>
                <span className="font-mono tabular-nums text-xs text-right">{fmtCost(costMonthly)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pricing as of</span>
                <span className="font-mono tabular-nums text-xs text-right text-muted-foreground/60">{pricingLastUpdated}</span>
              </div>
            </CardContent>
          </Card>

          {/* Top Risk Drivers */}
          {analysis.explanation.top_risk_drivers.length > 0 && (
            <Card className="glass-card shadow-none">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Top Risk Drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-2">
                {analysis.riskDrivers.map((driver) => (
                  <div key={driver.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{driver.name}</span>
                      <span className={`font-mono tabular-nums text-xs ${bandColor}`}>
                        {driver.impact}
                      </span>
                    </div>
                    {driver.fixes.length > 0 && (
                      <ul className="space-y-0.5 pl-3">
                        {driver.fixes.slice(0, 2).map((fix, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            · {fix}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Mitigations */}
          {analysis.explanation.mitigation_suggestions.length > 0 && (
            <Card className="glass-card shadow-none">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Mitigation Suggestions
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
          )}

          {/* Trust metadata */}
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
                    {report.promptDisplay}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      {/* CTA */}
      <div className="mx-auto max-w-lg w-full px-4 pt-6 pb-4 flex items-center justify-between gap-3">
        <Link
          href="/?ref=report"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Run your own preflight →
        </Link>
        <span className="text-xs text-muted-foreground/40">
          Analyzed by CostGuard · Score Version: {analysis.score_version}
        </span>
      </div>

      <Footer />
    </div>
  );
}
