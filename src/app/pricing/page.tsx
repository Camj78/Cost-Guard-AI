"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PRICING, type PricingTier } from "@/config/pricing";
import { PLANS } from "@/config/plans";

export default function PricingPage() {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  const primaryTiers = PRICING.filter((p) => p.id !== PLANS.ENTERPRISE);
  const enterprise = PRICING.find((p) => p.id === PLANS.ENTERPRISE)!;

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="mx-auto max-w-5xl px-6 pt-20 pb-12 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-4">
          Pricing
        </p>
        <h1 className="text-5xl font-black tracking-tight mb-4">
          Simple, clear pricing
        </h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Built for teams shipping AI into production.
        </p>
      </div>

      {/* Billing interval toggle */}
      <div className="flex justify-center mb-10">
        <div className="flex items-center gap-1 bg-muted/20 border border-white/10 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              interval === "monthly"
                ? "bg-white/10 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("annual")}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              interval === "annual"
                ? "bg-white/10 text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
            <span className="ml-2 text-xs text-emerald-400 font-medium">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {/* Primary pricing cards */}
      <div className="mx-auto max-w-5xl px-6 grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        {primaryTiers.map((tier) => (
          <PricingCard key={tier.id} tier={tier} interval={interval} />
        ))}
      </div>

      {/* Enterprise section */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="border border-white/[0.07] rounded-lg p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">
                {enterprise.name}
              </p>
              <p className="text-2xl font-semibold tracking-tight">
                {enterprise.description}
              </p>
            </div>
            <ul className="space-y-2">
              {enterprise.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <a
            href="mailto:contact@costguardai.io"
            className="shrink-0 inline-flex items-center justify-center rounded-md border border-white/[0.12] px-6 py-2.5 text-sm font-medium hover:bg-white/[0.04] transition-colors"
          >
            Contact Sales
          </a>
        </div>
      </div>

      {/* Back link */}
      <div className="mx-auto max-w-5xl px-6 pb-8">
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          ← Back to app
        </Link>
      </div>
    </div>
  );
}

function PricingCard({
  tier,
  interval,
}: {
  tier: PricingTier;
  interval: "monthly" | "annual";
}) {
  const isHighlighted = tier.highlighted === true;
  const isPro = tier.id === PLANS.PRO;
  const isFree = tier.id === PLANS.FREE;

  const price =
    isPro && interval === "annual" && tier.priceYearly !== undefined
      ? tier.priceYearly
      : tier.priceMonthly;

  const priceSuffix =
    tier.priceMonthly === 0
      ? "forever"
      : isPro && interval === "annual"
      ? "/ year"
      : "/ month";

  const ctaLabel = isFree
    ? "Start Free"
    : isPro
    ? "Upgrade to Pro"
    : "Start Team Trial";

  const ctaHref = isFree
    ? "/"
    : isPro
    ? interval === "annual"
      ? "/upgrade?plan=annual"
      : "/upgrade"
    : "/upgrade?tier=team";

  return (
    <div
      className={`relative flex flex-col gap-6 rounded-lg p-8 ${
        isHighlighted
          ? "border-2 border-primary bg-primary/[0.04]"
          : "border border-white/[0.07]"
      }`}
    >
      {isHighlighted && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-[0.08em] px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Plan label + description */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">
          {tier.name}
        </p>
        <p className="text-xs text-muted-foreground">{tier.description}</p>
      </div>

      {/* Price */}
      <div>
        {tier.priceMonthly === null ? (
          <span className="text-2xl font-semibold tracking-tight">Custom</span>
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black font-mono tracking-tight tabular-nums">
              ${price}
            </span>
            <span className="text-sm text-muted-foreground">{priceSuffix}</span>
          </div>
        )}
        {isPro && interval === "annual" && (
          <p className="text-xs text-emerald-400 font-medium mt-1">
            $24.17/month · Save 17%
          </p>
        )}
        {isPro && interval === "monthly" && (
          <p className="text-xs text-muted-foreground mt-1">Cancel anytime.</p>
        )}
        {isFree && (
          <p className="text-xs text-muted-foreground mt-1">No card required.</p>
        )}
      </div>

      {/* Feature list */}
      <ul className="space-y-2 flex-1">
        {tier.features.map((f) => (
          <li
            key={f}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href={ctaHref}
        className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
          isHighlighted
            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            : "border border-white/[0.12] hover:bg-white/[0.04]"
        }`}
      >
        {ctaLabel}
      </a>
    </div>
  );
}
