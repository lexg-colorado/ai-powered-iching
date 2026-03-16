"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { loadHexagrams } from "@/lib/hexagram";
import { getReadingStream, getTextPassages } from "@/lib/api";
import { useHexagramBuilder } from "@/hooks/useHexagramBuilder";
import CastModeSelector from "@/components/CastModeSelector";
import CoinCastingPanel from "@/components/casting/CoinCastingPanel";
import HexagramBuilder from "@/components/HexagramBuilder";
import HexagramNumberInput from "@/components/HexagramNumberInput";
import HexagramDisplay from "@/components/HexagramDisplay";
import ReadingResult from "@/components/ReadingResult";
import GhostThinkingOverlay from "@/components/GhostThinkingOverlay";
import TextPassagesResult from "@/components/TextPassagesResult";
import type { LineValue } from "@/lib/types";

export default function Home() {
  const builder = useHexagramBuilder();
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load hexagram data on mount
  useEffect(() => {
    loadHexagrams().then(() => setDataLoaded(true));
  }, []);

  // Accumulate streaming tokens in a ref, flush to state via rAF
  const streamTextRef = useRef("");
  const rafRef = useRef<number | null>(null);

  // Thinking state
  const thinkingTextRef = useRef("");
  const thinkingRafRef = useRef<number | null>(null);
  const [thinkingText, setThinkingText] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const flushThinkingText = useCallback(() => {
    setThinkingText(thinkingTextRef.current);
    thinkingRafRef.current = null;
  }, []);

  const flushStreamText = useCallback(() => {
    const text = streamTextRef.current;
    builder.setReading((prev) =>
      prev ? { ...prev, interpretation: text } : { interpretation: text, header: "" }
    );
    rafRef.current = null;
  }, [builder]);

  async function handleGetReading() {
    if (!builder.isComplete || !builder.castResult) return;

    builder.setIsLoading(true);
    builder.setError(null);
    streamTextRef.current = "";
    thinkingTextRef.current = "";
    setThinkingText("");
    setIsThinking(false);

    // Show reading view immediately with empty interpretation
    builder.setReading({ interpretation: "", header: "" });

    try {
      await getReadingStream(
        {
          line_values: builder.castResult.lineValues,
          question: builder.question || null,
        },
        {
          onMeta: (data) => {
            builder.setReading({ interpretation: "", header: data.header });
          },
          onThinking: (text) => {
            setIsThinking(true);
            thinkingTextRef.current += text;
            if (thinkingRafRef.current === null) {
              thinkingRafRef.current = requestAnimationFrame(flushThinkingText);
            }
          },
          onThinkingDone: () => {
            if (thinkingRafRef.current !== null) {
              cancelAnimationFrame(thinkingRafRef.current);
            }
            flushThinkingText();
            setIsThinking(false);
          },
          onToken: (text) => {
            streamTextRef.current += text;
            // Batch UI updates to animation frames to avoid excessive re-renders
            if (rafRef.current === null) {
              rafRef.current = requestAnimationFrame(flushStreamText);
            }
          },
          onDone: () => {
            // Final flush to ensure all text is rendered
            if (rafRef.current !== null) {
              cancelAnimationFrame(rafRef.current);
            }
            flushStreamText();
            setIsThinking(false);
            builder.setIsLoading(false);
          },
          onError: (message) => {
            builder.setError(message);
            builder.setReading(null);
            builder.setIsLoading(false);
            setIsThinking(false);
          },
        },
      );
    } catch (err) {
      builder.setError(
        err instanceof Error ? err.message : "Failed to get reading"
      );
      builder.setReading(null);
      builder.setIsLoading(false);
    }
  }

  async function handleGetText() {
    if (!builder.isComplete || !builder.castResult) return;

    builder.setIsLoading(true);
    builder.setError(null);

    try {
      const response = await getTextPassages(
        builder.castResult.primary.king_wen,
        builder.castResult.changingLines.length > 0
          ? builder.castResult.changingLines
          : undefined,
      );
      builder.setTextPassages(response);
    } catch (err) {
      builder.setError(
        err instanceof Error ? err.message : "Failed to get text passages"
      );
    } finally {
      builder.setIsLoading(false);
    }
  }

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading hexagram data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GhostThinkingOverlay isVisible={isThinking} thinkingText={thinkingText} />
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                I Ching Divination
              </h1>
              <p className="font-heading text-base italic text-muted mt-1">
                Cast hexagrams and consult the oracle
              </p>
            </div>
            <Link
              href="/wheel"
              className="text-sm text-muted hover:text-foreground transition-colors mt-2"
            >
              Explore the Wheel →
            </Link>
          </div>
        </header>

        {/* Show reading if we have one */}
        {builder.reading && builder.castResult ? (
          <ReadingResult
            castResult={builder.castResult}
            interpretation={builder.reading.interpretation}
            question={builder.question || undefined}
            onNewConsultation={builder.clear}
            isStreaming={builder.isLoading}
          />
        ) : builder.textPassages ? (
          <TextPassagesResult
            data={builder.textPassages}
            onNewConsultation={builder.clear}
          />
        ) : (
          <div className="space-y-6">
            {/* Question input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Question (optional)
              </label>
              <input
                type="text"
                value={builder.question}
                onChange={(e) => builder.setQuestion(e.target.value)}
                placeholder="What would you like to ask the oracle?"
                className="w-full px-4 py-2.5 text-sm border border-border rounded-lg bg-surface placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-yang/40 focus:border-yang"
              />
            </div>

            {/* Mode selector */}
            <CastModeSelector
              activeMode={builder.inputMode}
              onModeChange={builder.setInputMode}
              disabled={builder.isLoading}
            />

            {/* Input area based on mode */}
            <div className="border border-border rounded-xl p-4 sm:p-6 bg-surface">
              {builder.inputMode === "cast" && (
                <CoinCastingPanel
                  onCastComplete={(vals) =>
                    builder.setAllLines(vals as LineValue[])
                  }
                  onCancel={builder.clear}
                />
              )}

              {builder.inputMode === "manual" && (
                <HexagramBuilder
                  baseLines={builder.baseLines}
                  castResult={builder.castResult}
                  onSetLine={builder.setLine}
                  onToggleChanging={builder.toggleChanging}
                  onSetFromNumber={builder.setFromNumber}
                />
              )}

              {builder.inputMode === "number" && (
                <div className="flex flex-col items-center gap-4">
                  <HexagramNumberInput
                    castResult={builder.castResult}
                    onSetNumber={builder.setFromNumber}
                    label="Enter hexagram number (1-64)"
                  />
                  <HexagramDisplay
                    lineValues={builder.baseLines}
                    interactive={false}
                    label=""
                  />
                  {builder.castResult && (
                    <p className="text-sm text-muted">
                      #{builder.castResult.primary.king_wen}{" "}
                      {builder.castResult.primary.name} /{" "}
                      {builder.castResult.primary.title}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    Note: Number entry creates stable lines only. Use Cast or
                    Manual mode to set changing lines.
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGetReading}
                disabled={!builder.isComplete || builder.isLoading}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {builder.isLoading ? "Loading..." : "Get Reading"}
              </button>
              <button
                onClick={handleGetText}
                disabled={!builder.isComplete || builder.isLoading}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border-2 border-yang text-yang hover:bg-yang/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Get Text
              </button>
              <button
                onClick={builder.clear}
                disabled={builder.isLoading}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-surface disabled:opacity-50 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Error display */}
            {builder.error && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                {builder.error}
              </div>
            )}

            {/* Cast summary (when complete but no reading yet) */}
            {builder.isComplete && builder.castResult && (
              <div className="p-4 rounded-lg bg-surface border border-border">
                <h3 className="font-heading text-base font-semibold text-foreground mb-2">
                  Cast Summary
                </h3>
                <p className="text-sm text-muted">
                  Primary: #{builder.castResult.primary.king_wen}{" "}
                  {builder.castResult.primary.name} /{" "}
                  {builder.castResult.primary.title}
                </p>
                {builder.castResult.relating && (
                  <p className="text-sm text-muted">
                    Relating: #{builder.castResult.relating.king_wen}{" "}
                    {builder.castResult.relating.name} /{" "}
                    {builder.castResult.relating.title}
                  </p>
                )}
                {builder.castResult.changingLines.length > 0 && (
                  <p className="text-sm text-muted">
                    Changing lines:{" "}
                    {builder.castResult.changingLines.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
