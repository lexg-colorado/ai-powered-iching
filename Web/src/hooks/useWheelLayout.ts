/**
 * Computes all positions for the wheel's three rings based on container size.
 *
 * Returns memoized layout data that recalculates when dimensions change.
 */

import { useMemo } from "react";
import { ringPosition, pentagonVertices } from "../lib/wheelMath";
import type { Point } from "../lib/wheelMath";

// ---------------------------------------------------------------------------
// Later Heaven (Wen Wang) trigram arrangement — 8 trigrams starting from South
// ---------------------------------------------------------------------------

export const LATER_HEAVEN_TRIGRAMS = [
  { bits: "101", name: "Li", attribute: "Fire", direction: "S" },
  { bits: "000", name: "K'un", attribute: "Earth", direction: "SW" },
  { bits: "011", name: "Tui", attribute: "Lake", direction: "W" },
  { bits: "111", name: "Ch'ien", attribute: "Heaven", direction: "NW" },
  { bits: "010", name: "K'an", attribute: "Water", direction: "N" },
  { bits: "100", name: "Ken", attribute: "Mountain", direction: "NE" },
  { bits: "001", name: "Chen", attribute: "Thunder", direction: "E" },
  { bits: "110", name: "Sun", attribute: "Wind", direction: "SE" },
] as const;

// ---------------------------------------------------------------------------
// Wu Xing five elements
// ---------------------------------------------------------------------------

export const WU_XING_ELEMENTS = [
  { name: "Fire", color: "#c4420a" },
  { name: "Earth", color: "#b8860b" },
  { name: "Metal", color: "#9ca3af" },
  { name: "Water", color: "#2563eb" },
  { name: "Wood", color: "#4a8b3f" },
] as const;

// ---------------------------------------------------------------------------
// Layout types
// ---------------------------------------------------------------------------

export interface HexagramPosition extends Point {
  index: number; // 0-63 (index in King Wen sequence)
  kingWen: number; // 1-64
  angleDeg: number;
  angleRad: number;
}

export interface TrigramPosition extends Point {
  index: number;
  bits: string;
  name: string;
  attribute: string;
  direction: string;
  angleDeg: number;
  angleRad: number;
}

export interface ElementPosition extends Point {
  name: string;
  color: string;
}

export interface WheelLayout {
  /** Center of the SVG coordinate space */
  center: Point;
  /** Size of the square viewport */
  size: number;
  /** Outer ring radius (hexagram centers) */
  outerRadius: number;
  /** Inner ring radius (trigram centers) */
  innerRadius: number;
  /** Center radius (Wu Xing vertices) */
  centerRadius: number;
  /** Scale factor for hexagram glyphs */
  glyphScale: number;
  /** Positions of all 64 hexagrams on the outer ring */
  hexagrams: HexagramPosition[];
  /** Positions of 8 trigrams on the inner ring */
  trigrams: TrigramPosition[];
  /** Positions of 5 Wu Xing elements at center */
  elements: ElementPosition[];
  /** Whether we're in compact mode (hide names) */
  compact: boolean;
}

export interface HexagramData {
  king_wen: number;
  name: string;
  title: string;
  binary: string;
  upper_trigram: string;
  lower_trigram: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWheelLayout(
  width: number,
  height: number,
  hexagrams: HexagramData[],
): WheelLayout {
  return useMemo(() => {
    const size = Math.min(width, height);
    const cx = size / 2;
    const cy = size / 2;
    const compact = size < 600;

    const outerRadius = size * 0.40;
    const innerRadius = size * 0.22;
    const centerRadius = size * 0.11;
    const glyphScale = Math.max(0.3, size / 1200);

    // Outer ring: 64 hexagrams in King Wen order
    const hexPositions: HexagramPosition[] = hexagrams.map((h, i) => {
      const pos = ringPosition(i, 64, cx, cy, outerRadius);
      return {
        ...pos,
        index: i,
        kingWen: h.king_wen,
      };
    });

    // Inner ring: 8 trigrams in Later Heaven order
    // Start from South (bottom) = 180° from top. Index 0 at bottom, clockwise.
    const trigramPositions: TrigramPosition[] = LATER_HEAVEN_TRIGRAMS.map(
      (t, i) => {
        // Later Heaven starts at South (bottom = +90° from our top-based system)
        const angleRad = (i / 8) * 2 * Math.PI + Math.PI / 2;
        const angleDeg = (i / 8) * 360 + 90;
        return {
          x: cx + innerRadius * Math.cos(angleRad),
          y: cy + innerRadius * Math.sin(angleRad),
          index: i,
          bits: t.bits,
          name: t.name,
          attribute: t.attribute,
          direction: t.direction,
          angleDeg: ((angleDeg % 360) + 360) % 360,
          angleRad,
        };
      },
    );

    // Center: Wu Xing pentagon
    const pentVerts = pentagonVertices(cx, cy, centerRadius);
    const elementPositions: ElementPosition[] = WU_XING_ELEMENTS.map(
      (el, i) => ({
        ...pentVerts[i],
        name: el.name,
        color: el.color,
      }),
    );

    return {
      center: { x: cx, y: cy },
      size,
      outerRadius,
      innerRadius,
      centerRadius,
      glyphScale,
      hexagrams: hexPositions,
      trigrams: trigramPositions,
      elements: elementPositions,
      compact,
    };
  }, [width, height, hexagrams]);
}
