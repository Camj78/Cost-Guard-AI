"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);

 async function onSubmit(e: React.FormEvent) {
  e.preventDefault();

  const res = await fetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, company, source: "waitlist_page" }),
  });

  if (res.ok) setSubmitted(true);
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
        </div>

        {submitted ? (
          <div className="rounded-lg border p-6 space-y-2">
            <p className="font-medium">You’re on the list.</p>
            <p className="text-sm text-muted-foreground">
              We’ll email you when Pro opens.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-6">
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

            <Button type="submit" className="w-full">
              Join Waitlist
            </Button>

            <p className="text-xs text-muted-foreground">
              No spam. One email when Pro opens.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
