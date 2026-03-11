"use client";

import type { InputMode } from "@/lib/types";

interface CastModeSelectorProps {
  activeMode: InputMode;
  onModeChange: (mode: InputMode) => void;
  disabled?: boolean;
}

const MODES: { value: InputMode; label: string }[] = [
  { value: "cast", label: "Cast" },
  { value: "manual", label: "Manual" },
  { value: "number", label: "Number" },
];

export default function CastModeSelector({
  activeMode,
  onModeChange,
  disabled = false,
}: CastModeSelectorProps) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden">
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onModeChange(value)}
          disabled={disabled}
          className={`px-5 py-2.5 text-sm font-medium transition-colors ${
            activeMode === value
              ? "bg-accent text-white"
              : "bg-surface text-muted hover:bg-border/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
