/**
 * Sidebar for Compass mode — Earlier & Later Heaven trigram arrangements.
 *
 * Shows directional placement of trigrams, opposing axes,
 * selected trigram details, and associated hexagrams.
 */

"use client";

import { memo, useMemo } from "react";
import {
  COMPASS_DATA,
  COMPASS_PAIR_AXES,
  findByTrigram,
  type CompassTrigramInfo,
} from "../../lib/wheelRelationships";

/** Colors for the arrangement toggle */
const ARRANGEMENT_COLORS = {
  earlier: "#9b8e7d",
  later: "#d4a017",
} as const;

/** Direction positions in a 3x3 grid (row-major order) */
const GRID_POSITIONS: (string | null)[] = [
  "NW", "N", "NE",
  "W",  null, "E",
  "SW", "S", "SE",
];


interface CompassSidebarProps {
  arrangement: "earlier" | "later";
  onSetArrangement: (arr: "earlier" | "later") => void;
  selectedTrigram: string | null;
  onSelectTrigram: (bits: string) => void;
  onSelectHexagram: (kingWen: number) => void;
  onClear: () => void;
}

function CompassSidebarInner({
  arrangement,
  onSetArrangement,
  selectedTrigram,
  onSelectTrigram,
  onSelectHexagram,
  onClear,
}: CompassSidebarProps) {
  const trigrams = useMemo(() => COMPASS_DATA[arrangement], [arrangement]);

  /** Map direction → trigram info for grid lookup */
  const directionMap = useMemo(() => {
    const m = new Map<string, CompassTrigramInfo>();
    for (const t of trigrams) {
      m.set(t.direction, t);
    }
    return m;
  }, [trigrams]);

  /** Currently selected trigram info */
  const selectedInfo = useMemo(
    () =>
      selectedTrigram
        ? trigrams.find((t) => t.bits === selectedTrigram) ?? null
        : null,
    [selectedTrigram, trigrams],
  );

  /** Opposite trigram info */
  const oppositeInfo = useMemo(
    () =>
      selectedInfo
        ? trigrams.find((t) => t.bits === selectedInfo.oppositeBits) ?? null
        : null,
    [selectedInfo, trigrams],
  );

  /** Hexagrams containing the selected trigram */
  const associatedHexagrams = useMemo(
    () => (selectedTrigram ? findByTrigram(selectedTrigram, "any") : []),
    [selectedTrigram],
  );

  /** Axis direction labels for the current arrangement */
  const axisDirections = useMemo(() => {
    const result: Record<string, string> = {};
    for (const axis of COMPASS_PAIR_AXES) {
      const infoA = trigrams.find((t) => t.bits === axis.a);
      const infoB = trigrams.find((t) => t.bits === axis.b);
      if (infoA && infoB) {
        result[`${axis.a}-${axis.b}`] = `${infoA.direction}\u2013${infoB.direction}`;
      }
    }
    return result;
  }, [trigrams]);

  return (
    <div className="space-y-5">
      {/* Arrangement toggle */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-heading text-foreground border-b border-border pb-1 flex-1">
            Compass — Ba Gua Arrangement
          </h3>
          {selectedTrigram && (
            <button
              onClick={onClear}
              className="text-xs text-muted hover:text-foreground ml-2"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => onSetArrangement("earlier")}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              arrangement === "earlier"
                ? "font-medium border-current"
                : "border-border hover:border-current"
            }`}
            style={{ color: ARRANGEMENT_COLORS.earlier }}
          >
            Earlier Heaven
          </button>
          <button
            onClick={() => onSetArrangement("later")}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              arrangement === "later"
                ? "font-medium border-current"
                : "border-border hover:border-current"
            }`}
            style={{ color: ARRANGEMENT_COLORS.later }}
          >
            Later Heaven
          </button>
        </div>
      </div>

      {/* Directional map — 3x3 grid */}
      <div>
        <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
          Directional Map
        </h3>
        <div className="grid grid-cols-3 gap-1">
          {GRID_POSITIONS.map((dir, idx) => {
            if (dir === null) {
              // Center cell — compass dot
              return (
                <div
                  key={idx}
                  className="flex items-center justify-center text-muted text-lg"
                  style={{ minHeight: "2.5rem" }}
                >
                  ●
                </div>
              );
            }
            const info = directionMap.get(dir);
            if (!info) {
              return <div key={idx} style={{ minHeight: "2.5rem" }} />;
            }
            const isSelected = selectedTrigram === info.bits;
            return (
              <button
                key={idx}
                onClick={() => onSelectTrigram(info.bits)}
                className={`flex flex-col items-center justify-center rounded text-xs transition-colors px-1 ${
                  isSelected
                    ? "bg-surface font-medium text-foreground"
                    : "hover:bg-surface text-muted hover:text-foreground"
                }`}
                style={{
                  minHeight: "2.5rem",
                  ...(isSelected
                    ? { color: ARRANGEMENT_COLORS[arrangement] }
                    : {}),
                }}
                title={`${info.name} — ${info.attribute} (${dir})`}
              >
                <span className="font-medium">{info.name}</span>
                <span className="text-[0.6rem] opacity-70">{dir}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected trigram detail */}
      {selectedInfo && (
        <div>
          <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
            {selectedInfo.name} — {selectedInfo.attribute}
          </h3>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-muted">Direction: </span>
              <span className="text-foreground">{selectedInfo.direction}</span>
            </div>
            {arrangement === "later" && selectedInfo.season && (
              <div>
                <span className="text-muted">Season: </span>
                <span className="text-foreground">{selectedInfo.season}</span>
              </div>
            )}
            <div>
              <span className="text-muted">Family: </span>
              <span className="text-foreground">{selectedInfo.family}</span>
            </div>
            <div>
              <span className="text-muted">Animal: </span>
              <span className="text-foreground">{selectedInfo.animal}</span>
            </div>
            <div>
              <span className="text-muted">Body Part: </span>
              <span className="text-foreground">{selectedInfo.bodyPart}</span>
            </div>
            <div>
              <span className="text-muted">Element: </span>
              <span className="text-foreground">{selectedInfo.element}</span>
            </div>
            <div>
              <span className="text-muted">Role: </span>
              <span className="text-foreground">{selectedInfo.role}</span>
            </div>

            {/* Opposite pair */}
            {oppositeInfo && (
              <div className="pt-1">
                <span className="text-muted">Opposite: </span>
                <button
                  onClick={() => onSelectTrigram(oppositeInfo.bits)}
                  className="hover:underline"
                  style={{ color: ARRANGEMENT_COLORS[arrangement] }}
                >
                  {oppositeInfo.name} ({oppositeInfo.attribute})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pair axes */}
      <div>
        <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
          Opposing Axes
        </h3>
        <div className="space-y-1.5 text-xs">
          {COMPASS_PAIR_AXES.map((axis) => {
            const dirLabel =
              axisDirections[`${axis.a}-${axis.b}`] ?? "";
            return (
              <div key={`${axis.a}-${axis.b}`} className="flex items-center gap-1">
                <button
                  onClick={() => onSelectTrigram(axis.a)}
                  className={`hover:underline ${
                    selectedTrigram === axis.a
                      ? "font-medium"
                      : ""
                  }`}
                  style={{
                    color:
                      selectedTrigram === axis.a
                        ? ARRANGEMENT_COLORS[arrangement]
                        : undefined,
                  }}
                >
                  {axis.label.split(" / ")[0]}
                </button>
                <span className="text-muted">{"\u2194"}</span>
                <button
                  onClick={() => onSelectTrigram(axis.b)}
                  className={`hover:underline ${
                    selectedTrigram === axis.b
                      ? "font-medium"
                      : ""
                  }`}
                  style={{
                    color:
                      selectedTrigram === axis.b
                        ? ARRANGEMENT_COLORS[arrangement]
                        : undefined,
                  }}
                >
                  {axis.label.split(" / ")[1]}
                </button>
                {dirLabel && (
                  <span className="text-muted ml-auto text-[0.65rem]">
                    {dirLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Associated hexagrams */}
      {selectedInfo && associatedHexagrams.length > 0 && (
        <div>
          <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
            Hexagrams ({associatedHexagrams.length})
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {associatedHexagrams.map((h) => (
              <button
                key={h.king_wen}
                onClick={() => onSelectHexagram(h.king_wen)}
                className="w-full text-left px-2 py-1 rounded text-xs hover:bg-surface transition-colors"
              >
                <span
                  className="font-medium"
                  style={{ color: ARRANGEMENT_COLORS[arrangement] }}
                >
                  #{h.king_wen}
                </span>{" "}
                <span className="text-foreground">{h.name}</span>{" "}
                <span className="text-muted italic">{h.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!selectedTrigram && (
        <p className="text-sm text-muted italic">
          Click a trigram on the wheel or the directional map to explore its
          compass associations.
        </p>
      )}
    </div>
  );
}

export const CompassSidebar = memo(CompassSidebarInner);
