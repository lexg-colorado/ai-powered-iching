/**
 * A single trigram rendered as a miniature SVG group on the inner ring.
 *
 * Shows 3 lines (solid/broken), name, and attribute.
 */

"use client";

import { memo } from "react";

interface TrigramNodeProps {
  x: number;
  y: number;
  bits: string; // 3-bit binary
  name: string;
  attribute: string;
  angleDeg: number;
  scale?: number;
  highlighted?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const LINE_WIDTH = 20;
const LINE_HEIGHT = 2.5;
const LINE_GAP = 4;
const BROKEN_GAP = 4;

function TrigramNodeInner({
  x,
  y,
  bits,
  name,
  attribute,
  angleDeg,
  scale = 1,
  highlighted = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: TrigramNodeProps) {
  const lineColor = highlighted ? "var(--accent-yin)" : "var(--foreground)";
  const textColor = highlighted ? "var(--accent-yin)" : "var(--muted)";
  const totalHeight = 3 * LINE_HEIGHT + 2 * LINE_GAP;

  // Render 3 lines top to bottom (bits[0] = top line)
  const lines = [];
  for (let i = 0; i < 3; i++) {
    const isYang = bits[i] === "1";
    const yOffset = -totalHeight / 2 + i * (LINE_HEIGHT + LINE_GAP);

    if (isYang) {
      lines.push(
        <rect
          key={i}
          x={-LINE_WIDTH / 2}
          y={yOffset}
          width={LINE_WIDTH}
          height={LINE_HEIGHT}
          fill={lineColor}
          rx={0.5}
        />,
      );
    } else {
      const segWidth = (LINE_WIDTH - BROKEN_GAP) / 2;
      lines.push(
        <g key={i}>
          <rect
            x={-LINE_WIDTH / 2}
            y={yOffset}
            width={segWidth}
            height={LINE_HEIGHT}
            fill={lineColor}
            rx={0.5}
          />
          <rect
            x={-LINE_WIDTH / 2 + segWidth + BROKEN_GAP}
            y={yOffset}
            width={segWidth}
            height={LINE_HEIGHT}
            fill={lineColor}
            rx={0.5}
          />
        </g>,
      );
    }
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ cursor: "pointer", transition: "opacity 300ms ease" }}
      role="button"
      aria-label={`Trigram ${name} (${attribute})`}
      tabIndex={0}
    >
      <title>{`${name} (${attribute})`}</title>

      {/* Hit area */}
      <circle r={20 * scale} fill="transparent" />

      {/* Trigram lines */}
      <g transform={`scale(${scale})`}>{lines}</g>

      {/* Name below */}
      <text
        y={totalHeight * scale / 2 + 10 * scale}
        textAnchor="middle"
        fontSize={7 * scale}
        fontFamily="var(--font-crimson-pro), Crimson Pro, Georgia, serif"
        fill={textColor}
        fontWeight={highlighted ? 600 : 400}
        style={{ transition: "fill 300ms ease" }}
      >
        {name}
      </text>

      {/* Attribute above */}
      <text
        y={-totalHeight * scale / 2 - 5 * scale}
        textAnchor="middle"
        fontSize={5.5 * scale}
        fontFamily="var(--font-inter), Inter, system-ui, sans-serif"
        fill={textColor}
        opacity={0.7}
        style={{ transition: "fill 300ms ease" }}
      >
        {attribute}
      </text>
    </g>
  );
}

export const TrigramNode = memo(TrigramNodeInner);
