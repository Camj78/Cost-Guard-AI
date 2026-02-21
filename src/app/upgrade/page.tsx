"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type View = "loading" | "login" | "upgrade" | "pro";

export default function UpgradePage() {
  const [view, setView] = useState<View>("loading");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.pro === true) setView("pro");
        // If user is logged in but not pro, show upgrade — but /api/me alone
        // can't distinguish "not logged in" vs "logged in, not pro".
        // We default to showing the login form; if they click upgrade without
        // being logged in, /api/checkout returns 401 and we re-show login.
        else setView("login");
      })
      .catch(() => setView("login"));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Something went wrong");
      } else {
        setEmailSent(true);
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">CostGuardAI Pro</h1>
          <p className="text-muted-foreground text-sm">$29 / month</p>
        </div>

        {view === "loading" && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}

        {view === "pro" && (
          <div className="space-y-4">
            <p className="text-sm font-medium">You&apos;re on Pro.</p>
            <Button onClick={handleBilling} disabled={busy} className="w-full">
              {busy ? "Redirecting..." : "Manage Billing"}
            </Button>
          </div>
        )}

        {view === "login" && !emailSent && (
          <div className="space-y-3">
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
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Sending..." : "Send magic link"}
              </Button>
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Unlock all Pro features — saved prompts, batch analysis, model comparison, PDF export, and more.
            </p>
            <Button onClick={handleUpgrade} disabled={busy} className="w-full">
              {busy ? "Redirecting..." : "Upgrade to Pro — $29/month"}
            </Button>
          </div>
        )}

        {view === "login" && emailSent && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Check your email.</p>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <strong>{email}</strong>. Click it to log in, then come back here to upgrade.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <a href="/" className="block text-xs text-muted-foreground hover:underline">
          ← Back to app
        </a>
      </div>
    </div>
  );
}
