/**
 * Wheel mode controls: explore/transform toggle and utility buttons.
 */

"use client";

import { memo } from "react";

export type WheelMode = "explore" | "transform" | "pathway" | "neighbors" | "trigram_filter" | "elements";

interface WheelControlsProps {
  mode: WheelMode;
  onModeChange: (mode: WheelMode) => void;
  onReset: () => void;
}

function WheelControlsInner({
  mode,
  onModeChange,
  onReset,
}: WheelControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Mode toggle */}
      <div className="flex rounded-md border border-border overflow-hidden text-xs">
        <button
          onClick={() => onModeChange("explore")}
          className={`px-2 py-1.5 transition-colors ${
            mode === "explore"
              ? "bg-accent-yang/20 text-foreground font-medium"
              : "bg-surface text-muted hover:text-foreground"
          }`}
          aria-pressed={mode === "explore"}
          title="Explore mode: click a hexagram to see its relationships"
        >
          Explore
        </button>
        <button
          onClick={() => onModeChange("transform")}
          className={`px-2 py-1.5 transition-colors border-l border-border ${
            mode === "transform"
              ? "bg-accent-yin/20 text-foreground font-medium"
              : "bg-surface text-muted hover:text-foreground"
          }`}
          aria-pressed={mode === "transform"}
          title="Transform mode: select two hexagrams to see their XOR transformation"
        >
          Transform
        </button>
        <button
          onClick={() => onModeChange("pathway")}
          className={`px-2 py-1.5 transition-colors border-l border-border ${
            mode === "pathway"
              ? "bg-accent-changing/20 text-foreground font-medium"
              : "bg-surface text-muted hover:text-foreground"
          }`}
          aria-pressed={mode === "pathway"}
          title="Pathway mode: walk through single-line changes step by step"
        >
          Pathway
        </button>
        <button
          onClick={() => onModeChange("neighbors")}
          className={`px-2 py-1.5 transition-colors border-l border-border ${
            mode === "neighbors"
              ? "bg-accent-primary/20 text-foreground font-medium"
              : "bg-surface text-muted hover:text-foreground"
          }`}
          aria-pressed={mode === "neighbors"}
          title="Neighbors mode: see hexagrams at Hamming distance 1, 2, 3..."
        >
          Neighbors
        </button>
        <button
          onClick={() => onModeChange("trigram_filter")}
          className={`px-2 py-1.5 transition-colors border-l border-border ${
            mode === "trigram_filter"
              ? "bg-accent-yang/20 text-foreground font-medium"
              : "bg-surface text-muted hover:text-foreground"
          }`}
          aria-pressed={mode === "trigram_filter"}
          title="Trigram Filter: click trigrams to filter hexagrams by upper/lower position"
        >
          Trigrams
        </button>
        <button
          onClick={() => onModeChange("elements")}
          className={`px-2 py-1.5 transition-colors border-l border-border ${
            mode === "elements"
              ? "bg-accent-changing/20 text-foreground font-medium"
              : "bg-surface text-muted hover:text-foreground"
          }`}
          aria-pressed={mode === "elements"}
          title="Elements: explore Wu Xing (Five Elements) relationships and associated hexagrams"
        >
          Elements
        </button>
      </div>

      {/* Reset all state */}
      <button
        onClick={onReset}
        className="px-2 py-1.5 text-xs text-muted hover:text-foreground border border-border rounded-md bg-surface transition-colors"
        title="Reset all state in the current mode"
      >
        Reset
      </button>
    </div>
  );
}

export const WheelControls = memo(WheelControlsInner);
