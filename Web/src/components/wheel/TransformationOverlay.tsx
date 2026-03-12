/**
 * Transformation detail panel for dual-select mode.
 *
 * Shows the XOR transformation between two hexagrams:
 * changing lines, hamming distance, and change mask visualization.
 */

"use client";

import { memo } from "react";
import type { TransformationInfo } from "../../lib/wheelRelationships";

interface TransformationOverlayProps {
  info: TransformationInfo;
  onClose: () => void;
}

/** Render a mini 6-line hexagram glyph inline */
function MiniGlyph({
  binary,
  changeMask,
  color,
}: {
  binary: string;
  changeMask?: string;
  color: string;
}) {
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const isYang = binary[i] === "1";
    const isChanging = changeMask ? changeMask[i] === "1" : false;
    const lineColor = isChanging ? "var(--accent-changing)" : color;

    if (isYang) {
      lines.push(
        <div
          key={i}
          className="h-[3px] rounded-sm"
          style={{ backgroundColor: lineColor, width: "100%" }}
        />,
      );
    } else {
      lines.push(
        <div key={i} className="flex gap-1" style={{ width: "100%" }}>
          <div
            className="h-[3px] flex-1 rounded-sm"
            style={{ backgroundColor: lineColor }}
          />
          <div
            className="h-[3px] flex-1 rounded-sm"
            style={{ backgroundColor: lineColor }}
          />
        </div>,
      );
    }
  }
  return <div className="flex flex-col gap-[3px] w-10">{lines}</div>;
}

function TransformationOverlayInner({
  info,
  onClose,
}: TransformationOverlayProps) {
  const { from, to, changingLines, distance, changeMask } = info;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading text-foreground">Transformation</h2>
        <button
          onClick={onClose}
          className="text-muted hover:text-foreground text-lg"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Source and target hexagrams */}
      <div className="flex items-center gap-4 mb-6">
        {/* Source */}
        <div className="flex-1 text-center">
          <MiniGlyph
            binary={from.binary}
            changeMask={changeMask}
            color="var(--accent-yang)"
          />
          <div className="mt-2 text-sm font-heading text-yang">
            #{from.king_wen}
          </div>
          <div className="text-xs text-muted">{from.name}</div>
          <div className="text-xs text-muted italic">{from.title}</div>
        </div>

        {/* Arrow */}
        <div className="text-muted text-xl">→</div>

        {/* Target */}
        <div className="flex-1 text-center">
          <MiniGlyph
            binary={to.binary}
            changeMask={changeMask}
            color="var(--accent-yin)"
          />
          <div className="mt-2 text-sm font-heading text-yin">
            #{to.king_wen}
          </div>
          <div className="text-xs text-muted">{to.name}</div>
          <div className="text-xs text-muted italic">{to.title}</div>
        </div>
      </div>

      {/* Transformation details */}
      <h3 className="text-sm font-heading text-foreground mb-3 border-b border-border pb-1">
        XOR Transformation
      </h3>

      <div className="space-y-3 text-sm">
        {/* Hamming distance */}
        <div>
          <span className="text-muted">Hamming Distance: </span>
          <span className="font-mono text-foreground">{distance}</span>
          <span className="text-muted text-xs ml-1">
            ({distance === 1 ? "1 line" : `${distance} lines`} differ)
          </span>
        </div>

        {/* Changing lines */}
        <div>
          <span className="text-muted">Changing Lines: </span>
          <span className="font-mono text-changing">
            {changingLines.length > 0
              ? changingLines.join(", ")
              : "None (identical)"}
          </span>
        </div>

        {/* Change mask */}
        <div>
          <span className="text-muted">Change Mask: </span>
          <span className="font-mono text-foreground">{changeMask}</span>
        </div>

        {/* Binary comparison */}
        <div className="mt-4 p-3 rounded-md bg-background border border-border">
          <div className="font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Source:</span>
              <span className="text-yang">{from.binary}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Target:</span>
              <span className="text-yin">{to.binary}</span>
            </div>
            <div className="border-t border-border my-1" />
            <div className="flex justify-between">
              <span className="text-muted">XOR:</span>
              <span className="text-changing">{changeMask}</span>
            </div>
          </div>
        </div>

        {/* Line-by-line breakdown */}
        {changingLines.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs text-muted mb-2">Line Changes (bottom → top)</h4>
            <div className="space-y-1">
              {changingLines.map((line) => {
                const idx = 6 - line; // binary index
                const fromBit = from.binary[idx];
                const toBit = to.binary[idx];
                const fromLabel = fromBit === "1" ? "Yang ━━" : "Yin ━ ━";
                const toLabel = toBit === "1" ? "Yang ━━" : "Yin ━ ━";
                return (
                  <div
                    key={line}
                    className="flex items-center gap-2 text-xs font-mono"
                  >
                    <span className="text-muted w-12">Line {line}:</span>
                    <span className="text-yang">{fromLabel}</span>
                    <span className="text-muted">→</span>
                    <span className="text-yin">{toLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const TransformationOverlay = memo(TransformationOverlayInner);
