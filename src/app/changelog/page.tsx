// src/app/changelog/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog · CostGuardAI",
  description:
    "Product updates for CostGuardAI — shipping weekly improvements to protect AI products in production.",
};

type Entry = {
  version: string;
  date: string; // e.g., "2026-02-19"
  title: string;
  sections: Array<{
    heading: "Added" | "Improved" | "Fixed" | "Notes" | "Positioning";
    items: string[];
  }>;
};

const ENTRIES: Entry[] = [
  {
    version: "v1.0.0",
    date: "2026-02-19",
    title: "Initial production release",
    sections: [
      {
        heading: "Added",
        items: [
          "Token + cost estimation across supported models",
          "CostGuardAI Safety Score engine",
          "Compression detection panel for verbose prompts",
          "Model pricing configuration",
          "Production-ready UI and deploy prep",
        ],
      },
      {
        heading: "Positioning",
        items: ["Repositioned as a “Preflight safety system for AI products in production.”"],
      },
      {
        heading: "Notes",
        items: [
          "This release establishes the foundation for Production Simulation / Cost at Scale and the Pro tier.",
        ],
      },
    ],
  },
];

function formatDate(iso: string) {
  // Render as "Feb 19, 2026"
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function ChangelogPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Changelog</h1>
        <p className="text-sm text-muted-foreground">
          Shipping weekly improvements to protect AI products in production.
        </p>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="underline underline-offset-4">
            ← Back to app
          </Link>
        </div>
      </header>

      <section className="mt-10 space-y-10">
        {ENTRIES.map((e) => (
          <article
            key={e.version}
            className="rounded-2xl border border-border bg-background p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">
                {e.version} <span className="text-muted-foreground">— {e.title}</span>
              </h2>
              <time className="text-sm text-muted-foreground" dateTime={e.date}>
                {formatDate(e.date)}
              </time>
            </div>

            <div className="mt-5 space-y-6">
              {e.sections.map((s) => (
                <div key={s.heading} className="space-y-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.heading}
                  </h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                    {s.items.map((item, idx) => (
                      <li key={`${s.heading}-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        Building transparently. Shipping weekly. Focused on AI production safety.
      </footer>
    </main>
  );
}
