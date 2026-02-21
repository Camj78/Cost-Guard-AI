const STORAGE_KEY = "cg_saved_prompts_v1";

export interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  model: string;
  createdAt: string;
}

export function getSavedPrompts(): SavedPrompt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export function savePrompt(name: string, prompt: string, model: string): SavedPrompt {
  const entry: SavedPrompt = {
    id: crypto.randomUUID(),
    name,
    prompt,
    model,
    createdAt: new Date().toISOString(),
  };
  const existing = getSavedPrompts();
  const updated = [entry, ...existing];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full — silently fail
  }
  return entry;
}

export function deletePrompt(id: string): void {
  const existing = getSavedPrompts();
  const updated = existing.filter((p) => p.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // silently fail
  }
}
