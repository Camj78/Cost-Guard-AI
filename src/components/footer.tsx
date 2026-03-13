"use client";

import { pricingLastUpdated } from "@/config/models";

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-6 py-6 mt-auto">
      <div className="mx-auto max-w-5xl flex flex-col items-center gap-2 text-center text-xs text-muted-foreground/60">
        <span className="font-mono">API Docs · CLI · Status</span>
        <span>CostGuardAI v1.0</span>
        <span className="text-center">
          Prices configurable.{" "}
          <span className="text-foreground/70">
            Verify with provider before purchase decisions.
          </span>{" "}
          Last updated {pricingLastUpdated}.
        </span>
      </div>
    </footer>
  );
}
