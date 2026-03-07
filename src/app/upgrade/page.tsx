"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type View = "loading" | "login" | "upgrade" | "pro";

const FEATURES: { label: string; free: string; pro: string }[] = [
  { label: "Preflight analyses", free: "25 / month", pro: "Unlimited" },
  { label: "Risk history & drift tracking", free: "—", pro: "✓" },
  { label: "Model comparison matrix", free: "—", pro: "✓" },
  { label: "Batch analysis (up to 50)", free: "—", pro: "✓" },
  { label: "Saved prompts (cloud)", free: "—", pro: "✓" },
  { label: "PDF export", free: "—", pro: "✓" },
  { label: "Shareable links", free: "✓", pro: "✓" },
];

export default function UpgradePage() {
  const [view, setView] = useState<View>("loading");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const [cooldownSecs, setCooldownSecs] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const COOLDOWN_SECS = 60;

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldownSecs(COOLDOWN_SECS);
    cooldownRef.current = setInterval(() => {
      setCooldownSecs((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.pro === true) setView("pro");
        else if (d.is_authed === true) setView("upgrade");
        else setView("login");
      })
      .catch(() => setView("login"));
  }, []);

  async function sendMagicLink(emailAddr: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddr }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Couldn't send the magic link. Please try again.");
        if (res.status === 429) startCooldown();
      } else {
        setEmailSent(true);
        startCooldown();
      }
    } catch {
      setError("Couldn't send the magic link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await sendMagicLink(email);
  }

  async function handleUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        setView("login");
        setError("Please log in first.");
        setBusy(false);
        return;
      }
      const d = await res.json();
      if (d.url) {
        window.location.href = d.url;
      } else {
        setError("Could not start checkout.");
        setBusy(false);
      }
    } catch {
      setError("Something went wrong");
      setBusy(false);
    }
  }

  async function handleBilling() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing", { method: "POST" });
      const d = await res.json();
      if (d.url) {
        window.location.href = d.url;
      } else {
        setError("Could not open billing portal.");
        setBusy(false);
      }
    } catch {
      setError("Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-8">

        {/* Header */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            CostGuardAI Pro
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Ship AI features without cost surprises or production failures.
          </h1>
          <p className="text-sm text-muted-foreground">
            The preflight layer between your prompts and production. Catch token overflow, cost drift, and failure risk before a request ships.
          </p>
        </div>

        {/* Feature comparison table — always visible */}
        <div className="glass-card p-6 space-y-3">
          <div className="grid grid-cols-[1fr_72px_64px] gap-2 pb-1 border-b border-white/5">
            <span />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground text-right">
              Free
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-primary text-right">
              Pro
            </span>
          </div>
          {FEATURES.map(({ label, free, pro }) => (
            <div
              key={label}
              className="grid grid-cols-[1fr_72px_64px] gap-2 items-center"
            >
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs text-muted-foreground text-right font-mono tabular-nums">
                {free}
              </span>
              <span
                className={`text-xs text-right font-mono tabular-nums ${
                  pro === "—"
                    ? "text-muted-foreground"
                    : "text-emerald-400 font-semibold"
                }`}
              >
                {pro}
              </span>
            </div>
          ))}
        </div>

        {view === "loading" && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {view === "pro" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-emerald-400">You&apos;re on Pro.</p>
            <Button onClick={handleBilling} disabled={busy} className="w-full">
              {busy ? "Redirecting..." : "Manage Billing"}
            </Button>
          </div>
        )}

        {view === "login" && !emailSent && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your email to log in, then upgrade.
            </p>
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" disabled={busy || cooldownSecs > 0} className="w-full">
                {cooldownSecs > 0
                  ? `Try again in ${cooldownSecs}s`
                  : busy
                  ? "Sending..."
                  : "Send magic link"}
              </Button>
              {cooldownSecs > 0 && (
                <p className="text-xs text-muted-foreground">
                  Only the most recent link works. Check spam/promotions.
                </p>
              )}
            </form>
            <button
              type="button"
              onClick={() => setView("upgrade")}
              className="text-xs text-muted-foreground hover:underline"
            >
              Already logged in? Upgrade →
            </button>
          </div>
        )}

        {view === "upgrade" && (
          <div className="space-y-4">
            {/* Plan toggle */}
            <div className="flex items-center gap-1 bg-muted/20 border border-white/10 rounded-lg p-1 w-fit">
              <button
                type="button"
                onClick={() => setPlan("monthly")}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  plan === "monthly"
                    ? "bg-white/10 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPlan("annual")}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  plan === "annual"
                    ? "bg-white/10 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
                <span className="ml-2 text-xs text-emerald-400 font-medium">
                  Save $58
                </span>
              </button>
            </div>

            {/* Price display */}
            <div className="space-y-0.5">
              {plan === "monthly" ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black font-mono tracking-tight">
                      $29
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / month
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cancel anytime.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black font-mono tracking-tight">
                      $290
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / year
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    $24.17/month billed annually.{" "}
                    <span className="text-emerald-400 font-medium">
                      Save $58 vs monthly.
                    </span>
                  </p>
                </>
              )}
            </div>

            {/* Risk reversal */}
            <p className="text-xs text-muted-foreground">
              If CostGuardAI doesn&apos;t surface a real cost, overflow, or risk issue in your first 7 days, email us for a full refund. No forms.
            </p>

            <Button
              onClick={handleUpgrade}
              disabled={busy}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            >
              {busy
                ? "Redirecting..."
                : plan === "monthly"
                ? "Upgrade to Pro — $29/month"
                : "Upgrade to Pro — $290/year"}
            </Button>
          </div>
        )}

        {view === "login" && emailSent && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Check your email.</p>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong>{email}</strong>. Click it to log in, then come back here to upgrade.
            </p>
            {cooldownSecs > 0 ? (
              <p className="text-xs text-muted-foreground">
                Resend in {cooldownSecs}s
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setEmailSent(false)}
                className="text-xs text-muted-foreground hover:underline"
              >
                Resend magic link
              </button>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Link href="/" className="block text-xs text-muted-foreground hover:underline">
          ← Back to app
        </Link>
      </div>
    </div>
  );
}
