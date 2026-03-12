/**
 * Main hexagram wheel orchestrator.
 *
 * Renders the SVG with three concentric rings:
 *   - Outer: 64 hexagrams (King Wen sequence)
 *   - Inner: 8 trigrams (Later Heaven arrangement)
 *   - Center: Wu Xing pentagram
 *
 * A Canvas overlay sits on top for particle effects (pointer-events: none).
 * Manages sizing via ResizeObserver and delegates interaction state
 * to the parent via callbacks.
 */

"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useWheelLayout } from "../../hooks/useWheelLayout";
import { OuterRing } from "./OuterRing";
import { InnerRing } from "./InnerRing";
import { WuXingCenter } from "./WuXingCenter";
import { RelationshipArcs } from "./RelationshipArcs";
import { ParticleCanvas, type ParticleCanvasHandle } from "./ParticleCanvas";
import type { HexagramData } from "../../lib/types";
import type { HexagramRelationships } from "../../lib/wheelRelationships";
import type { GlyphState } from "./HexagramGlyph";
import type { HexagramPosition } from "../../hooks/useWheelLayout";

interface HexagramWheelProps {
  hexagrams: HexagramData[];
  /** Map of King Wen number → visual state */
  glyphStates?: Map<number, GlyphState>;
  /** Computed relationships for the selected hexagram */
  relationships?: HexagramRelationships | null;
  /** Wheel rotation in degrees */
  rotation?: number;
  /** Ref to the particle canvas for imperative effects */
  particleRef?: React.RefObject<ParticleCanvasHandle | null>;
  /** Currently highlighted trigram bits */
  highlightedTrigram?: string | null;
  /** Optional viewBox override for zoom-to-selection */
  viewBoxOverride?: string;
  /** Wu Xing element interactivity */
  selectedElement?: string | null;
  hoveredElement?: string | null;
  elementsInteractive?: boolean;
  onElementClick?: (name: string) => void;
  onElementHover?: (name: string | null) => void;
  /** Callbacks */
  onHexagramClick?: (kingWen: number) => void;
  onHexagramHover?: (kingWen: number | null, clientX?: number, clientY?: number) => void;
  onTrigramHover?: (bits: string | null) => void;
  onTrigramClick?: (bits: string) => void;
  /** Pointer events for drag rotation (forwarded from parent) */
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
}

export function HexagramWheel({
  hexagrams,
  glyphStates,
  relationships,
  rotation = 0,
  particleRef,
  highlightedTrigram,
  viewBoxOverride,
  selectedElement,
  hoveredElement,
  elementsInteractive = false,
  onElementClick,
  onElementHover,
  onHexagramClick,
  onHexagramHover,
  onTrigramHover,
  onTrigramClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: HexagramWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 });

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(el);
    // Initial measurement
    setDimensions({
      width: el.clientWidth,
      height: el.clientHeight,
    });

    return () => observer.disconnect();
  }, []);

  const layout = useWheelLayout(dimensions.width, dimensions.height, hexagrams);

  // Build position lookup map for arcs
  const positionMap = useMemo(() => {
    const map = new Map<number, HexagramPosition>();
    for (const pos of layout.hexagrams) {
      map.set(pos.kingWen, pos);
    }
    return map;
  }, [layout.hexagrams]);

  // SVG viewBox: use override for zoom, or default square centered
  const viewBox = viewBoxOverride ?? `0 0 ${layout.size} ${layout.size}`;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center relative"
      style={{ touchAction: "none" }}
    >
      <svg
        viewBox={viewBox}
        width={layout.size}
        height={layout.size}
        className="max-w-full max-h-full"
        style={{ overflow: "visible" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Rotatable group containing the rings */}
        <g
          transform={`rotate(${rotation}, ${layout.center.x}, ${layout.center.y})`}
          style={{ transition: "transform 50ms linear" }}
        >
          {/* Outer ring: 64 hexagrams */}
          <OuterRing
            positions={layout.hexagrams}
            hexagrams={hexagrams}
            radius={layout.outerRadius}
            center={layout.center}
            glyphScale={layout.glyphScale}
            compact={layout.compact}
            glyphStates={glyphStates}
            onHexagramClick={onHexagramClick}
            onHexagramHover={onHexagramHover}
          />

          {/* Inner ring: 8 trigrams */}
          <InnerRing
            positions={layout.trigrams}
            radius={layout.innerRadius}
            center={layout.center}
            scale={layout.glyphScale}
            highlightedTrigram={highlightedTrigram}
            onTrigramHover={onTrigramHover}
            onTrigramClick={onTrigramClick}
          />

          {/* Center: Wu Xing pentagram */}
          <WuXingCenter
            elements={layout.elements}
            center={layout.center}
            radius={layout.centerRadius}
            scale={layout.glyphScale}
            selectedElement={selectedElement}
            hoveredElement={hoveredElement}
            interactive={elementsInteractive}
            onElementClick={onElementClick}
            onElementHover={onElementHover}
          />
        </g>

        {/* Relationship arcs (outside rotatable group so they stay fixed) */}
        <RelationshipArcs
          relationships={relationships ?? null}
          positionMap={positionMap}
          center={layout.center}
          animate={true}
        />
      </svg>

      {/* Canvas overlay for particle effects */}
      <ParticleCanvas
        ref={particleRef}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  );
}
