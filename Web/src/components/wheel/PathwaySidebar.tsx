/**
 * Sidebar for Pathway mode — walk through the GF(2)^6 hypercube
 * by flipping one line at a time.
 *
 * Shows step history with hexagram glyphs, trigram decomposition,
 * distance tracking, line-flip detail, and cycle detection.
 */

"use client";

import { memo, useMemo } from "react";
import type { HexagramData } from "../../lib/types";
import { hammingDistance } from "../../lib/wheelRelationships";
import { HexagramSearchInput } from "./HexagramSearchInput";

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
  onStartFrom?: (kingWen: number) => void;
}

/** Line labels: 1=bottom, 6=top */
const LINE_LABELS = ["Line 1 (Bottom)", "Line 2", "Line 3", "Line 4", "Line 5", "Line 6 (Top)"];

/** Trigram name lookup */
const TRIGRAM_NAMES: Record<string, string> = {
  "111": "Ch'ien (Heaven)", "000": "K'un (Earth)",
  "001": "Chen (Thunder)", "010": "K'an (Water)",
  "011": "Tui (Lake)", "100": "Ken (Mountain)",
  "101": "Li (Fire)", "110": "Sun (Wind)",
};

/** Miniature 6-line hexagram glyph rendered in CSS */
function MiniHexGlyph({ binary, highlightLine }: { binary: string; highlightLine?: number | null }) {
  // binary[0]=line6(top), binary[5]=line1(bottom) — render top-to-bottom
  return (
    <div className="flex flex-col gap-[2px] items-center">
      {[0, 1, 2, 3, 4, 5].map((idx) => {
        const lineNum = 6 - idx;
        const isYang = binary[idx] === "1";
        const isHighlighted = highlightLine === lineNum;
        const color = isHighlighted ? "bg-changing" : "bg-current";
        return (
          <div key={idx} className="flex gap-[1px]">
            {isYang ? (
              <div className={`w-4 h-[2px] ${color} rounded-[0.25px]`} />
            ) : (
              <>
                <div className={`w-[7px] h-[2px] ${color} rounded-[0.25px]`} />
                <div className={`w-[7px] h-[2px] ${color} rounded-[0.25px]`} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PathwaySidebarInner({
  steps,
  onFlipLine,
  onUndo,
  onReset,
  onNavigate,
  onStartFrom,
}: PathwaySidebarProps) {
  const current = steps[steps.length - 1];

  // Detect cycles: find if current hex was previously visited
  const visitedSet = useMemo(() => {
    const set = new Map<number, number>(); // king_wen → first step index
    for (let i = 0; i < steps.length; i++) {
      const kw = steps[i].hex.king_wen;
      if (!set.has(kw)) set.set(kw, i);
    }
    return set;
  }, [steps]);

  const cycleDetected = useMemo(() => {
    if (steps.length < 2) return null;
    const currentKw = steps[steps.length - 1].hex.king_wen;
    // Check if this hexagram appeared earlier (not counting itself)
    for (let i = 0; i < steps.length - 1; i++) {
      if (steps[i].hex.king_wen === currentKw) return i;
    }
    return null;
  }, [steps]);

  if (!current) {
    return (
      <div>
        <HexagramSearchInput
          value={null}
          onChange={(kw) => onStartFrom?.(kw)}
          label="Starting Hexagram"
          placeholder="Search by number or name..."
        />
        <p className="text-xs text-muted italic mt-2">
          Or click a hexagram on the wheel to begin.
        </p>
      </div>
    );
  }

  const binary = current.hex.binary;
  const upperTrigram = binary.slice(0, 3);
  const lowerTrigram = binary.slice(3, 6);
  const startHex = steps[0].hex;
  const distanceFromStart = steps.length > 1 ? hammingDistance(startHex.binary, binary) : 0;

  return (
    <div className="space-y-5">
      {/* Current hexagram with glyph */}
      <div>
        <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
          Current Position
        </h3>
        <div className="flex items-start gap-3">
          <MiniHexGlyph binary={binary} highlightLine={current.lineFlipped} />
          <div>
            <div className="text-base font-medium text-foreground">
              #{current.hex.king_wen} {current.hex.name}
            </div>
            <div className="text-xs text-muted italic">{current.hex.title}</div>
            <div className="text-xs font-mono text-muted mt-1">{binary}</div>
          </div>
        </div>

        {/* Trigram decomposition */}
        <div className="mt-2 text-xs text-muted">
          <span>{TRIGRAM_NAMES[upperTrigram] ?? upperTrigram}</span>
          <span className="mx-1">over</span>
          <span>{TRIGRAM_NAMES[lowerTrigram] ?? lowerTrigram}</span>
        </div>

        {/* Distance from start */}
        {steps.length > 1 && (
          <div className="mt-1 text-xs text-muted">
            Hamming distance from start: <span className="text-foreground font-medium">{distanceFromStart}</span>
            <span className="text-muted ml-1">({steps.length - 1} step{steps.length > 2 ? "s" : ""} taken)</span>
          </div>
        )}

        {/* Cycle detection */}
        {cycleDetected !== null && (
          <div className="mt-2 px-2 py-1 rounded bg-changing/10 text-changing text-xs">
            Cycle detected — returned to step {cycleDetected === 0 ? "Start" : cycleDetected}
          </div>
        )}
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
            // Traditional line name
            const positionName = isYang ? "Nine" : "Six";
            const positionLabel = lineNum === 1 ? "at the beginning" : lineNum === 6 ? "at the top" : `in the ${["", "first", "second", "third", "fourth", "fifth"][lineNum]} place`;

            return (
              <button
                key={lineNum}
                onClick={() => onFlipLine(lineNum)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded border border-border bg-background hover:bg-surface hover:border-changing transition-colors text-xs group"
                title={`${positionName} ${positionLabel}`}
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
            {steps.map((step, i) => {
              const isCurrent = i === steps.length - 1;
              // Check if this hexagram appears more than once (cycle indicator)
              const isDuplicate = i < steps.length - 1 && steps.slice(i + 1).some((s) => s.hex.king_wen === step.hex.king_wen);
              // Describe the line flip
              let flipDesc = "";
              if (step.lineFlipped && i > 0) {
                const prevBinary = steps[i - 1].hex.binary;
                const prevIdx = 6 - step.lineFlipped;
                const wasYang = prevBinary[prevIdx] === "1";
                flipDesc = wasYang ? "Yang→Yin" : "Yin→Yang";
              }

              return (
                <button
                  key={i}
                  onClick={() => onNavigate(step.hex.king_wen)}
                  className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    isCurrent
                      ? "bg-yang/10 text-yang font-medium"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                  title={isCurrent ? "Current position" : "Click to jump back to this step"}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      <span className="text-[10px] text-muted mr-1">
                        {i === 0 ? "Start" : `L${step.lineFlipped}`}
                      </span>
                      #{step.hex.king_wen} {step.hex.name}
                      {isDuplicate && <span className="text-changing ml-1">↺</span>}
                    </span>
                    {flipDesc && (
                      <span className="text-[10px] text-muted">{flipDesc}</span>
                    )}
                  </div>
                </button>
              );
            })}
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
