/**
 * Animated SVG Bézier arcs connecting a selected hexagram to its relationships.
 *
 * Uses stroke-dashoffset animation for a "drawing" effect.
 * Each relationship type has a distinct color from the theme.
 */

"use client";

import { useRef, useEffect, memo } from "react";
import { arcPath } from "../../lib/wheelMath";
import type { Point } from "../../lib/wheelMath";
import type { HexagramRelationships } from "../../lib/wheelRelationships";
import type { HexagramPosition } from "../../hooks/useWheelLayout";

interface RelationshipArcsProps {
  relationships: HexagramRelationships | null;
  /** Position lookup by King Wen number */
  positionMap: Map<number, HexagramPosition>;
  center: Point;
  /** Whether to animate arcs (false = instant) */
  animate?: boolean;
}

interface ArcDef {
  key: string;
  from: number; // King Wen number
  to: number;
  color: string;
  width: number;
  delay: number; // ms delay before animation starts
  dashPattern?: string;
  label: string;
}

function RelationshipArcsInner({
  relationships,
  positionMap,
  center,
  animate = true,
}: RelationshipArcsProps) {
  if (!relationships) return null;

  const sourceKw = relationships.source.king_wen;

  // Build the list of arcs to draw
  const arcs: ArcDef[] = [];

  if (relationships.nuclear && relationships.nuclear.king_wen !== sourceKw) {
    arcs.push({
      key: "nuclear",
      from: sourceKw,
      to: relationships.nuclear.king_wen,
      color: "var(--accent-primary)",
      width: 2,
      delay: 0,
      label: "Nuclear",
    });
  }

  if (relationships.zongGua && relationships.zongGua.king_wen !== sourceKw) {
    // Avoid duplicate arc if zong gua is same as nuclear
    const isDuplicate = arcs.some((a) => a.to === relationships.zongGua!.king_wen);
    if (!isDuplicate) {
      arcs.push({
        key: "zongGua",
        from: sourceKw,
        to: relationships.zongGua.king_wen,
        color: "var(--accent-changing)",
        width: 2,
        delay: 400,
        dashPattern: "6 3",
        label: "Zong Gua",
      });
    }
  }

  if (relationships.overturned && relationships.overturned.king_wen !== sourceKw) {
    const isDuplicate = arcs.some((a) => a.to === relationships.overturned!.king_wen);
    if (!isDuplicate) {
      arcs.push({
        key: "overturned",
        from: sourceKw,
        to: relationships.overturned.king_wen,
        color: "var(--accent-yin)",
        width: 1.5,
        delay: 800,
        dashPattern: "3 3",
        label: "Overturned",
      });
    }
  }

  return (
    <g className="relationship-arcs">
      {arcs.map((arc) => {
        const fromPos = positionMap.get(arc.from);
        const toPos = positionMap.get(arc.to);
        if (!fromPos || !toPos) return null;

        return (
          <AnimatedArc
            key={arc.key}
            from={fromPos}
            to={toPos}
            center={center}
            color={arc.color}
            strokeWidth={arc.width}
            delay={arc.delay}
            dashPattern={arc.dashPattern}
            animate={animate}
            label={arc.label}
          />
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Single animated arc
// ---------------------------------------------------------------------------

interface AnimatedArcProps {
  from: Point;
  to: Point;
  center: Point;
  color: string;
  strokeWidth: number;
  delay: number;
  dashPattern?: string;
  animate: boolean;
  label: string;
}

function AnimatedArc({
  from,
  to,
  center,
  color,
  strokeWidth,
  delay,
  dashPattern,
  animate,
  label,
}: AnimatedArcProps) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path || !animate) return;

    const length = path.getTotalLength();

    // Set initial state: fully hidden
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.style.opacity = "0";

    // Animate after delay
    const timer = setTimeout(() => {
      path.style.opacity = "1";
      path.style.transition = `stroke-dashoffset 600ms ease-out, opacity 200ms ease-in`;
      path.style.strokeDashoffset = "0";
    }, delay);

    return () => {
      clearTimeout(timer);
      if (path) {
        path.style.transition = "none";
        path.style.strokeDashoffset = `${length}`;
        path.style.opacity = "0";
      }
    };
  }, [from, to, delay, animate]);

  const d = arcPath(from, to, center, 0.55);

  return (
    <g>
      {/* Glow effect behind the arc */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        opacity={0.15}
        style={{ filter: "blur(4px)" }}
      />

      {/* Main arc */}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashPattern}
        opacity={animate ? 0 : 1}
      >
        <title>{label}</title>
      </path>

      {/* Destination dot */}
      <circle
        cx={to.x}
        cy={to.y}
        r={4}
        fill={color}
        opacity={0.8}
        style={{
          transition: `opacity 200ms ease-in ${delay + 400}ms`,
        }}
      >
        <title>{label}</title>
      </circle>
    </g>
  );
}

export const RelationshipArcs = memo(RelationshipArcsInner);
