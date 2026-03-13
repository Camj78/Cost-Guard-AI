import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase-ssr";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface CveDetail {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cveId: string }>;
}): Promise<Metadata> {
  const { cveId } = await params;
  return {
    title: `${cveId} | Prompt CVE | CostGuardAI`,
    description: `Structural prompt vulnerability ${cveId} — severity, incident count, and mitigation guidance.`,
  };
}

export default async function CveDetailPage({
  params,
}: {
  params: Promise<{ cveId: string }>;
}) {
  const { cveId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("prompt_cve_registry")
    .select("cve_id, risk_type, severity, description, mitigation, incident_count, first_seen, last_seen")
    .eq("cve_id", cveId)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const cve = data as CveDetail;

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-lg space-y-4">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
            <Link href="/cve" className="hover:text-muted-foreground transition-colors">
              CVE Explorer
            </Link>
            <span aria-hidden="true">›</span>
            <span className="font-mono">{cve.cve_id}</span>
          </div>

          {/* Header card */}
          <Card className="glass-card shadow-none relative">
            <div className="absolute top-0 left-6 right-6 h-px bg-primary/30" />
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-mono text-xl font-semibold tracking-tight">
                    {cve.cve_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {RISK_TYPE_LABEL[cve.risk_type] ?? cve.risk_type}
                  </p>
                </div>
                <span className={`text-sm font-semibold uppercase shrink-0 ${SEVERITY_COLOR[cve.severity] ?? "text-muted-foreground"}`}>
                  {cve.severity}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Incident stats */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Incident Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total incidents</span>
                <span className="font-mono tabular-nums text-xs text-right">
                  {cve.incident_count.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">First seen</span>
                <span className="font-mono tabular-nums text-xs text-right">
                  {formatDate(cve.first_seen)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Last seen</span>
                <span className="font-mono tabular-nums text-xs text-right">
                  {formatDate(cve.last_seen)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Risk type</span>
                <span className="font-mono tabular-nums text-xs text-right text-muted-foreground/70">
                  {cve.risk_type}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {cve.description}
              </p>
            </CardContent>
          </Card>

          {/* Mitigation */}
          <Card className="glass-card shadow-none">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Mitigation
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {cve.mitigation}
              </p>
            </CardContent>
          </Card>

          {/* Privacy notice */}
          <Card className="glass-card shadow-none">
            <CardContent className="pt-4 pb-4">
              <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                This CVE reflects a structural vulnerability pattern. No raw prompt text, user
                identifiers, or project data is stored or exposed. Incident matching uses
                one-way structural hashes — prompt content cannot be recovered from any
                CostGuard record.
              </p>
            </CardContent>
          </Card>

        </div>
      </main>

      <div className="mx-auto max-w-lg w-full px-4 pt-6 pb-4 flex items-center justify-between gap-3">
        <Link
          href="/cve"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← All Prompt CVEs
        </Link>
        <Link
          href="/methodology"
          className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          How scores work →
        </Link>
      </div>

      <Footer />
    </div>
  );
}
