"use client";

import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";


export function Header() {
  return (
    <header className="border-b border-border bg-card px-6 py-4">
      <div className="mx-auto max-w-6xl flex items-center justify-between">
        {/* Logo + name */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo_transparent.png"
            alt="CostGuardAI logo"
            width={36}
            height={36}
            className="rounded-md"
            priority
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
<Button asChild variant="secondary">
  <Link href="/waitlist">Join Pro Waitlist</Link>
</Button>
        {/* Privacy trust badge */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>All analysis runs locally. Your prompts never leave your browser.</span>
        </div>
      </div>
    </header>
  );
}
