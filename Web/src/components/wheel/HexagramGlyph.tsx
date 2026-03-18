/**
 * A single hexagram rendered as a miniature SVG group on the wheel.
 *
 * Shows the 6-line glyph, King Wen number, and name (if not compact).
 * Positioned and rotated by the parent (OuterRing).
 */

"use client";

import { memo } from "react";

export type GlyphState =
  | "default"
  | "selected"
  | "highlighted"
  | "dimmed"
  | "target"
  | "path_current"
  | "path_visited"
  | "neighbor_d1"
  | "neighbor_d2"
  | "neighbor_d3"
  | "filtered"
  | "highlighted_secondary";

interface HexagramGlyphProps {
  /** Position on the SVG canvas */
  x: number;
  y: number;
  /** Rotation angle in degrees for radial orientation */
  angleDeg: number;
  /** King Wen number (1-64) */
  kingWen: number;
  /** Hexagram name (e.g. "Ch'ien") */
  name: string;
  /** 6-bit binary string, MSB-first (index 0 = line 6/top) */
  binary: string;
  /** Visual state */
  state?: GlyphState;
  /** Scale factor for glyph size */
  scale?: number;
  /** Whether to hide the name (compact mode) */
  compact?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Hover handlers — forward mouse event for tooltip positioning */
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

// Glyph geometry constants (relative to glyph center, before scaling)
const LINE_WIDTH = 16;
const LINE_HEIGHT = 2;
const LINE_GAP = 3.5;
const BROKEN_GAP = 3;
const GLYPH_HEIGHT = 6 * LINE_HEIGHT + 5 * LINE_GAP; // total height of 6 lines

// Map glyph state to SVG style values
const STATE_STYLES: Record<
  GlyphState,
  { opacity: number; lineColor: string; textColor: string; glow: boolean }
> = {
  default: { opacity: 1, lineColor: "var(--foreground)", textColor: "var(--foreground)", glow: false },
  selected: { opacity: 1, lineColor: "var(--accent-yang)", textColor: "var(--accent-yang)", glow: true },
  highlighted: { opacity: 1, lineColor: "var(--accent-primary)", textColor: "var(--accent-primary)", glow: false },
  dimmed: { opacity: 0.2, lineColor: "var(--muted)", textColor: "var(--muted)", glow: false },
  target: { opacity: 1, lineColor: "var(--accent-yin)", textColor: "var(--accent-yin)", glow: true },
  path_current: { opacity: 1, lineColor: "var(--accent-yang)", textColor: "var(--accent-yang)", glow: true },
  path_visited: { opacity: 0.7, lineColor: "var(--accent-primary)", textColor: "var(--accent-primary)", glow: false },
  neighbor_d1: { opacity: 1, lineColor: "var(--accent-yang)", textColor: "var(--accent-yang)", glow: false },
  neighbor_d2: { opacity: 0.7, lineColor: "var(--accent-changing)", textColor: "var(--accent-changing)", glow: false },
  neighbor_d3: { opacity: 0.5, lineColor: "var(--accent-yin)", textColor: "var(--accent-yin)", glow: false },
  filtered: { opacity: 1, lineColor: "var(--accent-primary)", textColor: "var(--accent-primary)", glow: false },
  highlighted_secondary: { opacity: 0.5, lineColor: "var(--accent-primary)", textColor: "var(--accent-primary)", glow: false },
};

function HexagramGlyphInner({
  x,
  y,
  angleDeg,
  kingWen,
  name,
  binary,
  state = "default",
  scale = 1,
  compact = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: HexagramGlyphProps) {
  const styles = STATE_STYLES[state];

  // Text rotation: flip on bottom half so text is never upside-down
  const norm = ((angleDeg % 360) + 360) % 360;
  const isBottomHalf = norm > 90 && norm < 270;
  const textRotDeg = isBottomHalf ? angleDeg + 180 : angleDeg;
  const textAnchor = isBottomHalf ? "end" : "start";

  // Render 6 lines, top to bottom (binary index 0 = top line = line 6)
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const isYang = binary[i] === "1";
    const yOffset = -GLYPH_HEIGHT / 2 + i * (LINE_HEIGHT + LINE_GAP);

    if (isYang) {
      // Solid line
      lines.push(
        <rect
          key={i}
          x={-LINE_WIDTH / 2}
          y={yOffset}
          width={LINE_WIDTH}
          height={LINE_HEIGHT}
          fill={styles.lineColor}
          rx={0.5}
        />,
      );
    } else {
      // Broken line (two segments with gap)
      const segWidth = (LINE_WIDTH - BROKEN_GAP) / 2;
      lines.push(
        <g key={i}>
          <rect
            x={-LINE_WIDTH / 2}
            y={yOffset}
            width={segWidth}
            height={LINE_HEIGHT}
            fill={styles.lineColor}
            rx={0.5}
          />
          <rect
            x={-LINE_WIDTH / 2 + segWidth + BROKEN_GAP}
            y={yOffset}
            width={segWidth}
            height={LINE_HEIGHT}
            fill={styles.lineColor}
            rx={0.5}
          />
        </g>,
      );
    }
  }

  // Glow filter for selected/target states
  const filterId = styles.glow ? `glow-${kingWen}` : undefined;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        cursor: onClick ? "pointer" : "default",
        opacity: styles.opacity,
        transition: "opacity 300ms ease",
      }}
      role="button"
      aria-label={`Hexagram ${kingWen}: ${name}`}
      tabIndex={0}
    >
      <title>{`#${kingWen} ${name}`}</title>

      {/* Invisible hit area (larger than the visible glyph) */}
      <rect
        x={-14 * scale}
        y={-22 * scale}
        width={28 * scale}
        height={44 * scale}
        fill="transparent"
      />

      {/* Glow filter definition (only for selected/target) */}
      {styles.glow && (
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      {/* Hexagram glyph (6 lines) */}
      <g
        transform={`scale(${scale})`}
        filter={filterId ? `url(#${filterId})` : undefined}
      >
        {lines}
      </g>

      {/* King Wen number — positioned radially outward from the glyph */}
      <text
        transform={`rotate(${textRotDeg})`}
        x={isBottomHalf ? -GLYPH_HEIGHT * scale - 5 : GLYPH_HEIGHT * scale + 5}
        y={1.5}
        textAnchor={textAnchor}
        fontSize={9 * scale}
        fontWeight={500}
        fontFamily="var(--font-inter), Inter, system-ui, sans-serif"
        fill={styles.textColor}
        style={{ transition: "fill 300ms ease" }}
      >
        {kingWen}
      </text>

      {/* Name — further outward (hidden in compact mode) */}
      {!compact && (
        <text
          transform={`rotate(${textRotDeg})`}
          x={isBottomHalf ? -GLYPH_HEIGHT * scale - 16 : GLYPH_HEIGHT * scale + 16}
          y={1.5}
          textAnchor={textAnchor}
          fontSize={7 * scale}
          fontFamily="var(--font-crimson-pro), Crimson Pro, Georgia, serif"
          fill={styles.textColor}
          opacity={0.85}
          style={{ transition: "fill 300ms ease, opacity 300ms ease" }}
        >
          {name}
        </text>
      )}
    </g>
  );
}

export const HexagramGlyph = memo(HexagramGlyphInner);
