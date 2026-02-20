"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function WaitlistPage() {
  const [count, setCount] = useState<number | null>(null);

  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [already, setAlready] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/waitlist/count", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const n = Number(data?.count);
        if (Number.isFinite(n)) setCount(n);
      } catch {
        // optionally setCount(0) or ignore
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlready(false);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          company: company.trim(),
          source: "waitlist_page",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Submit failed. Please try again.");
        return;
      }

      if (data?.already) setAlready(true);
      setSubmitted(true);

      // Optional: refresh count after successful submit
      try {
        const r2 = await fetch("/api/waitlist/count", { cache: "no-store" });
        const d2 = await r2.json();
        const n2 = Number(d2?.count);
        if (Number.isFinite(n2)) setCount(n2);
      } catch {}
    } catch {
      setError("Network error. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-16">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Join the Pro Waitlist
          </h1>
          <p className="text-muted-foreground">
            Pro adds historical drift tracking, batch analysis, and team-ready reporting.
            Get early access when it ships.
          </p>

          {count !== null && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {count.toLocaleString()}
              </span>{" "}
              founders already joined.
            </p>
          )}

          {count !== null && count < 25 && (
            <p className="text-xs text-muted-foreground">
              Early access is limited — first invites go out to early adopters.
            </p>
          )}
        </div>

        {submitted ? (
          <div className="rounded-lg border p-6 space-y-2">
            <p className="font-medium">
              {already ? "You’re already on the list." : "You’re on the list."}
            </p>
            <p className="text-sm text-muted-foreground">
              We’ll email you when Pro opens.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Company <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="CostGuardAI"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Joining..." : "Join Waitlist"}
            </Button>

           <p className="text-xs text-muted-foreground">
  No spam. One email when Pro opens. We never sell your email.
</p>
          </form>
        )}
      </div>
      <footer className="mx-auto mt-10 max-w-xl border-t pt-6 text-center text-[11px] text-muted-foreground">
  Built for AI founders shipping production workloads.{" "}
  <span className="opacity-80">No prompt storage. No training on your data.</span>
</footer>
    </main>
  );
}
