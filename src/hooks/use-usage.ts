"use client";

import { useState, useEffect, useCallback } from "react";

export interface UsageState {
  isPro: boolean | null;      // null while loading
  isAuthed: boolean;          // true when res.is_authed === true
  usedThisMonth: number;
  limit: number | null;       // null = unlimited (Pro)
  isLimitReached: boolean;
  refetch: () => void;
}

export function useUsage(): UsageState {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [usedThisMonth, setUsedThisMonth] = useState(0);
  const [limit, setLimit] = useState<number | null>(25);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) return;
      const data = await res.json();
      setIsPro(data.pro === true);
      setIsAuthed(data.is_authed === true);
      setUsedThisMonth(typeof data.usage_this_month === "number" ? data.usage_this_month : 0);
      setLimit(data.usage_limit === null ? null : typeof data.usage_limit === "number" ? data.usage_limit : 25);
    } catch {
      // Silent — never surface errors
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const isLimitReached = limit !== null && usedThisMonth >= limit;

  return {
    isPro,
    isAuthed,
    usedThisMonth,
    limit,
    isLimitReached,
    refetch: fetchUsage,
  };
}
