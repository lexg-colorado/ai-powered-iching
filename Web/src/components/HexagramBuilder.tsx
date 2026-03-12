"use client";

import type { LineValue } from "@/lib/types";
import type { ClientCastResult } from "@/lib/hexagram";
import { isChanging as isChangingLine } from "@/lib/hexagram";
import HexagramDisplay from "./HexagramDisplay";
import HexagramNumberInput from "./HexagramNumberInput";
import ChangingCheckbox from "./ChangingCheckbox";

interface HexagramBuilderProps {
  baseLines: (LineValue | null)[];
  castResult: ClientCastResult | null;
  onSetLine: (position: number, value: LineValue | null) => void;
  onToggleChanging: (position: number) => void;
  onSetFromNumber: (n: number) => void;
}

/**
 * Two-column hexagram builder with interactive lines, changing checkboxes,
 * and a computed relating hexagram.
 */
export default function HexagramBuilder({
  baseLines,
  castResult,
  onSetLine,
  onToggleChanging,
  onSetFromNumber,
}: HexagramBuilderProps) {
  // Compute relating hexagram line values
  const relatingLines: (LineValue | null)[] = baseLines.map((val) => {
    if (val === null) return null;
    if (val === 9) return 8; // old yang -> yin
    if (val === 6) return 7; // old yin -> yang
    return val; // stable lines stay
  });

  const hasChanging = baseLines.some(
    (v) => v !== null && isChangingLine(v as LineValue)
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start">
        {/* Base hexagram */}
        <div className="flex-1 min-w-[160px]">
          <HexagramDisplay
            lineValues={baseLines}
            interactive={true}
            onChange={onSetLine}
            label="Base Hexagram"
          />
          <div className="mt-3">
            <HexagramNumberInput
              castResult={castResult}
              onSetNumber={onSetFromNumber}
              label="King Wen #"
            />
          </div>
          {castResult && (
            <p className="mt-2 text-sm text-muted">
              <span className="font-semibold text-foreground">
                #{castResult.primary.king_wen}
              </span>{" "}
              {castResult.primary.name} / {castResult.primary.title}
            </p>
          )}
        </div>

        {/* Changing checkboxes */}
        <div className="flex flex-col gap-1 pt-6">
          {[6, 5, 4, 3, 2, 1].map((lineNum) => (
            <ChangingCheckbox
              key={lineNum}
              lineNumber={lineNum}
              value={baseLines[lineNum - 1]}
              onToggle={() => onToggleChanging(lineNum)}
            />
          ))}
        </div>

        {/* Relating hexagram */}
        {hasChanging && (
          <div className="flex-1 min-w-[160px]">
            <HexagramDisplay
              lineValues={relatingLines}
              interactive={false}
              label="Changed Hexagram"
            />
            {castResult?.relating && (
              <>
                <div className="mt-3">
                  <span className="text-xs text-muted">
                    King Wen #
                  </span>
                  <p className="text-sm font-mono text-foreground">
                    {castResult.relating.king_wen}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">
                  <span className="font-semibold text-foreground">
                    #{castResult.relating.king_wen}
                  </span>{" "}
                  {castResult.relating.name} / {castResult.relating.title}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted space-y-1 mt-2">
        <p>Click a line once for yang, twice for yin, three times for old yang (changing), four times for old yin (changing).</p>
        <p>Use the checkboxes to toggle changing lines, or enter a hexagram number (1-64).</p>
      </div>
    </div>
  );
}
