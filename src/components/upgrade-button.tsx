"use client";

import { Button } from "@/components/ui/button";
import { copyByMoment, type UpgradeMoment } from "@/config/monetization";

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
          ? "bg-indigo-600 hover:bg-indigo-500 text-white border-0"
          : undefined
      }
    >
      <a href="/upgrade">{ctaLabel}</a>
    </Button>
  );
}
