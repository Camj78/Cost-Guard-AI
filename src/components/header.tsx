"use client";

import { ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="border-b border-white/10 bg-white/5 backdrop-blur-xl px-6 py-4 sticky top-0 z-50">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        {/* Logo + name */}
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0"
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight leading-none">
              CostGuardAI
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Know before you send.
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href="/waitlist"
            className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm font-medium hover:bg-white/5 transition-colors"
          >
            Join Pro Waitlist
          </a>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>All analysis runs locally. Your prompts never leave your browser.</span>
          </div>
        </div>
      </div>
    </header>
  );
}
