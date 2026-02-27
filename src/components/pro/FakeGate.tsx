"use client";

import { Lock } from "lucide-react";
import { copyByMoment, type UpgradeMoment } from "@/config/monetization";
import { UpgradeButton } from "@/components/upgrade-button";

export default function FakeGate({ moment }: { moment?: UpgradeMoment }) {
  const copy = moment ? copyByMoment[moment] : null;

  // Show upgrade preview for ANY named moment (bullets optional)
  if (copy) {
    return (
      <section className="glass-section">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
          <div className="glass-card p-8 max-w-lg space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Pro
            </p>
            <h3 className="text-base font-semibold">{copy.title}</h3>
            <p className="text-sm text-muted-foreground">{copy.body}</p>
            {copy.bullets && (
              <ul className="space-y-1.5">
                {copy.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <UpgradeButton moment={moment!} />
          </div>
        </div>
      </section>
    );
  }

  // No moment: existing blurred skeleton (fully anonymous gate)
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/30">
      <div className="pointer-events-none select-none p-4 space-y-2 blur-sm opacity-40">
        <div className="h-4 w-28 rounded bg-muted-foreground/30" />
        <div className="h-3 w-full rounded bg-muted-foreground/20" />
        <div className="h-3 w-5/6 rounded bg-muted-foreground/20" />
      </div>
      <div className="absolute top-3 right-3">
        <Lock className="w-3 h-3 text-muted-foreground/50" />
      </div>
    </div>
  );
}
