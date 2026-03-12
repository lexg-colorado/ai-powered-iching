/**
 * The outer ring of 64 hexagram glyphs arranged in King Wen sequence.
 */

"use client";

import { memo } from "react";
import { HexagramGlyph, type GlyphState } from "./HexagramGlyph";
import type { HexagramPosition } from "../../hooks/useWheelLayout";
import type { HexagramData } from "../../lib/types";

interface OuterRingProps {
  positions: HexagramPosition[];
  hexagrams: HexagramData[];
  /** Radius of the ring (for the decorative circle) */
  radius: number;
  center: { x: number; y: number };
  /** Scale factor for glyphs */
  glyphScale: number;
  /** Compact mode hides names */
  compact: boolean;
  /** Map of King Wen number → glyph visual state */
  glyphStates?: Map<number, GlyphState>;
  /** Called when a hexagram is clicked */
  onHexagramClick?: (kingWen: number) => void;
  /** Called on hover — with optional mouse event for tooltip positioning */
  onHexagramHover?: (kingWen: number | null, clientX?: number, clientY?: number) => void;
}

function OuterRingInner({
  positions,
  hexagrams,
  radius,
  center,
  glyphScale,
  compact,
  glyphStates,
  onHexagramClick,
  onHexagramHover,
}: OuterRingProps) {
  return (
    <g className="outer-ring">
      {/* Decorative ring circle */}
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={0.5}
        opacity={0.4}
      />

      {/* 64 hexagram glyphs */}
      {positions.map((pos) => {
        const hex = hexagrams[pos.index];
        if (!hex) return null;

        const state = glyphStates?.get(hex.king_wen) ?? "default";

        return (
          <HexagramGlyph
            key={hex.king_wen}
            x={pos.x}
            y={pos.y}
            angleDeg={pos.angleDeg}
            kingWen={hex.king_wen}
            name={hex.name}
            binary={hex.binary}
            state={state}
            scale={glyphScale}
            compact={compact}
            onClick={onHexagramClick ? () => onHexagramClick(hex.king_wen) : undefined}
            onMouseEnter={
              onHexagramHover
                ? (e: React.MouseEvent) => onHexagramHover(hex.king_wen, e.clientX, e.clientY)
                : undefined
            }
            onMouseLeave={onHexagramHover ? () => onHexagramHover(null) : undefined}
          />
        );
      })}
    </g>
  );
}

export const OuterRing = memo(OuterRingInner);
