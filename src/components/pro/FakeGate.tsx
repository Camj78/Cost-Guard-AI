"use client";

import { Lock } from "lucide-react";

export default function FakeGate() {
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
