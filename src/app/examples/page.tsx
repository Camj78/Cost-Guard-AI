import * as fs from "fs";
import * as path from "path";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Example Analyses | CostGuardAI",
  description:
    "Canonical example analyses that explain CostGuard Safety Score behavior — from safe structured prompts to injection-vulnerable and token-explosion patterns.",
};

interface RiskDriver {
  name: string;
  level: "Low" | "Medium" | "High";
}

interface ExampleEntry {
  title: string;
  description: string;
  structure_summary: string;
  expected_score: string;
  risk_band: string;
  risk_drivers: RiskDriver[];
  explanation: string;
  mitigations: string[];
}

const BAND_COLOR: Record<string, string> = {
  Hardened: "text-emerald-400",
  Safe: "text-blue-400",
  "Needs Hardening": "text-amber-400",
  Unsafe: "text-red-400",
};

const LEVEL_COLOR: Record<string, string> = {
  Low: "text-emerald-400",
  Medium: "text-amber-400",
  High: "text-red-400",
};

function loadExamples(): ExampleEntry[] {
  const dir = path.join(process.cwd(), "content", "examples");
  const order = [
    "safe-structured.json",
    "injection-vulnerable.json",
    "jailbreak-attempt.json",
    "token-explosion.json",
    "tool-abuse.json",
  ];
  return order.flatMap((file) => {
    const p = path.join(dir, file);
    try {
      const raw = fs.readFileSync(p, "utf-8");
      return [JSON.parse(raw) as ExampleEntry];
    } catch {
      return [];
    }
  });
}

export default function ExamplesPage() {
  const examples = loadExamples();

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <div className="absolute inset-0 -z-10 bg-radial-glow pointer-events-none" aria-hidden="true" />
      <Header />

      <main className="flex-1 px-4 sm:px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-8">

          {/* Page header */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Example Analyses
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Safety Score Examples
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-prose">
              Canonical examples that demonstrate how CostGuard Safety Score behaves across
              common prompt structures. Each example shows the structural pattern, the score
              produced, and the risk drivers responsible. No raw prompt content is included.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href="/methodology"
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                How the score is computed →
              </Link>
              <span aria-hidden="true" className="text-muted-foreground/30">·</span>
              <Link
                href="/vulnerabilities"
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Vulnerability registry →
              </Link>
            </div>
          </div>

          {/* Example cards */}
          <div className="space-y-4">
            {examples.map((ex, i) => {
              const bandColor = BAND_COLOR[ex.risk_band] ?? "text-muted-foreground";
              return (
                <Card key={i} className="glass-card shadow-none">
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <CardTitle className="text-sm font-semibold tracking-tight">
                          {ex.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {ex.description}
                        </p>
                      </div>
                      <div className="shrink-0 text-right space-y-0.5">
                        <p className="font-mono tabular-nums text-xl font-semibold leading-none">
                          {ex.expected_score}
                        </p>
                        <p className={`text-xs font-semibold ${bandColor}`}>
                          {ex.risk_band}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pb-4 space-y-4">
                    {/* Structure summary */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                        Structural Pattern
                      </p>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed font-mono">
                        {ex.structure_summary}
                      </p>
                    </div>

                    {/* Risk drivers */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                        Risk Drivers
                      </p>
                      <div className="space-y-1">
                        {ex.risk_drivers.map((d) => (
                          <div key={d.name} className="flex items-center justify-between gap-4">
                            <span className="text-xs text-foreground/80">{d.name}</span>
                            <span className={`text-xs font-semibold ${LEVEL_COLOR[d.level] ?? "text-muted-foreground"}`}>
                              {d.level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Explanation */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                        Explanation
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {ex.explanation}
                      </p>
                    </div>

                    {/* Mitigations */}
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
                        Mitigations
                      </p>
                      <ul className="space-y-0.5">
                        {ex.mitigations.map((m, j) => (
                          <li key={j} className="text-xs text-muted-foreground">
                            · {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
            Scores shown are expected values based on structural pattern analysis. Actual scores
            depend on exact token counts, model context window, and expected output tokens.
            Run your own preflight to get a precise score.
          </p>

          <div className="flex items-center justify-between gap-4">
            <Link
              href="/?ref=examples"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Run your own preflight →
            </Link>
            <Link
              href="/methodology/changes"
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              Score change history →
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
