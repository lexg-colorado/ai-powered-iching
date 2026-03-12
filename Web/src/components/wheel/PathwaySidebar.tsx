/**
 * Sidebar for Pathway mode — walk through the GF(2)^6 hypercube
 * by flipping one line at a time.
 *
 * Shows step history and 6 line-flip buttons for the current hexagram.
 */

"use client";

import { memo } from "react";
import type { HexagramData } from "../../lib/types";

export interface PathwayStep {
  hex: HexagramData;
  /** Which line was flipped to arrive here (null for the starting hexagram) */
  lineFlipped: number | null;
}

interface PathwaySidebarProps {
  steps: PathwayStep[];
  onFlipLine: (lineNumber: number) => void;
  onUndo: () => void;
  onReset: () => void;
  onNavigate: (kingWen: number) => void;
}

/** Line labels: 1=bottom, 6=top */
const LINE_LABELS = ["Line 1 (Bottom)", "Line 2", "Line 3", "Line 4", "Line 5", "Line 6 (Top)"];

function PathwaySidebarInner({
  steps,
  onFlipLine,
  onUndo,
  onReset,
  onNavigate,
}: PathwaySidebarProps) {
  const current = steps[steps.length - 1];

  if (!current) {
    return (
      <div className="text-sm text-muted italic">
        Click a hexagram on the wheel to begin walking the hypercube.
      </div>
    );
  }

  const binary = current.hex.binary;

  return (
    <div className="space-y-5">
      {/* Current hexagram */}
      <div>
        <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
          Current Position
        </h3>
        <div className="text-base font-medium text-foreground">
          #{current.hex.king_wen} {current.hex.name}
        </div>
        <div className="text-xs text-muted italic">{current.hex.title}</div>
        <div className="text-xs font-mono text-muted mt-1">{binary}</div>
      </div>

      {/* Line flip buttons */}
      <div>
        <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
          Flip a Line
        </h3>
        <div className="space-y-1.5">
          {[1, 2, 3, 4, 5, 6].map((lineNum) => {
            // binary index: line 1 = index 5, line 6 = index 0
            const idx = 6 - lineNum;
            const isYang = binary[idx] === "1";
            const symbol = isYang ? "⚊" : "⚋";
            const willBe = isYang ? "⚋ Yin" : "⚊ Yang";

            return (
              <button
                key={lineNum}
                onClick={() => onFlipLine(lineNum)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded border border-border bg-background hover:bg-surface hover:border-changing transition-colors text-xs group"
              >
                <span className="text-muted group-hover:text-foreground">
                  {LINE_LABELS[lineNum - 1]}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-foreground">{symbol}</span>
                  <span className="text-muted">→</span>
                  <span className="text-changing font-medium">{willBe}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step history */}
      {steps.length > 1 && (
        <div>
          <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
            Path History ({steps.length} steps)
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {steps.map((step, i) => (
              <button
                key={i}
                onClick={() => onNavigate(step.hex.king_wen)}
                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                  i === steps.length - 1
                    ? "bg-yang/10 text-yang font-medium"
                    : "text-muted hover:text-foreground hover:bg-surface"
                }`}
              >
                <span className="text-[10px] text-muted mr-1">
                  {i === 0 ? "Start" : `L${step.lineFlipped}`}
                </span>
                #{step.hex.king_wen} {step.hex.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={onUndo}
          disabled={steps.length <= 1}
          className="flex-1 px-3 py-1.5 text-xs border border-border rounded bg-surface text-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Undo
        </button>
        <button
          onClick={onReset}
          className="flex-1 px-3 py-1.5 text-xs border border-border rounded bg-surface text-muted hover:text-foreground transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export const PathwaySidebar = memo(PathwaySidebarInner);
