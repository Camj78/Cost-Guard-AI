import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — CostGuardAI",
  description:
    "Install and use the CostGuardAI CLI to catch LLM prompt cost overruns and failure risk before they ship.",
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 space-y-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">CostGuardAI Docs</h1>
        <p className="text-muted-foreground text-sm">
          Preflight analysis for LLM prompts — catch cost overruns and failure risk before they ship.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Install
        </h2>
        <pre className="bg-white/5 border border-white/10 rounded px-4 py-3 text-sm font-mono overflow-x-auto">
          npm install -g @camj78/costguardai
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Quick Start
        </h2>
        <pre className="bg-white/5 border border-white/10 rounded px-4 py-3 text-sm font-mono overflow-x-auto whitespace-pre">
{`# Analyze a prompt file
costguardai analyze my-prompt.txt

# CI gate — fail if risk score >= 70
costguardai ci --fail-on-risk 70

# Initialize config in your repo
costguardai init`}
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          CostGuardAI Safety Score
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every analysis produces a <span className="text-foreground font-medium">CostGuardAI Safety Score</span> from
          0 to 100. Higher is safer. The score combines five weighted factors: context pressure,
          output collision risk, output cap risk, prompt verbosity, and estimation uncertainty.
          Scores below 60 indicate meaningful failure risk and should be reviewed before deployment.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Commands
        </h2>
        <div className="space-y-2 text-sm font-mono">
          <div className="grid grid-cols-[180px_1fr] gap-2">
            <span className="text-foreground">analyze &lt;path&gt;</span>
            <span className="text-muted-foreground">Analyze a file or directory of prompt files</span>
          </div>
          <div className="grid grid-cols-[180px_1fr] gap-2">
            <span className="text-foreground">ci [path]</span>
            <span className="text-muted-foreground">CI-native scan with exit codes</span>
          </div>
          <div className="grid grid-cols-[180px_1fr] gap-2">
            <span className="text-foreground">trends</span>
            <span className="text-muted-foreground">Risk trend intelligence from git history</span>
          </div>
          <div className="grid grid-cols-[180px_1fr] gap-2">
            <span className="text-foreground">init</span>
            <span className="text-muted-foreground">Bootstrap CostGuardAI config in your repo</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Run <code className="font-mono">costguardai --help</code> for full options.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Links
        </h2>
        <ul className="text-sm space-y-1">
          <li>
            <Link
              href="https://github.com/Camj78/Cost-Guard-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub — github.com/Camj78/Cost-Guard-AI
            </Link>
          </li>
          <li>
            <Link
              href="/methodology"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Scoring Methodology
            </Link>
          </li>
          <li>
            <Link
              href="/vulnerabilities"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Prompt Vulnerability Registry
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
