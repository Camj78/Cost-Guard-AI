"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Phase 1: no backend complexity.
    // This just confirms intent. We’ll wire storage in Phase 2.
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen px-4 sm:px-6 py-16">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Join the Pro Waitlist
          </h1>
          <p className="text-muted-foreground">
            Pro adds historical drift tracking, batch analysis, and team-ready
            reporting. Get early access when it ships.
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
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                type="email"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Company <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="CostGuardAI"
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
