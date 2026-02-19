"use client";

import { Slider } from "@/components/ui/slider";
import { formatNumber } from "@/lib/formatters";
import { MIN_EXPECTED_OUTPUT as MIN_OUTPUT } from "@/config/models";

interface OutputSliderProps {
  value: number;
  max: number;
  onChange: (n: number) => void;
}

// Common output presets for quick selection
const PRESETS = [256, 512, 1024, 2048, 4096];

export function OutputSlider({ value, max, onChange }: OutputSliderProps) {
  const clampedMax = max;
  const visiblePresets = PRESETS.filter((p) => p <= clampedMax);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Expected output length</label>
        <span className="text-sm font-mono tabular-nums text-muted-foreground">
          {formatNumber(value)} tokens
        </span>
      </div>
      <Slider
        min={MIN_OUTPUT}
        max={clampedMax}
        step={128}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatNumber(MIN_OUTPUT)}</span>
        {/* Quick preset buttons */}
        <div className="flex gap-1">
          {visiblePresets.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                value === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {p >= 1000 ? `${p / 1000}k` : p}
            </button>
          ))}
        </div>
        <span>{formatNumber(clampedMax)}</span>
      </div>
    </div>
  );
}
