"use client";

import { useEffect } from "react";
import { useCoinCasting } from "@/hooks/useCoinCasting";
import CoinTray from "./CoinTray";
import CastProgressBar from "./CastProgressBar";
import { linePositionLabel } from "@/lib/casting";
import type { LineValue } from "@/lib/types";

interface CoinCastingPanelProps {
  onCastComplete: (lineValues: LineValue[]) => void;
  onCancel: () => void;
}

export default function CoinCastingPanel({
  onCastComplete,
  onCancel,
}: CoinCastingPanelProps) {
  const casting = useCoinCasting();

  // Start casting on mount
  useEffect(() => {
    if (casting.phase === "idle") {
      casting.startCasting();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-toss when auto-casting and ready
  useEffect(() => {
    if (casting.isAutoCasting && casting.phase === "ready") {
      const timer = setTimeout(() => casting.toss(), 100);
      return () => clearTimeout(timer);
    }
  }, [casting.isAutoCasting, casting.phase, casting.currentLine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent when casting is complete
  useEffect(() => {
    if (casting.isComplete) {
      const vals = casting.lineValues.filter((v): v is LineValue => v !== null);
      if (vals.length === 6) {
        onCastComplete(vals);
      }
    }
  }, [casting.isComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTossing = casting.phase === "tossing";
  const isLanded = casting.phase === "landed";
  const isReady = casting.phase === "ready";

  return (
    <div className="flex flex-col gap-6">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Coin Casting
        </h2>
        <div className="flex gap-2">
          {!casting.isComplete && !casting.isAutoCasting && (
            <button
              onClick={() => casting.autoCastAll()}
              disabled={isTossing}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface border border-border text-muted hover:text-foreground hover:bg-border/50 disabled:opacity-50 transition-colors"
            >
              Auto-Cast All
            </button>
          )}
          <button
            onClick={() => {
              casting.reset();
              onCancel();
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-surface border border-border text-muted hover:text-foreground hover:bg-border/50 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main casting area */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* Progress bar (hexagram building) */}
        <CastProgressBar
          lineValues={casting.lineValues}
          currentLine={casting.currentLine}
          isComplete={casting.isComplete}
        />

        {/* Coin toss area */}
        <div className="flex-1 flex flex-col items-center gap-6">
          <CoinTray
            coins={casting.currentCoins}
            total={casting.currentTotal}
            spinning={isTossing}
            revealed={isLanded || casting.isComplete}
          />

          {/* Toss prompt / action area */}
          {isReady && !casting.isAutoCasting && (
            <button
              onClick={() => casting.toss()}
              className="w-full max-w-xs py-4 px-6 text-center rounded-xl border-2 border-dashed border-border hover:border-yang hover:bg-yang/5 transition-all group"
            >
              <span className="text-sm font-medium text-muted group-hover:text-yang transition-colors">
                Tap to cast {linePositionLabel(casting.currentLine)}
              </span>
            </button>
          )}

          {isTossing && (
            <p className="text-sm text-muted animate-pulse">
              Casting {linePositionLabel(casting.currentLine)}...
            </p>
          )}

          {isLanded && !casting.isAutoCasting && (
            <button
              onClick={() => casting.advance()}
              className="px-6 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              {casting.currentLine < 6 ? "Next Line" : "Complete"}
            </button>
          )}

          {casting.isComplete && (
            <div className="text-center animate-fade-in">
              <p className="text-sm font-medium text-yang">
                Casting complete!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
