/**
 * Floating tooltip that appears when hovering a hexagram glyph on the wheel.
 *
 * Rendered as a fixed-position DOM overlay (outside SVG) so it scales
 * independently of the wheel zoom level. Shows King Wen number, name,
 * title, and a mini CSS-rendered 6-line glyph.
 */

"use client";

import { memo, useRef, useEffect, useState } from "react";

interface HexagramTooltipProps {
  /** King Wen number */
  kingWen: number;
  /** Hexagram name (e.g. "Ch'ien") */
  name: string;
  /** Hexagram title (e.g. "The Creative") */
  title: string;
  /** 6-bit binary string MSB-first */
  binary: string;
  /** Upper trigram name */
  upperTrigram: string;
  /** Lower trigram name */
  lowerTrigram: string;
  /** Mouse clientX */
  clientX: number;
  /** Mouse clientY */
  clientY: number;
}

const TOOLTIP_OFFSET = 16;
const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT = 130;

function HexagramTooltipInner({
  kingWen,
  name,
  title,
  binary,
  upperTrigram,
  lowerTrigram,
  clientX,
  clientY,
}: HexagramTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Clamp to viewport edges
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = clientX + TOOLTIP_OFFSET;
    let y = clientY + TOOLTIP_OFFSET;

    // Clamp right
    if (x + TOOLTIP_WIDTH > vw - 8) {
      x = clientX - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
    }
    // Clamp bottom
    if (y + TOOLTIP_HEIGHT > vh - 8) {
      y = clientY - TOOLTIP_HEIGHT - TOOLTIP_OFFSET;
    }
    // Clamp left/top
    if (x < 8) x = 8;
    if (y < 8) y = 8;

    setPos({ x, y });
  }, [clientX, clientY]);

  // Mini hexagram glyph — 6 lines rendered as CSS divs
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const isYang = binary[i] === "1";
    lines.push(
      <div key={i} className="flex gap-[2px] justify-center">
        {isYang ? (
          <div className="w-5 h-[3px] bg-foreground rounded-[0.5px]" />
        ) : (
          <>
            <div className="w-[9px] h-[3px] bg-foreground rounded-[0.5px]" />
            <div className="w-[9px] h-[3px] bg-foreground rounded-[0.5px]" />
          </>
        )}
      </div>,
    );
  }

  return (
    <div
      ref={ref}
      className="tooltip-enter"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 50,
        pointerEvents: "none",
        width: TOOLTIP_WIDTH,
      }}
    >
      <div className="bg-surface border border-border rounded-lg shadow-lg px-3 py-2.5">
        {/* Header: number + name */}
        <div className="flex items-start gap-3">
          {/* Mini glyph */}
          <div className="flex flex-col gap-[2px] pt-0.5 shrink-0">
            {lines}
          </div>

          {/* Text */}
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              #{kingWen} {name}
            </div>
            <div className="text-xs text-muted italic truncate">
              {title}
            </div>
          </div>
        </div>

        {/* Trigrams */}
        <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted flex gap-3">
          <span>Upper: {upperTrigram}</span>
          <span>Lower: {lowerTrigram}</span>
        </div>
      </div>
    </div>
  );
}

export const HexagramTooltip = memo(HexagramTooltipInner);
