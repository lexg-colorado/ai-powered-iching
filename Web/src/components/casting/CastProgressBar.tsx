"use client";

import type { LineValue } from "@/lib/types";
import { LINE_INFO } from "@/lib/hexagram";

interface CastProgressBarProps {
  lineValues: (LineValue | null)[];
  currentLine: number;
  isComplete: boolean;
}

export default function CastProgressBar({
  lineValues,
  currentLine,
  isComplete,
}: CastProgressBarProps) {
  // Display top-to-bottom (line 6 first)
  const lines = [6, 5, 4, 3, 2, 1];

  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <span className="font-heading text-xs font-semibold text-foreground mb-1">
        Hexagram
      </span>
      {lines.map((lineNum) => {
        const val = lineValues[lineNum - 1];
        const isCurrent = lineNum === currentLine && !isComplete;
        const isDone = val !== null;

        return (
          <div key={lineNum} className="flex items-center gap-2 h-5">
            <span
              className={`text-xs font-mono w-4 text-right ${
                isCurrent
                  ? "text-yang font-bold"
                  : "text-muted"
              }`}
            >
              {lineNum}
            </span>
            <div className="flex-1">
              {isDone ? (
                <MiniLine value={val} />
              ) : (
                <div
                  className={`h-1.5 rounded-full ${
                    isCurrent
                      ? "bg-yang/40 animate-pulse"
                      : "bg-border"
                  }`}
                />
              )}
            </div>
            {isDone && LINE_INFO[val].isChanging && (
              <span className="text-[9px] text-changing font-bold">
                *
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniLine({ value }: { value: LineValue }) {
  const isYang = value === 7 || value === 9;
  const changing = value === 6 || value === 9;

  const color = changing
    ? isYang
      ? "bg-yang"
      : "bg-yin"
    : "bg-foreground";

  if (isYang) {
    return <div className={`h-2 rounded-sm ${color} animate-fade-in`} />;
  }

  return (
    <div className="flex gap-1.5 animate-fade-in">
      <div className={`flex-1 h-2 rounded-sm ${color}`} />
      <div className={`flex-1 h-2 rounded-sm ${color}`} />
    </div>
  );
}
