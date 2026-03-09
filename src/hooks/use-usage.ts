"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UsageState {
  isPro: boolean | null;      // null while loading
  plan: string | null;        // null while loading; canonical plan from /api/me
  isAuthed: boolean;          // true when res.is_authed === true
  usedThisMonth: number;
  limit: number | null;       // null = unlimited (Pro)
  isLimitReached: boolean;
  proJustActivated: boolean;  // true when checkout=success redirect flipped pro to true
  firstName: string | null;   // from users table via /api/me
  isFounder: boolean;         // true when user email matches FOUNDER_EMAIL env var
  refetch: () => void;
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 5;

export function useUsage(): UsageState {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [limit, setLimit] = useState<number | null>(25);
  const [proJustActivated, setProJustActivated] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isFounder, setIsFounder] = useState(false);

  const pollCountRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);

  const fetchUsage = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) return false;
      const data = await res.json();
      // Use plan (server's canonical source of truth) — same field the header uses.
      // data.pro is the legacy boolean kept for backwards compat; plan is authoritative.
      const resolvedPlan: string = typeof data.plan === "string" ? data.plan : "free";
      const newIsPro = resolvedPlan !== "free";
      setPlan(resolvedPlan);
      setIsPro(newIsPro);
      setIsAuthed(data.is_authed === true);
      setUsedThisMonth(typeof data.usage_this_month === "number" ? data.usage_this_month : 0);
      setLimit(data.usage_limit === null ? null : typeof data.usage_limit === "number" ? data.usage_limit : 25);
      setFirstName(typeof data.firstName === "string" && data.firstName ? data.firstName : null);
      setIsFounder(data.isFounder === true);
      return newIsPro;
    } catch {
      return false;
    }
  }, []);

  const refetch = useCallback(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    // Check for checkout=success in URL (only runs client-side)
    const isCheckoutSuccess =
      typeof window !== "undefined" &&
      window.location.search.includes("checkout=success");

    if (isCheckoutSuccess) {
      // Clean the query param immediately so it doesn't persist on refresh
      if (typeof window !== "undefined" && window.history) {
        const clean =
          window.location.pathname +
          window.location.search
            .replace(/[?&]checkout=success/, "")
            .replace(/^&/, "?") +
          window.location.hash;
        window.history.replaceState(null, "", clean || window.location.pathname);
      }

      // Poll until pro flips to true or max attempts exceeded
      isPollingRef.current = true;
      pollCountRef.current = 0;

      const poll = async () => {
        if (!isPollingRef.current) return;
        pollCountRef.current += 1;

        const nowPro = await fetchUsage();
        if (nowPro) {
          setProJustActivated(true);
          isPollingRef.current = false;
          return;
        }

        if (pollCountRef.current < POLL_MAX_ATTEMPTS) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          isPollingRef.current = false;
        }
      };

      poll();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchUsage();
    }

    return () => {
      isPollingRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [fetchUsage]);

  const isLimitReached = limit !== null && usedThisMonth >= limit;

  return {
    isPro,
    plan,
    isAuthed,
    usedThisMonth,
    limit,
    isLimitReached,
    proJustActivated,
    firstName,
    isFounder,
    refetch,
  };
}
