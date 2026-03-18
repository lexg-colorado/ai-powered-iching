"use client";

import { useMemo } from "react";
import { ringPosition, arcPath } from "@/lib/wheelMath";

interface MiniWheelProps {
  primaryKingWen: number;
  relatingKingWen?: number;
  size?: number;
}

/**
 * A compact hexagram wheel showing where the primary (and optionally
 * relating) hexagram sits in the King Wen sequence. Used in the
 * reading result page to provide visual context.
 */
export default function MiniWheel({
  primaryKingWen,
  relatingKingWen,
  size = 160,
}: MiniWheelProps) {
  const layout = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const dotR = size * 0.012;
    const highlightR = size * 0.025;

    const positions = Array.from({ length: 64 }, (_, i) =>
      ringPosition(i, 64, cx, cy, radius),
    );

    const primaryIdx = primaryKingWen - 1;
    const relatingIdx = relatingKingWen ? relatingKingWen - 1 : null;

    return { cx, cy, radius, dotR, highlightR, positions, primaryIdx, relatingIdx };
  }, [primaryKingWen, relatingKingWen, size]);

  const { cx, cy, radius, dotR, highlightR, positions, primaryIdx, relatingIdx } = layout;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="flex-shrink-0"
      aria-label={`Hexagram wheel showing #${primaryKingWen}${relatingKingWen ? ` → #${relatingKingWen}` : ""}`}
    >
      {/* Ring outline */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={0.5}
        opacity={0.3}
      />

      {/* 64 dots */}
      {positions.map((pos, i) => {
        const isPrimary = i === primaryIdx;
        const isRelating = i === relatingIdx;
        if (isPrimary || isRelating) return null; // rendered separately on top
        return (
          <circle
            key={i}
            cx={pos.x}
            cy={pos.y}
            r={dotR}
            fill="var(--muted)"
            opacity={0.25}
          />
        );
      })}

      {/* Arc between primary and relating */}
      {relatingIdx !== null && (
        <path
          d={arcPath(
            positions[primaryIdx],
            positions[relatingIdx],
            { x: cx, y: cy },
            0.5,
          )}
          fill="none"
          stroke="var(--color-changing)"
          strokeWidth={1.2}
          opacity={0.5}
          strokeLinecap="round"
        />
      )}

      {/* Primary hexagram — highlighted dot with glow */}
      <circle
        cx={positions[primaryIdx].x}
        cy={positions[primaryIdx].y}
        r={highlightR * 2}
        fill="var(--color-yang)"
        opacity={0.15}
      />
      <circle
        cx={positions[primaryIdx].x}
        cy={positions[primaryIdx].y}
        r={highlightR}
        fill="var(--color-yang)"
      />

      {/* Primary label */}
      <text
        x={cx}
        y={cy - size * 0.03}
        textAnchor="middle"
        fill="var(--color-yang)"
        fontSize={size * 0.075}
        fontWeight="bold"
        fontFamily="var(--font-heading)"
      >
        {primaryKingWen}
      </text>

      {/* Relating hexagram — if present */}
      {relatingIdx !== null && (
        <>
          <circle
            cx={positions[relatingIdx].x}
            cy={positions[relatingIdx].y}
            r={highlightR * 2}
            fill="var(--color-yin)"
            opacity={0.15}
          />
          <circle
            cx={positions[relatingIdx].x}
            cy={positions[relatingIdx].y}
            r={highlightR}
            fill="var(--color-yin)"
          />
          {/* Arrow / relating label */}
          <text
            x={cx}
            y={cy + size * 0.06}
            textAnchor="middle"
            fill="var(--color-yin)"
            fontSize={size * 0.06}
            fontFamily="var(--font-heading)"
          >
            → {relatingKingWen}
          </text>
        </>
      )}
    </svg>
  );
}
