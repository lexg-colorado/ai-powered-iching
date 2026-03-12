/**
 * Transformation detail panel for dual-select mode.
 *
 * Shows the XOR transformation between two hexagrams:
 * changing lines, hamming distance, and change mask visualization.
 */

"use client";

import { memo } from "react";
import type { HexagramData } from "../../lib/types";
import type { TransformationInfo } from "../../lib/wheelRelationships";
import { TRIGRAMS, nuclearHexagram, nuclearTrigrams, trigramName } from "../../lib/hexagram";

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

/** Trigram analysis: show upper/lower trigrams for both hexagrams and whether they change */
function TrigramAnalysis({ from, to }: { from: HexagramData; to: HexagramData }) {
  const fromUpper = from.binary.slice(0, 3);
  const fromLower = from.binary.slice(3, 6);
  const toUpper = to.binary.slice(0, 3);
  const toLower = to.binary.slice(3, 6);

  const upperChanged = fromUpper !== toUpper;
  const lowerChanged = fromLower !== toLower;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-heading text-foreground mb-3 border-b border-border pb-1">
        Trigram Analysis
      </h3>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted w-14">Upper:</span>
          <span className="text-yang">{TRIGRAMS[fromUpper]?.name ?? fromUpper}</span>
          <span className="text-muted text-[10px]">({TRIGRAMS[fromUpper]?.attribute})</span>
          <span className="text-muted">→</span>
          <span className="text-yin">{TRIGRAMS[toUpper]?.name ?? toUpper}</span>
          <span className="text-muted text-[10px]">({TRIGRAMS[toUpper]?.attribute})</span>
          <span className={`text-[10px] ml-auto ${upperChanged ? "text-changing" : "text-muted"}`}>
            {upperChanged ? "changes" : "stable"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted w-14">Lower:</span>
          <span className="text-yang">{TRIGRAMS[fromLower]?.name ?? fromLower}</span>
          <span className="text-muted text-[10px]">({TRIGRAMS[fromLower]?.attribute})</span>
          <span className="text-muted">→</span>
          <span className="text-yin">{TRIGRAMS[toLower]?.name ?? toLower}</span>
          <span className="text-muted text-[10px]">({TRIGRAMS[toLower]?.attribute})</span>
          <span className={`text-[10px] ml-auto ${lowerChanged ? "text-changing" : "text-muted"}`}>
            {lowerChanged ? "changes" : "stable"}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Nuclear hexagrams: hidden inner dynamic for source and target */
function NuclearHexagrams({ from, to }: { from: HexagramData; to: HexagramData }) {
  const fromNuclear = nuclearHexagram(from.binary);
  const toNuclear = nuclearHexagram(to.binary);

  const [fromNucLower, fromNucUpper] = nuclearTrigrams(from.binary);
  const [toNucLower, toNucUpper] = nuclearTrigrams(to.binary);

  return (
    <div className="mt-6">
      <h3 className="text-sm font-heading text-foreground mb-3 border-b border-border pb-1">
        Nuclear Hexagrams (Hu Gua)
      </h3>
      <div className="space-y-3 text-xs">
        {/* Source nuclear */}
        <div>
          <div className="text-muted mb-1">Source inner dynamic:</div>
          {fromNuclear ? (
            <div className="flex items-center gap-3 pl-2">
              <MiniGlyph binary={fromNuclear.binary} color="var(--accent-yang)" />
              <div>
                <div className="text-yang font-heading">
                  #{fromNuclear.king_wen} {fromNuclear.name}
                </div>
                <div className="text-muted text-[10px]">
                  {trigramName(fromNucUpper)} over {trigramName(fromNucLower)}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-muted pl-2">—</span>
          )}
        </div>
        {/* Target nuclear */}
        <div>
          <div className="text-muted mb-1">Target inner dynamic:</div>
          {toNuclear ? (
            <div className="flex items-center gap-3 pl-2">
              <MiniGlyph binary={toNuclear.binary} color="var(--accent-yin)" />
              <div>
                <div className="text-yin font-heading">
                  #{toNuclear.king_wen} {toNuclear.name}
                </div>
                <div className="text-muted text-[10px]">
                  {trigramName(toNucUpper)} over {trigramName(toNucLower)}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-muted pl-2">—</span>
          )}
        </div>
        {/* Same nuclear? */}
        {fromNuclear && toNuclear && fromNuclear.king_wen === toNuclear.king_wen && (
          <div className="text-muted italic text-[10px] pl-2">
            Both share the same nuclear hexagram — the hidden dynamic persists through the transformation.
          </div>
        )}
      </div>
    </div>
  );
}

/** Yin/yang balance comparison between source and target */
function YinYangBalance({ from, to }: { from: HexagramData; to: HexagramData }) {
  const count = (binary: string) => {
    let yang = 0;
    for (const b of binary) if (b === "1") yang++;
    return { yang, yin: 6 - yang };
  };

  const fromCount = count(from.binary);
  const toCount = count(to.binary);
  const yangShift = toCount.yang - fromCount.yang;

  const label = (c: { yang: number; yin: number }) => {
    if (c.yang === 6) return "pure yang";
    if (c.yin === 6) return "pure yin";
    if (c.yang === c.yin) return "balanced";
    return c.yang > c.yin ? "yang dominant" : "yin dominant";
  };

  const bar = (yang: number) => (
    <div className="flex h-2 w-full rounded overflow-hidden">
      <div className="bg-yang" style={{ width: `${(yang / 6) * 100}%` }} />
      <div className="bg-yin" style={{ width: `${((6 - yang) / 6) * 100}%` }} />
    </div>
  );

  return (
    <div className="mt-6">
      <h3 className="text-sm font-heading text-foreground mb-3 border-b border-border pb-1">
        Yin/Yang Balance
      </h3>
      <div className="space-y-3 text-xs">
        <div>
          <div className="flex justify-between text-muted mb-1">
            <span>Source</span>
            <span>{fromCount.yang} yang / {fromCount.yin} yin ({label(fromCount)})</span>
          </div>
          {bar(fromCount.yang)}
        </div>
        <div>
          <div className="flex justify-between text-muted mb-1">
            <span>Target</span>
            <span>{toCount.yang} yang / {toCount.yin} yin ({label(toCount)})</span>
          </div>
          {bar(toCount.yang)}
        </div>
        {yangShift !== 0 && (
          <div className="text-muted text-[10px] text-center">
            Shift: {yangShift > 0 ? "+" : ""}{yangShift} yang / {yangShift > 0 ? "" : "+"}{-yangShift} yin
          </div>
        )}
      </div>
    </div>
  );
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

      {/* --- Option A: Trigram Analysis --- */}
      <TrigramAnalysis from={from} to={to} />

      {/* --- Option B: Nuclear Hexagrams --- */}
      <NuclearHexagrams from={from} to={to} />

      {/* --- Option H: Yin/Yang Balance --- */}
      <YinYangBalance from={from} to={to} />
    </div>
  );
}

export const TransformationOverlay = memo(TransformationOverlayInner);
