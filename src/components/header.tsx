"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

const PLAN_LABEL: Record<string, string> = {
  free: "Free plan",
  pro: "Pro plan active",
  team: "Team plan active",
  enterprise: "Enterprise plan",
};

export function Header() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const sb = getSupabaseBrowser();

    void sb.auth.getUser().then(({ data: { user: u } }) => {
      if (active) setUser(u ?? null);
    });

    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Fetch plan whenever auth state resolves to a logged-in user.
  // After checkout=success, poll until plan flips to a paid tier.
  useEffect(() => {
    if (!user) {
      setPlan(null);
      return;
    }

    const isCheckoutSuccess =
      typeof window !== "undefined" &&
      window.location.search.includes("checkout=success");

    if (!isCheckoutSuccess) {
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => setPlan((d.plan as string) ?? "free"))
        .catch(() => setPlan("free"));
      return;
    }

    // Poll until plan reflects paid status (max 5 attempts × 3s)
    let attempts = 0;
    let cancelled = false;
    const poll = () => {
      fetch("/api/me")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const resolved = (d.plan as string) ?? "free";
          setPlan(resolved);
          if (resolved === "free" && attempts < 5) {
            attempts++;
            setTimeout(poll, 3000);
          }
        })
        .catch(() => {
          if (!cancelled) setPlan("free");
        });
    };
    poll();
    return () => { cancelled = true; };
  }, [user]);

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="border-b border-white/[0.07] bg-background/[0.97] px-6 py-4 sticky top-0 z-50">
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

          {/* Auth controls — shown once auth state resolves */}
          {user === undefined ? null : user ? (
            <>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-white/[0.07] px-4 py-2 text-sm font-medium hover:bg-white/[0.04] transition-colors"
              >
                Dashboard
              </a>
              {plan && (
                <span className="hidden md:inline-flex items-center rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-xs font-mono tabular-nums text-muted-foreground">
                  {PLAN_LABEL[plan] ?? "Free plan"}
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-md border border-white/[0.07] px-4 py-2 text-sm font-medium hover:bg-white/[0.04] transition-colors"
              >
                Sign Out
              </button>
            </>
          ) : (
            <a
              href="/upgrade"
              className="inline-flex items-center justify-center rounded-md border border-white/[0.07] px-4 py-2 text-sm font-medium hover:bg-white/[0.04] transition-colors"
            >
              Sign In
            </a>
          )}

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-white/[0.03] border border-white/[0.07] rounded-full px-3 py-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Analysis runs locally. Signed-in history stores token counts only.</span>
          </div>
        </div>
      </div>
    </header>
  );
}
