/**
 * Wu Xing (Five Elements) pentagram at the center of the wheel.
 *
 * Displays the generating (Sheng) cycle as a pentagon outline
 * and the overcoming (Ke) cycle as a pentagram star.
 *
 * When in "elements" mode, supports click/hover interactivity
 * to highlight selected elements and their cycle relationships.
 */

"use client";

import { memo, useCallback } from "react";
import { pointsToSvg, pentagramPath } from "../../lib/wheelMath";
import type { ElementPosition } from "../../hooks/useWheelLayout";

interface WuXingCenterProps {
  elements: ElementPosition[];
  center: { x: number; y: number };
  radius: number;
  scale: number;
  /** Currently selected element name (elements mode) */
  selectedElement?: string | null;
  /** Currently hovered element name (elements mode) */
  hoveredElement?: string | null;
  /** Whether element interactivity is enabled */
  interactive?: boolean;
  onElementClick?: (name: string) => void;
  onElementHover?: (name: string | null) => void;
}

/** Wu Xing generating (Sheng) cycle order */
const SHENG_CYCLE = ["Wood", "Fire", "Earth", "Metal", "Water"];

/** Get the generating and overcoming relationships for an element */
function getElementCycleIndices(name: string): { generates: string; generatedBy: string; overcomes: string; overcomeBy: string } {
  const idx = SHENG_CYCLE.indexOf(name);
  if (idx === -1) return { generates: "", generatedBy: "", overcomes: "", overcomeBy: "" };
  return {
    generates: SHENG_CYCLE[(idx + 1) % 5],
    generatedBy: SHENG_CYCLE[(idx + 4) % 5],
    overcomes: SHENG_CYCLE[(idx + 2) % 5],
    overcomeBy: SHENG_CYCLE[(idx + 3) % 5],
  };
}

function WuXingCenterInner({
  elements,
  center,
  radius,
  scale,
  selectedElement,
  hoveredElement,
  interactive = false,
  onElementClick,
  onElementHover,
}: WuXingCenterProps) {
  if (elements.length < 5) return null;

  const fontSize = Math.max(7, 8 * scale);
  const activeElement = selectedElement || hoveredElement;
  const cycleInfo = activeElement ? getElementCycleIndices(activeElement) : null;

  const handleClick = useCallback(
    (name: string) => {
      if (interactive && onElementClick) onElementClick(name);
    },
    [interactive, onElementClick],
  );

  const handlePointerEnter = useCallback(
    (name: string) => {
      if (interactive && onElementHover) onElementHover(name);
    },
    [interactive, onElementHover],
  );

  const handlePointerLeave = useCallback(() => {
    if (interactive && onElementHover) onElementHover(null);
  }, [interactive, onElementHover]);

  // Build element lookup by name for cycle edge highlighting
  const elByName = new Map(elements.map((el) => [el.name, el]));

  // Determine which generating (pentagon) edges to highlight
  const highlightedShengEdges: Array<[ElementPosition, ElementPosition]> = [];
  const highlightedKeEdges: Array<[ElementPosition, ElementPosition]> = [];
  if (activeElement && cycleInfo) {
    // Sheng: generatedBy → active, active → generates
    const fromGen = elByName.get(cycleInfo.generatedBy);
    const toGen = elByName.get(cycleInfo.generates);
    const self = elByName.get(activeElement);
    if (fromGen && self) highlightedShengEdges.push([fromGen, self]);
    if (self && toGen) highlightedShengEdges.push([self, toGen]);
    // Ke: overcomeBy → active, active → overcomes
    const fromKe = elByName.get(cycleInfo.overcomeBy);
    const toKe = elByName.get(cycleInfo.overcomes);
    if (fromKe && self) highlightedKeEdges.push([fromKe, self]);
    if (self && toKe) highlightedKeEdges.push([self, toKe]);
  }

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

      {/* Highlighted Sheng cycle edges */}
      {highlightedShengEdges.map(([a, b], i) => (
        <line
          key={`sheng-${i}`}
          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={elByName.get(activeElement!)?.color ?? "var(--accent)"}
          strokeWidth={2 * scale}
          opacity={0.8}
        >
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </line>
      ))}

      {/* Highlighted Ke cycle edges */}
      {highlightedKeEdges.map(([a, b], i) => (
        <line
          key={`ke-${i}`}
          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={elByName.get(activeElement!)?.color ?? "var(--accent)"}
          strokeWidth={1.5 * scale}
          opacity={0.5}
          strokeDasharray="4 2"
        >
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
        </line>
      ))}

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
        const labelOffset = 14 * scale;
        const lx = el.x + (dx / dist) * labelOffset;
        const ly = el.y + (dy / dist) * labelOffset;

        const isActive = activeElement === el.name;
        const isRelated = cycleInfo
          ? [cycleInfo.generates, cycleInfo.generatedBy, cycleInfo.overcomes, cycleInfo.overcomeBy].includes(el.name)
          : false;
        const isDimmed = interactive && activeElement && !isActive && !isRelated;
        const dotRadius = isActive ? 6 * scale : 5 * scale;

        return (
          <g
            key={el.name}
            onClick={() => handleClick(el.name)}
            onPointerEnter={() => handlePointerEnter(el.name)}
            onPointerLeave={handlePointerLeave}
            style={{ cursor: interactive ? "pointer" : "default" }}
          >
            {/* Hover/selection hit area */}
            <circle
              cx={el.x}
              cy={el.y}
              r={10 * scale}
              fill="transparent"
            />

            {/* Active glow ring */}
            {isActive && (
              <circle
                cx={el.x}
                cy={el.y}
                r={8 * scale}
                fill="none"
                stroke={el.color}
                strokeWidth={1.5}
                opacity={0.5}
              >
                <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Element dot */}
            <circle
              cx={el.x}
              cy={el.y}
              r={dotRadius}
              fill={el.color}
              opacity={isDimmed ? 0.3 : 0.9}
              style={{ transition: "r 200ms ease, opacity 200ms ease" }}
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
              fontWeight={isActive ? 700 : 500}
              opacity={isDimmed ? 0.3 : 0.9}
              style={{ transition: "opacity 200ms ease" }}
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
