import { Check } from "lucide-react";
import { PLANS } from "@/config/plans";
import type { PricingTier } from "@/config/pricing";

export function PricingCard({
  tier,
  interval,
  comingSoon = false,
}: {
  tier: PricingTier;
  interval: "monthly" | "annual";
  comingSoon?: boolean;
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

  const ctaHref = isFree
    ? "/"
    : isPro
    ? interval === "annual"
      ? "/upgrade?plan=annual"
      : "/upgrade"
    : "/upgrade?tier=team";

  const ctaLabel = isFree ? "Start Free" : isPro ? "Upgrade to Pro" : "Start Team Trial";

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
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {tier.name}
          </p>
          {comingSoon && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.06em] border border-white/[0.15] text-muted-foreground px-2 py-0.5 rounded-full">
              Coming Soon
            </span>
          )}
        </div>
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
      {comingSoon ? (
        <button
          disabled
          className="inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium border border-white/[0.07] text-muted-foreground cursor-not-allowed opacity-50"
        >
          Coming Soon
        </button>
      ) : (
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
      )}
    </div>
  );
}
