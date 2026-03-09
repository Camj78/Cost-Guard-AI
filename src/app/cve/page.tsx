import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prompt CVE Explorer | CostGuardAI",
  description:
    "Browse known Prompt CVEs — structural vulnerabilities observed across LLM deployments.",
};

interface CveRow {
  cve_id: string;
  risk_type: string;
  severity: "critical" | "high" | "medium";
  description: string;
  incident_count: number;
  first_seen: string;
  last_seen: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
};

const RISK_TYPE_LABEL: Record<string, string> = {
  prompt_injection:    "Prompt Injection",
  context_overflow:    "Context Overflow",
  token_explosion:     "Token Cost Explosion",
  instruction_ambiguity: "Instruction Ambiguity",
  structural_failure:  "Structural Failure",
};

function formatDate(iso: string): string {
  return new Date(iso).toISOString().split("T")[0];
}

export default async function CveExplorerPage() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("prompt_cve_registry")
    .select("cve_id, risk_type, severity, description, incident_count, first_seen, last_seen")
    .order("last_seen", { ascending: false });

  const cves: CveRow[] = (error ? [] : data ?? []) as CveRow[];

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Page header */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Threat Intelligence
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Prompt CVE Explorer
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              Prompt CVEs (format: <span className="font-mono">PCVE-YYYY-XXXX</span>) are generated
              when a structural prompt pattern accumulates 25 or more observed incidents across
              CostGuard analyses. Each CVE reflects a structural vulnerability class —
              no raw prompt content is ever stored or exposed.
            </p>
            <Link
              href="/methodology"
              className="inline-block text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              How scores and CVEs are computed →
            </Link>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Total CVEs
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1">
                {cves.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Critical
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1 text-red-400">
                {cves.filter((c) => c.severity === "critical").length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                High
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1 text-orange-400">
                {cves.filter((c) => c.severity === "high").length}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Medium
              </p>
              <p className="font-mono tabular-nums text-2xl font-semibold leading-none mt-1 text-amber-400">
                {cves.filter((c) => c.severity === "medium").length}
              </p>
            </div>
          </div>

          {/* CVE list */}
          {cves.length === 0 ? (
            <Card className="glass-card shadow-none">
              <CardContent className="pt-6 pb-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No Prompt CVEs generated yet.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  CVEs are generated when a structural pattern accumulates 25 or more incidents.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {cves.map((cve) => (
                <Card key={cve.cve_id} className="glass-card shadow-none">
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <Link
                          href={`/cve/${cve.cve_id}`}
                          className="font-mono text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {cve.cve_id}
                        </Link>
                        <CardTitle className="text-xs text-muted-foreground font-normal">
                          {RISK_TYPE_LABEL[cve.risk_type] ?? cve.risk_type}
                        </CardTitle>
                      </div>
                      <span className={`text-xs font-semibold uppercase shrink-0 ${SEVERITY_COLOR[cve.severity] ?? "text-muted-foreground"}`}>
                        {cve.severity}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cve.description}
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground/60">Incidents</span>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {cve.incident_count.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground/60">First seen</span>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {formatDate(cve.first_seen)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground/60">Last seen</span>
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {formatDate(cve.last_seen)}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/cve/${cve.cve_id}`}
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
            Prompt CVEs reflect structural vulnerability patterns only. No raw prompt text,
            user identifiers, or project data is stored or exposed.
          </p>

        </div>
      </main>

      <Footer />
    </div>
  );
}
