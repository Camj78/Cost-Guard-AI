import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { RiskScore } from "@/components/risk-score";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeReport } from "@/lib/reports/sanitize-report";
import { ANALYSIS_VERSION } from "@/lib/trust";
import { computePatternHash } from "@/lib/threat-intel/pattern-hash";
import type { ShareSnapshot } from "@/lib/share-schema";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Safety Report | CostGuardAI",
  description: "CostGuard Safety Score report — prompt security analysis, risk drivers, and mitigations.",
};

function NotFoundCard() {
  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="glass-card p-8 max-w-sm w-full text-center space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Safety report
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

interface CveRecord {
  cve_id: string;
  severity: string;
  description: string;
  incident_count: number;
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

  // Compute pattern hash from assessment to look up Prompt CVE
  let cveRecord: CveRecord | null = null;
  try {
    const patternHash = computePatternHash(analysis);
    const { data } = await supabase
      .from("prompt_cve_registry")
      .select("cve_id, severity, description, incident_count")
      .eq("pattern_hash", patternHash)
      .maybeSingle();
    cveRecord = data as CveRecord | null;
  } catch {
    // Non-fatal — CVE lookup is best-effort
  }

  function fmtCost(n: number): string {
    return n >= 0.01 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
  }

  const costPer1kCalls = analysis.estimatedCostTotal * 1000;
  const costMonthly    = analysis.estimatedCostTotal * 100_000;

  const safetyScore = 100 - analysis.riskScore;

  // Fallback drivers when none provided
  const drivers = analysis.riskDrivers.length > 0
    ? analysis.riskDrivers
    : [
        { name: "Structural prompt exposure", impact: 40, fixes: ["Strengthen instruction isolation"] },
        { name: "Weak instruction boundaries", impact: 30, fixes: ["Reduce ambiguity"] },
        { name: "Elevated operational complexity", impact: 20, fixes: ["Enforce refusal boundaries"] },
      ];

  // Fallback mitigations
  const mitigations = analysis.explanation.mitigation_suggestions.length > 0
    ? analysis.explanation.mitigation_suggestions
    : [
        "Strengthen instruction isolation",
        "Reduce ambiguity in output requirements",
        "Enforce refusal boundaries",
      ];

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
                Public · Safety report
              </span>
              <span className="text-xs text-muted-foreground">{modelName}</span>
            </div>
            <span className="text-xs text-muted-foreground/60">
              Pricing as of {pricingLastUpdated}
            </span>
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

          {/* Analysis version metadata */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] text-muted-foreground/50">Analysis Version</span>
            <span className="font-mono tabular-nums text-[11px] text-muted-foreground/50">{ANALYSIS_VERSION}</span>
          </div>

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
              {drivers.map((driver) => (
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
            <CardContent className="pb-4 space-y-3">
              {cveRecord ? (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Observed in {cveRecord.incident_count.toLocaleString()} related incidents.
                  </p>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Associated Prompt CVE
                    </p>
                    <div className="flex items-center justify-between gap-4">
                      <Link
                        href={`/vulnerabilities/${cveRecord.cve_id}`}
                        className="font-mono text-sm font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {cveRecord.cve_id}
                      </Link>
                      <span className={`text-xs font-semibold uppercase ${
                        cveRecord.severity === "critical" ? "text-red-400"
                          : cveRecord.severity === "high" ? "text-orange-400"
                          : "text-amber-400"
                      }`}>
                        {cveRecord.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cveRecord.description}
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    No known Prompt CVE match yet.
                  </p>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    This score is based on structural safety analysis and known exploit patterns.
                  </p>
                </div>
              )}
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
                {mitigations.slice(0, 5).map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    · {s}
                  </li>
                ))}
              </ul>
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
