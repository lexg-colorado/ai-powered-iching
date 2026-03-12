/**
 * Sidebar for Trigram Filter mode — 8×8 trigram cross-reference grid
 * and filter controls.
 *
 * Click trigrams on the wheel or in the grid to filter hexagrams
 * by upper/lower trigram position.
 */

"use client";

import { memo, useMemo } from "react";
import type { HexagramData } from "../../lib/types";
import { allHexagrams } from "../../lib/hexagram";

const TRIGRAM_ORDER = [
  { bits: "111", name: "Ch'ien", attr: "Heaven" },
  { bits: "011", name: "Tui", attr: "Lake" },
  { bits: "101", name: "Li", attr: "Fire" },
  { bits: "001", name: "Chen", attr: "Thunder" },
  { bits: "110", name: "Sun", attr: "Wind" },
  { bits: "010", name: "K'an", attr: "Water" },
  { bits: "100", name: "Ken", attr: "Mountain" },
  { bits: "000", name: "K'un", attr: "Earth" },
];

interface TrigramFilterSidebarProps {
  upperFilter: string | null;
  lowerFilter: string | null;
  matchingHexagrams: HexagramData[];
  onSetUpper: (bits: string | null) => void;
  onSetLower: (bits: string | null) => void;
  onClear: () => void;
  onSelectHexagram: (kingWen: number) => void;
}

/** Mini 3-line CSS glyph for a trigram */
function MiniTrigram({ bits }: { bits: string }) {
  return (
    <div className="flex flex-col gap-[1px] items-center">
      {[0, 1, 2].map((i) => {
        const isYang = bits[i] === "1";
        return (
          <div key={i} className="flex gap-[1px]">
            {isYang ? (
              <div className="w-2.5 h-[2px] bg-current rounded-[0.25px]" />
            ) : (
              <>
                <div className="w-[4px] h-[2px] bg-current rounded-[0.25px]" />
                <div className="w-[4px] h-[2px] bg-current rounded-[0.25px]" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TrigramFilterSidebarInner({
  upperFilter,
  lowerFilter,
  matchingHexagrams,
  onSetUpper,
  onSetLower,
  onClear,
  onSelectHexagram,
}: TrigramFilterSidebarProps) {
  // Build the 8×8 lookup grid: grid[upper_index][lower_index] = king_wen number
  const grid = useMemo(() => {
    const hexagrams = allHexagrams();
    const lookup = new Map<string, number>();
    for (const h of hexagrams) {
      const key = `${h.binary.slice(0, 3)}-${h.binary.slice(3, 6)}`;
      lookup.set(key, h.king_wen);
    }

    return TRIGRAM_ORDER.map((upper) =>
      TRIGRAM_ORDER.map((lower) => {
        const key = `${upper.bits}-${lower.bits}`;
        return lookup.get(key) ?? 0;
      }),
    );
  }, []);

  const hasFilter = upperFilter !== null || lowerFilter !== null;

  return (
    <div className="space-y-5">
      {/* Current filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-heading text-foreground border-b border-border pb-1 flex-1">
            Trigram Filter
          </h3>
          {hasFilter && (
            <button
              onClick={onClear}
              className="text-xs text-muted hover:text-foreground ml-2"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-4 text-xs">
          <div className="flex-1">
            <span className="text-muted">Upper: </span>
            {upperFilter ? (
              <button
                onClick={() => onSetUpper(null)}
                className="text-accent font-medium hover:text-accent-hover"
              >
                {TRIGRAM_ORDER.find((t) => t.bits === upperFilter)?.name ?? upperFilter}
                <span className="text-muted ml-1">✕</span>
              </button>
            ) : (
              <span className="text-muted italic">any</span>
            )}
          </div>
          <div className="flex-1">
            <span className="text-muted">Lower: </span>
            {lowerFilter ? (
              <button
                onClick={() => onSetLower(null)}
                className="text-accent font-medium hover:text-accent-hover"
              >
                {TRIGRAM_ORDER.find((t) => t.bits === lowerFilter)?.name ?? lowerFilter}
                <span className="text-muted ml-1">✕</span>
              </button>
            ) : (
              <span className="text-muted italic">any</span>
            )}
          </div>
        </div>

        {hasFilter && (
          <div className="mt-2 text-xs text-muted">
            {matchingHexagrams.length} matching hexagram{matchingHexagrams.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* 8×8 grid */}
      <div>
        <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
          Cross-Reference Grid
        </h3>
        <div className="text-[9px] text-muted mb-1 flex items-center gap-1">
          <span className="text-[8px]">Rows = Upper, Columns = Lower</span>
        </div>

        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-8" />
                {TRIGRAM_ORDER.map((t) => (
                  <th
                    key={t.bits}
                    className={`px-0.5 py-1 text-center cursor-pointer transition-colors ${
                      lowerFilter === t.bits
                        ? "text-accent"
                        : "text-muted hover:text-foreground"
                    }`}
                    onClick={() =>
                      onSetLower(lowerFilter === t.bits ? null : t.bits)
                    }
                    title={`${t.name} (${t.attr}) as lower trigram`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <MiniTrigram bits={t.bits} />
                      <span className="text-[7px] leading-none">{t.name.slice(0, 3)}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRIGRAM_ORDER.map((upper, ui) => (
                <tr key={upper.bits}>
                  <td
                    className={`pr-1 py-0.5 text-right cursor-pointer transition-colors ${
                      upperFilter === upper.bits
                        ? "text-accent"
                        : "text-muted hover:text-foreground"
                    }`}
                    onClick={() =>
                      onSetUpper(
                        upperFilter === upper.bits ? null : upper.bits,
                      )
                    }
                    title={`${upper.name} (${upper.attr}) as upper trigram`}
                  >
                    <div className="flex items-center gap-0.5 justify-end">
                      <span className="text-[7px]">{upper.name.slice(0, 3)}</span>
                      <MiniTrigram bits={upper.bits} />
                    </div>
                  </td>
                  {TRIGRAM_ORDER.map((lower, li) => {
                    const kw = grid[ui][li];
                    const isHighlighted =
                      (upperFilter === null || upperFilter === upper.bits) &&
                      (lowerFilter === null || lowerFilter === lower.bits) &&
                      hasFilter;
                    const isExactMatch =
                      upperFilter === upper.bits && lowerFilter === lower.bits;

                    return (
                      <td
                        key={lower.bits}
                        className={`text-center px-0.5 py-0.5 cursor-pointer transition-colors border border-border/30 ${
                          isExactMatch
                            ? "bg-accent/20 text-accent font-bold"
                            : isHighlighted
                              ? "bg-accent/10 text-foreground"
                              : "text-muted hover:text-foreground hover:bg-surface"
                        }`}
                        onClick={() => onSelectHexagram(kw)}
                        title={`Hexagram #${kw}`}
                      >
                        <span className="text-[9px]">{kw}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matching hexagrams list */}
      {hasFilter && matchingHexagrams.length > 0 && (
        <div>
          <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
            Matches
          </h3>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {matchingHexagrams.map((h) => (
              <button
                key={h.king_wen}
                onClick={() => onSelectHexagram(h.king_wen)}
                className="w-full text-left px-2 py-1 rounded text-xs hover:bg-surface transition-colors"
              >
                <span className="text-accent font-medium">#{h.king_wen}</span>{" "}
                <span className="text-foreground">{h.name}</span>{" "}
                <span className="text-muted italic">{h.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const TrigramFilterSidebar = memo(TrigramFilterSidebarInner);
