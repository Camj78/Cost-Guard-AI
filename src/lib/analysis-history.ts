import type { RiskAssessment } from "@/lib/risk";

const STORAGE_KEY = "cg_analysis_history_v1";
const MAX_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  savedPromptId: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  riskScore: number;
  createdAt: string;
}

type HistoryStore = Record<string, HistoryEntry[]>;

function loadStore(): HistoryStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function persistStore(store: HistoryStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // silently fail
  }
}

export function getHistory(savedPromptId: string): HistoryEntry[] {
  const store = loadStore();
  const entries = store[savedPromptId] ?? [];
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function addHistoryEntry(
  savedPromptId: string,
  analysis: RiskAssessment
): void {
  const store = loadStore();
  const existing = store[savedPromptId] ?? [];

  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    savedPromptId,
    tokens_in: analysis.inputTokens,
    tokens_out: analysis.expectedOutputTokens,
    cost: analysis.estimatedCostTotal,
    riskScore: analysis.riskScore,
    createdAt: new Date().toISOString(),
  };

  // Prepend, trim to max 20 (keep newest)
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  store[savedPromptId] = updated;
  persistStore(store);
}
