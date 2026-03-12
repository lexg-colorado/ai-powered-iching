/**
 * Sidebar for Elements mode — Wu Xing (Five Elements) exploration.
 *
 * Shows the selected element's properties, generating/overcoming
 * cycle relationships, and associated hexagrams.
 */

"use client";

import { memo, useMemo } from "react";
import {
  getElementRelationships,
  getHexagramsByElement,
  WU_XING_TRIGRAM_MAP,
} from "../../lib/wheelRelationships";
import type { HexagramData } from "../../lib/types";

/** Element colors matching WU_XING_ELEMENTS in useWheelLayout */
const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#c4420a",
  Earth: "#b8860b",
  Metal: "#9ca3af",
  Water: "#2563eb",
  Wood: "#4a8b3f",
};

const ELEMENT_ORDER = ["Wood", "Fire", "Earth", "Metal", "Water"];

interface ElementsSidebarProps {
  selectedElement: string | null;
  onSelectElement: (name: string) => void;
  onSelectHexagram: (kingWen: number) => void;
  onClear: () => void;
}

function ElementsSidebarInner({
  selectedElement,
  onSelectElement,
  onSelectHexagram,
  onClear,
}: ElementsSidebarProps) {
  const relationships = useMemo(
    () => (selectedElement ? getElementRelationships(selectedElement) : null),
    [selectedElement],
  );

  const associatedHexagrams = useMemo(
    () => (selectedElement ? getHexagramsByElement(selectedElement) : []),
    [selectedElement],
  );

  return (
    <div className="space-y-5">
      {/* Element selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-heading text-foreground border-b border-border pb-1 flex-1">
            Wu Xing — Five Elements
          </h3>
          {selectedElement && (
            <button
              onClick={onClear}
              className="text-xs text-muted hover:text-foreground ml-2"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {ELEMENT_ORDER.map((el) => (
            <button
              key={el}
              onClick={() => onSelectElement(el)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                selectedElement === el
                  ? "font-medium border-current"
                  : "border-border hover:border-current"
              }`}
              style={{ color: ELEMENT_COLORS[el] }}
            >
              {el}
            </button>
          ))}
        </div>
      </div>

      {/* Selected element details */}
      {relationships && (
        <>
          {/* Cycle relationships */}
          <div>
            <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
              Cycles
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-muted">Generating (Sheng): </span>
                <button
                  onClick={() => onSelectElement(relationships.generatedBy)}
                  className="hover:underline"
                  style={{ color: ELEMENT_COLORS[relationships.generatedBy] }}
                >
                  {relationships.generatedBy}
                </button>
                <span className="text-muted"> → </span>
                <span className="font-medium" style={{ color: ELEMENT_COLORS[relationships.name] }}>
                  {relationships.name}
                </span>
                <span className="text-muted"> → </span>
                <button
                  onClick={() => onSelectElement(relationships.generates)}
                  className="hover:underline"
                  style={{ color: ELEMENT_COLORS[relationships.generates] }}
                >
                  {relationships.generates}
                </button>
              </div>
              <div>
                <span className="text-muted">Overcoming (Ke): </span>
                <button
                  onClick={() => onSelectElement(relationships.overcomeBy)}
                  className="hover:underline"
                  style={{ color: ELEMENT_COLORS[relationships.overcomeBy] }}
                >
                  {relationships.overcomeBy}
                </button>
                <span className="text-muted"> → </span>
                <span className="font-medium" style={{ color: ELEMENT_COLORS[relationships.name] }}>
                  {relationships.name}
                </span>
                <span className="text-muted"> → </span>
                <button
                  onClick={() => onSelectElement(relationships.overcomes)}
                  className="hover:underline"
                  style={{ color: ELEMENT_COLORS[relationships.overcomes] }}
                >
                  {relationships.overcomes}
                </button>
              </div>
            </div>
          </div>

          {/* Associated trigrams */}
          <div>
            <h3 className="text-sm font-heading text-foreground mb-2 border-b border-border pb-1">
              Trigrams
            </h3>
            <div className="text-xs text-muted">
              {relationships.trigramNames.join(", ")} ({relationships.trigramBits.join(", ")})
            </div>
          </div>

          {/* Associated hexagrams */}
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
                  <span className="font-medium" style={{ color: ELEMENT_COLORS[selectedElement!] }}>
                    #{h.king_wen}
                  </span>{" "}
                  <span className="text-foreground">{h.name}</span>{" "}
                  <span className="text-muted italic">{h.title}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {!selectedElement && (
        <p className="text-sm text-muted italic">
          Click an element on the wheel or above to explore its relationships.
        </p>
      )}
    </div>
  );
}

export const ElementsSidebar = memo(ElementsSidebarInner);
