"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MODELS, type ModelConfig } from "@/config/models";
import { formatNumber } from "@/lib/formatters";

// Group models by provider
const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  meta: "Meta",
};

function groupByProvider(models: ModelConfig[]) {
  const groups: Record<string, ModelConfig[]> = {};
  for (const model of models) {
    if (!groups[model.provider]) groups[model.provider] = [];
    groups[model.provider].push(model);
  }
  return groups;
}

interface ModelSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ModelSelector({ selectedId, onSelect }: ModelSelectorProps) {
  const groups = groupByProvider(MODELS);
  const selectedModel = MODELS.find((m) => m.id === selectedId);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Model</label>
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedModel ? (
              <span className="flex items-center gap-2">
                <span>{selectedModel.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(selectedModel.contextWindow / 1000)}K ctx
                </span>
              </span>
            ) : (
              "Select a model"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groups).map(([provider, models]) => (
            <SelectGroup key={provider}>
              <SelectLabel className="text-xs text-muted-foreground uppercase tracking-wide">
                {PROVIDER_LABELS[provider] ?? provider}
              </SelectLabel>
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center justify-between w-full gap-4">
                    <span>{model.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatNumber(model.contextWindow / 1000)}K ctx
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
