/**
 * The inner ring of 8 trigrams in Later Heaven (Wen Wang) arrangement.
 */

"use client";

import { memo } from "react";
import { TrigramNode } from "./TrigramNode";
import type { TrigramPosition } from "../../hooks/useWheelLayout";

interface InnerRingProps {
  positions: TrigramPosition[];
  radius: number;
  center: { x: number; y: number };
  scale: number;
  /** Currently highlighted trigram bits (from hover) */
  highlightedTrigram?: string | null;
  /** Additional highlighted trigrams (e.g., from hexagram hover showing upper+lower) */
  highlightedTrigrams?: string[];
  onTrigramHover?: (bits: string | null) => void;
  onTrigramClick?: (bits: string) => void;
}

function InnerRingInner({
  positions,
  radius,
  center,
  scale,
  highlightedTrigram,
  highlightedTrigrams,
  onTrigramHover,
  onTrigramClick,
}: InnerRingProps) {
  return (
    <g className="inner-ring">
      {/* Decorative ring circle */}
      <circle
        cx={center.x}
        cy={center.y}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={0.5}
        opacity={0.3}
      />

      {/* 8 trigram nodes */}
      {positions.map((pos) => (
        <TrigramNode
          key={pos.bits}
          x={pos.x}
          y={pos.y}
          bits={pos.bits}
          name={pos.name}
          attribute={pos.attribute}
          angleDeg={pos.angleDeg}
          scale={scale * 1.2}
          highlighted={highlightedTrigram === pos.bits || highlightedTrigrams?.includes(pos.bits) === true}
          onClick={onTrigramClick ? () => onTrigramClick(pos.bits) : undefined}
          onMouseEnter={onTrigramHover ? () => onTrigramHover(pos.bits) : undefined}
          onMouseLeave={onTrigramHover ? () => onTrigramHover(null) : undefined}
        />
      ))}
    </g>
  );
}

export const InnerRing = memo(InnerRingInner);
