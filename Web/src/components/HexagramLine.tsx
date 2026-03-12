"use client";

import type { LineValue } from "@/lib/types";

interface HexagramLineProps {
  lineNumber: number;
  value: LineValue | null;
  interactive?: boolean;
  onChange?: (value: LineValue | null) => void;
  showLabel?: boolean;
}

/**
 * A single hexagram line that cycles through states on click:
 * null -> 7 (yang) -> 8 (yin) -> 9 (old yang) -> 6 (old yin) -> null
 */
export default function HexagramLine({
  lineNumber,
  value,
  interactive = false,
  onChange,
  showLabel = true,
}: HexagramLineProps) {
  const cycle: (LineValue | null)[] = [null, 7, 8, 9, 6];

  function handleClick() {
    if (!interactive || !onChange) return;
    const currentIdx = cycle.indexOf(value);
    const nextIdx = (currentIdx + 1) % cycle.length;
    onChange(cycle[nextIdx]);
  }

  return (
    <div
      className={`flex items-center gap-3 ${interactive ? "cursor-pointer select-none" : ""}`}
      onClick={handleClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      {showLabel && (
        <span className="w-6 text-right text-sm text-muted font-mono">
          {lineNumber}.
        </span>
      )}
      <div className="flex-1">
        <LineSymbol value={value} />
      </div>
    </div>
  );
}

function LineSymbol({ value }: { value: LineValue | null }) {
  if (value === null) {
    return (
      <div className="flex items-center h-6">
        <div className="w-full h-2 rounded bg-border opacity-40" />
      </div>
    );
  }

  const isYang = value === 7 || value === 9;
  const changing = value === 6 || value === 9;

  if (isYang) {
    // Solid line
    return (
      <div className="flex items-center h-6 relative">
        <div
          className={`w-full h-3 rounded-sm ${
            changing
              ? "bg-yang"
              : "bg-foreground"
          }`}
        />
        {changing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-background bg-transparent" />
          </div>
        )}
      </div>
    );
  }

  // Broken line (yin)
  return (
    <div className="flex items-center h-6 gap-3 relative">
      <div
        className={`flex-1 h-3 rounded-sm ${
          changing
            ? "bg-yin"
            : "bg-foreground"
        }`}
      />
      <div className="w-5 flex items-center justify-center">
        {changing && (
          <span className="text-xs font-bold text-yin">
            ×
          </span>
        )}
      </div>
      <div
        className={`flex-1 h-3 rounded-sm ${
          changing
            ? "bg-yin"
            : "bg-foreground"
        }`}
      />
    </div>
  );
}
