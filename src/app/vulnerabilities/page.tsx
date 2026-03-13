import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prompt Vulnerability Registry | CostGuardAI",
  description:
    "Public registry of structural prompt vulnerabilities observed across LLM deployments. Includes severity, risk type, mitigation guidance, and incident statistics.",
};

interface VulnRow {
  cve_id: string;
  risk_type: string;
  severity: "critical" | "high" | "medium";
  description: string;
  mitigation: string;
  incident_count: number;
  first_seen: string;
  last_seen: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-400/10 border-red-400/20",
  high:     "bg-orange-400/10 border-orange-400/20",
  medium:   "bg-amber-400/10 border-amber-400/20",
};

const RISK_TYPE_LABEL: Record<string, string> = {
  prompt_injection:      "Prompt Injection",
  context_overflow:      "Context Overflow",
  token_explosion:       "Token Cost Explosion",
  instruction_ambiguity: "Instruction Ambiguity",
  structural_failure:    "Structural Failure",
};

function formatDate(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

export default async function VulnerabilityRegistryPage() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("prompt_cve_registry")
    .select("cve_id, risk_type, severity, description, mitigation, incident_count, first_seen, last_seen")
    .order("last_seen", { ascending: false });

  const vulns: VulnRow[] = (error ? [] : data ?? []) as VulnRow[];

  const critical = vulns.filter((v) => v.severity === "critical");
  const high     = vulns.filter((v) => v.severity === "high");
  const medium   = vulns.filter((v) => v.severity === "medium");

  const mostObserved = [...vulns]
    .sort((a, b) => b.incident_count - a.incident_count)
    .slice(0, 5);

  const recentVulns = [...vulns]
    .sort((a, b) => new Date(b.first_seen).getTime() - new Date(a.first_seen).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Page header */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Vulnerability Registry
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Prompt Vulnerability Registry
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              Structural prompt vulnerabilities observed across LLM deployments. Each entry is
              assigned a <span className="font-mono">PCVE</span> identifier when a structural
              pattern accumulates 25 or more observed incidents. No raw prompt content, user
              identifiers, or project data is stored or exposed.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href="/methodology"
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                How vulnerabilities are detected →
              </Link>
              <span aria-hidden="true" className="text-muted-foreground/30">·</span>
              <Link
                href="/examples"
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Example analyses →
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Total
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1">
                {vulns.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Critical
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1 text-red-400">
                {critical.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                High
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1 text-orange-400">
                {high.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Medium
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1 text-amber-400">
                {medium.length}
              </p>
            </div>
          </div>

          {/* Most Observed Vulnerabilities */}
          {mostObserved.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Top Prompt Vulnerabilities
              </p>
              <Card className="glass-card shadow-none">
                <CardContent className="py-3 px-4 divide-y divide-white/[0.06]">
                  {mostObserved.map((v) => (
                    <div key={v.cve_id} className="flex items-center justify-between py-2 gap-4">
                      <Link
                        href={`/vulnerabilities/${v.cve_id}`}
                        className="font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors shrink-0"
                      >
                        {v.cve_id}
                      </Link>
                      <span className="text-xs text-muted-foreground/60 truncate flex-1 min-w-0">
                        {RISK_TYPE_LABEL[v.risk_type] ?? v.risk_type}
                      </span>
                      <span className="font-mono tabular-nums text-xs text-muted-foreground shrink-0">
                        {v.incident_count.toLocaleString()} incidents
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Vulnerabilities */}
          {recentVulns.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Recent Prompt Vulnerabilities
              </p>
              <Card className="glass-card shadow-none">
                <CardContent className="py-3 px-4 divide-y divide-white/[0.06]">
                  {recentVulns.map((v) => (
                    <div key={v.cve_id} className="flex items-center justify-between py-2 gap-4">
                      <Link
                        href={`/vulnerabilities/${v.cve_id}`}
                        className="font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors shrink-0"
                      >
                        {v.cve_id}
                      </Link>
                      <span className="text-xs text-muted-foreground/60 truncate flex-1 min-w-0">
                        {RISK_TYPE_LABEL[v.risk_type] ?? v.risk_type}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-muted-foreground/60">first seen</span>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {formatDate(v.first_seen)}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Vulnerability list */}
          {vulns.length === 0 ? (
            <Card className="glass-card shadow-none">
              <CardContent className="pt-6 pb-6 text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  No vulnerabilities registered yet.
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Vulnerabilities are registered when a structural pattern accumulates 25 or more incidents.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {vulns.map((v) => (
                <Card key={v.cve_id} className="glass-card shadow-none">
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Link
                          href={`/vulnerabilities/${v.cve_id}`}
                          className="font-mono text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {v.cve_id}
                        </Link>
                        <CardTitle className="text-xs text-muted-foreground font-normal">
                          {RISK_TYPE_LABEL[v.risk_type] ?? v.risk_type}
                        </CardTitle>
                      </div>
                      <span
                        className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border shrink-0 ${
                          SEVERITY_BG[v.severity] ?? "bg-white/5 border-white/10"
                        } ${SEVERITY_COLOR[v.severity] ?? "text-muted-foreground"}`}
                      >
                        {v.severity}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-4 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {v.description}
                    </p>

                    {v.mitigation && (
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                          Mitigation
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {v.mitigation}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground/60">Incidents</span>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {v.incident_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground/60">First seen</span>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {formatDate(v.first_seen)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground/60">Last seen</span>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {formatDate(v.last_seen)}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/vulnerabilities/${v.cve_id}`}
                      className="inline-block text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      View details →
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            Vulnerabilities reflect structural patterns only. No raw prompt text, user identifiers,
            or project data is stored or exposed. Incident matching uses one-way structural hashes.
          </p>

        </div>
      </main>

      <Footer />
    </div>
  );
}
