"use client";

import { useEffect } from "react";
import { initPosthog, identifyUser } from "@/lib/analytics/posthog";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthog();

    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      fetch("/api/me")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { pro?: boolean; plan?: string } | null) => {
          if (!data) return;
          identifyUser(user.id, {
            email: user.email,
            plan: data.plan ?? "free",
          });
        })
        .catch(() => {});
    });
  }, []);

  return <>{children}</>;
}
