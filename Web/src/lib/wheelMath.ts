/**
 * Pure geometry functions for the hexagram wheel layout.
 *
 * All angles in radians unless suffixed "Deg".
 * Coordinate origin: top-left of SVG viewBox.
 */

export interface Point {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Polar → Cartesian
// ---------------------------------------------------------------------------

/** Convert polar coordinates to cartesian. Angle 0 = right (+x axis). */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number,
): Point {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

/**
 * Position for the Nth item of `total` items on a circle.
 * Index 0 starts at 12 o'clock and goes clockwise.
 */
export function ringPosition(
  index: number,
  total: number,
  cx: number,
  cy: number,
  radius: number,
): Point & { angleDeg: number; angleRad: number } {
  const angleRad = (index / total) * 2 * Math.PI - Math.PI / 2; // -π/2 = top
  const angleDeg = (index / total) * 360 - 90;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
    angleDeg,
    angleRad,
  };
}

// ---------------------------------------------------------------------------
// Text orientation — flip text on the bottom half so it's never upside-down
// ---------------------------------------------------------------------------

/**
 * Return the rotation (degrees) for radially-oriented text at `angleDeg`.
 * Text on the bottom half of the circle is flipped 180° so it reads outward.
 */
export function textRotation(angleDeg: number): number {
  const norm = ((angleDeg % 360) + 360) % 360;
  // Bottom half: 90° < angle < 270° → flip
  return norm > 90 && norm < 270 ? angleDeg + 180 : angleDeg;
}

/**
 * Text anchor for radially oriented text.
 * On the top half, text-anchor=start (reads outward from center).
 * On the bottom half (flipped), text-anchor=end to keep reading outward.
 */
export function textAnchor(angleDeg: number): "start" | "end" {
  const norm = ((angleDeg % 360) + 360) % 360;
  return norm > 90 && norm < 270 ? "end" : "start";
}

// ---------------------------------------------------------------------------
// Arc paths for relationship lines
// ---------------------------------------------------------------------------

/**
 * Generate an SVG quadratic Bézier path between two points on the ring,
 * with the control point pulled toward the center for a nice inward curve.
 *
 * @param pullFactor 0 = straight line, 1 = control point at center. Default 0.6.
 */
export function arcPath(
  from: Point,
  to: Point,
  center: Point,
  pullFactor = 0.6,
): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const cx = midX + (center.x - midX) * pullFactor;
  const cy = midY + (center.y - midY) * pullFactor;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

/**
 * Circle outline path for ring borders (used as <circle> is simpler,
 * but this is here if we need a <path> for stroke-dashoffset animation).
 */
export function circlePath(cx: number, cy: number, r: number): string {
  return (
    `M ${cx - r} ${cy} ` +
    `A ${r} ${r} 0 1 1 ${cx + r} ${cy} ` +
    `A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
  );
}

// ---------------------------------------------------------------------------
// Pentagon vertices (for Wu Xing center)
// ---------------------------------------------------------------------------

/**
 * Return 5 points evenly spaced on a circle, starting from 12 o'clock.
 * Order follows the Wu Xing generating (Sheng) cycle:
 *   0: Fire (top/south), 1: Earth (lower-right), 2: Metal (lower-left),
 *   3: Water (upper-left), 4: Wood (upper-right)
 */
export function pentagonVertices(
  cx: number,
  cy: number,
  radius: number,
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * SVG polygon points string from an array of Points.
 */
export function pointsToSvg(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * SVG path for a star (pentagram) connecting every other vertex.
 * Vertices should be in order around the circle.
 */
export function pentagramPath(vertices: Point[]): string {
  // Connect 0→2→4→1→3→0 (every-other-vertex produces the star)
  const order = [0, 2, 4, 1, 3];
  const pts = order.map((i) => vertices[i]);
  return (
    `M ${pts[0].x} ${pts[0].y} ` +
    pts
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(" ") +
    " Z"
  );
}
