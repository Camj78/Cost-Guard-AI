"use client";

import { useState, useEffect, useCallback } from "react";
import { MODELS } from "@/config/models";
import {
  getSavedPrompts,
  savePrompt,
  deletePrompt,
  type SavedPrompt,
} from "@/lib/saved-prompts";

interface SavedPromptsPanelProps {
  prompt: string;
  modelId: string;
  onLoad: (prompt: string, modelId: string, id: string) => void;
}

export function SavedPromptsPanel({ prompt, modelId, onLoad }: SavedPromptsPanelProps) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const reload = useCallback(() => {
    setPrompts(getSavedPrompts());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleSave() {
    const name = nameInput.trim();
    if (!name || !prompt.trim()) return;
    savePrompt(name, prompt, modelId);
    setNameInput("");
    setIsSaving(false);
    reload();
  }

  function handleDelete(id: string) {
    deletePrompt(id);
    reload();
  }

  function handleLoad(p: SavedPrompt) {
    onLoad(p.prompt, p.model, p.id);
  }

  function getModelName(modelId: string) {
    return MODELS.find((m) => m.id === modelId)?.name ?? modelId;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Saved Prompts</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save and reload prompts across sessions.
          </p>
        </div>
        {!isSaving && (
          <button
            onClick={() => setIsSaving(true)}
            disabled={!prompt.trim()}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save current
          </button>
        )}
      </div>

      {isSaving && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Prompt name…"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") { setIsSaving(false); setNameInput(""); }
            }}
            autoFocus
            className="flex h-8 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            onClick={handleSave}
            disabled={!nameInput.trim()}
            className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Save
          </button>
          <button
            onClick={() => { setIsSaving(false); setNameInput(""); }}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {prompts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
          No saved prompts yet.
        </p>
      ) : (
        <div className="space-y-2">
          {prompts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {getModelName(p.model)} &middot;{" "}
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleLoad(p)}
                  className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="rounded-md border border-red-500/20 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
