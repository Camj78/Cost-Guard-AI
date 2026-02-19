"use client";

import { pricingLastUpdated } from "@/config/models";

export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-4 mt-auto">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
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
