"use client";

import { Button } from "@/components/ui/button";
import { copyByMoment, type UpgradeMoment } from "@/config/monetization";
import { trackEvent } from "@/lib/analytics/posthog";

interface UpgradeButtonProps {
  moment: UpgradeMoment;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function UpgradeButton({
  moment,
  variant = "default",
  size = "sm",
}: UpgradeButtonProps) {
  const { ctaLabel } = copyByMoment[moment];
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={
        variant === "default"
          ? "bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          : undefined
      }
    >
      <a href="/upgrade" onClick={() => trackEvent("upgrade_clicked")}>{ctaLabel}</a>
    </Button>
  );
}
