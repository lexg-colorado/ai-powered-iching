"use client";

import type { LineValue } from "@/lib/types";
import HexagramLine from "./HexagramLine";

interface HexagramDisplayProps {
  lineValues: (LineValue | null)[];
  interactive?: boolean;
  onChange?: (position: number, value: LineValue | null) => void;
  label?: string;
  showLineNumbers?: boolean;
}

/**
 * Renders 6 hexagram lines stacked bottom-to-top (line 1 at bottom, line 6 at top).
 */
export default function HexagramDisplay({
  lineValues,
  interactive = false,
  onChange,
  label,
  showLineNumbers = true,
}: HexagramDisplayProps) {
  // Display top-to-bottom (line 6 first, line 1 last)
  const displayOrder = [6, 5, 4, 3, 2, 1];

  return (
    <div className="flex flex-col gap-1 min-w-[120px] w-full">
      {label && (
        <h3 className="font-heading text-sm font-semibold text-foreground mb-1">
          {label}
        </h3>
      )}
      {displayOrder.map((lineNum) => (
        <HexagramLine
          key={lineNum}
          lineNumber={lineNum}
          value={lineValues[lineNum - 1] ?? null}
          interactive={interactive}
          showLabel={showLineNumbers}
          onChange={
            onChange
              ? (val) => onChange(lineNum, val)
              : undefined
          }
        />
      ))}
    </div>
  );
}
