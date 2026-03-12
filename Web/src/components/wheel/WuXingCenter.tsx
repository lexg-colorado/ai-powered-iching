/**
 * Wu Xing (Five Elements) pentagram at the center of the wheel.
 *
 * Displays the generating (Sheng) cycle as a pentagon outline
 * and the overcoming (Ke) cycle as a pentagram star.
 */

"use client";

import { memo } from "react";
import { pointsToSvg, pentagramPath } from "../../lib/wheelMath";
import type { ElementPosition } from "../../hooks/useWheelLayout";

interface WuXingCenterProps {
  elements: ElementPosition[];
  center: { x: number; y: number };
  radius: number;
  scale: number;
}

function WuXingCenterInner({ elements, center, radius, scale }: WuXingCenterProps) {
  if (elements.length < 5) return null;

  const fontSize = Math.max(5, 6 * scale);

  return (
    <g className="wu-xing-center">
      {/* Generating (Sheng) cycle — pentagon outline */}
      <polygon
        points={pointsToSvg(elements)}
        fill="none"
        stroke="var(--border)"
        strokeWidth={1}
        opacity={0.5}
      />

      {/* Overcoming (Ke) cycle — pentagram star */}
      <path
        d={pentagramPath(elements)}
        fill="none"
        stroke="var(--border)"
        strokeWidth={0.5}
        opacity={0.3}
        strokeDasharray="3 2"
      />

      {/* Small circle at center */}
      <circle
        cx={center.x}
        cy={center.y}
        r={radius * 0.25}
        fill="none"
        stroke="var(--border)"
        strokeWidth={0.5}
        opacity={0.3}
      />

      {/* Element nodes */}
      {elements.map((el) => {
        // Position label slightly outward from vertex
        const dx = el.x - center.x;
        const dy = el.y - center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const labelOffset = 12 * scale;
        const lx = el.x + (dx / dist) * labelOffset;
        const ly = el.y + (dy / dist) * labelOffset;

        return (
          <g key={el.name}>
            {/* Element dot */}
            <circle
              cx={el.x}
              cy={el.y}
              r={3 * scale}
              fill={el.color}
              opacity={0.8}
            />

            {/* Element name */}
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontFamily="var(--font-inter), Inter, system-ui, sans-serif"
              fill={el.color}
              fontWeight={500}
              opacity={0.9}
            >
              {el.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export const WuXingCenter = memo(WuXingCenterInner);
