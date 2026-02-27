"use client";

import { useEffect, useState } from "react";
import FakeGate from "./FakeGate";
import type { UpgradeMoment } from "@/config/monetization";

export default function ProGate({
  children,
  moment,
}: {
  children: React.ReactNode;
  moment?: UpgradeMoment;
}) {
  const [isPro, setIsPro] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) =>
        r.ok
          ? r.json()
          : Promise.reject(new Error("me_not_ok"))
      )
      .then((d) => setIsPro(d.pro === true))
      .catch(() => setIsPro(false));
  }, []);

  if (isPro === null) return null; // loading
  if (!isPro) return <FakeGate moment={moment} />;
  return <>{children}</>;
}
