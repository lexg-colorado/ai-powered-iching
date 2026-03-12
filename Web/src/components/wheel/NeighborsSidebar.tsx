/**
 * Sidebar for Neighbors mode — view hexagrams at Hamming distance 1, 2, 3
 * from the selected hexagram.
 */

"use client";

import { memo, useState } from "react";
import type { HexagramData } from "../../lib/types";
import type { NeighborEntry } from "../../lib/wheelRelationships";

interface NeighborsSidebarProps {
  source: HexagramData;
  neighbors: Map<number, NeighborEntry[]>;
  maxDistance: number;
  onDistanceChange: (d: number) => void;
  onSelectNeighbor: (kingWen: number) => void;
  onClose: () => void;
}

const DISTANCE_COLORS: Record<number, string> = {
  1: "text-yang",
  2: "text-changing",
  3: "text-yin",
};

const DISTANCE_BG: Record<number, string> = {
  1: "bg-yang/10 border-yang/30",
  2: "bg-changing/10 border-changing/30",
  3: "bg-yin/10 border-yin/30",
};

function NeighborsSidebarInner({
  source,
  neighbors,
  maxDistance,
  onDistanceChange,
  onSelectNeighbor,
  onClose,
}: NeighborsSidebarProps) {
  const [expandedDist, setExpandedDist] = useState<Set<number>>(new Set([1]));

  const toggleExpand = (d: number) => {
    setExpandedDist((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        next.delete(d);
      } else {
        next.add(d);
      }
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Source hexagram */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-heading text-foreground">
            #{source.king_wen} {source.name}
          </h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground text-lg"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-muted italic">{source.title}</p>
        <p className="text-xs font-mono text-muted mt-1">{source.binary}</p>
      </div>

      {/* Distance selector */}
      <div>
        <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
          Hamming Distance
        </h3>
        <div className="flex gap-2">
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              onClick={() => onDistanceChange(d)}
              className={`flex-1 px-3 py-1.5 text-xs rounded border transition-colors ${
                d <= maxDistance
                  ? `${DISTANCE_BG[d]} font-medium ${DISTANCE_COLORS[d]}`
                  : "bg-background border-border text-muted hover:text-foreground"
              }`}
            >
              d={d}
              <span className="ml-1 text-[10px] opacity-70">
                ({neighbors.get(d)?.length ?? 0})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Neighbor groups */}
      {[1, 2, 3]
        .filter((d) => d <= maxDistance)
        .map((d) => {
          const entries = neighbors.get(d) ?? [];
          const isExpanded = expandedDist.has(d);

          return (
            <div key={d}>
              <button
                onClick={() => toggleExpand(d)}
                className="w-full flex items-center justify-between text-sm font-heading text-foreground mb-2 border-b border-border pb-1"
              >
                <span className={DISTANCE_COLORS[d]}>
                  Distance {d}{" "}
                  <span className="text-xs font-normal text-muted">
                    ({entries.length} hexagram{entries.length !== 1 ? "s" : ""})
                  </span>
                </span>
                <span className="text-muted text-xs">{isExpanded ? "▾" : "▸"}</span>
              </button>

              {isExpanded && (
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {entries.map((entry) => (
                    <button
                      key={entry.hex.king_wen}
                      onClick={() => onSelectNeighbor(entry.hex.king_wen)}
                      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-surface transition-colors group"
                    >
                      <span className={`font-medium ${DISTANCE_COLORS[d]} group-hover:opacity-80`}>
                        #{entry.hex.king_wen}
                      </span>{" "}
                      <span className="text-foreground">{entry.hex.name}</span>
                      <span className="text-muted ml-1">
                        (line{entry.differingLines.length > 1 ? "s" : ""}{" "}
                        {entry.differingLines.join(", ")})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

export const NeighborsSidebar = memo(NeighborsSidebarInner);
