"use client";

import { useState, useCallback, useMemo } from "react";
import type { InputMode, LineValue, TextPassagesResponse } from "@/lib/types";
import {
  buildCastResult,
  isLoaded,
  lookupByNumber,
  type ClientCastResult,
} from "@/lib/hexagram";

export interface BuilderState {
  baseLines: (LineValue | null)[];
  inputMode: InputMode;
  question: string;
  isLoading: boolean;
  reading: { interpretation: string; header: string } | null;
  error: string | null;
}

const INITIAL_LINES: (LineValue | null)[] = [null, null, null, null, null, null];

export function useHexagramBuilder() {
  const [baseLines, setBaseLines] = useState<(LineValue | null)[]>([...INITIAL_LINES]);
  const [inputMode, setInputMode] = useState<InputMode>("cast");
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reading, setReading] = useState<{ interpretation: string; header: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textPassages, setTextPassages] = useState<TextPassagesResponse | null>(null);

  // Compute cast result whenever all 6 lines are set
  const castResult: ClientCastResult | null = useMemo(() => {
    if (baseLines.some((l) => l === null)) return null;
    if (!isLoaded()) return null;
    return buildCastResult(baseLines as number[]);
  }, [baseLines]);

  const isComplete = baseLines.every((l) => l !== null);

  /** Set a single line value (1-indexed position). */
  const setLine = useCallback((position: number, value: LineValue | null) => {
    setBaseLines((prev) => {
      const next = [...prev];
      next[position - 1] = value;
      return next;
    });
    setReading(null);
    setTextPassages(null);
    setError(null);
  }, []);

  /** Toggle a line between stable and changing variants. */
  const toggleChanging = useCallback((position: number) => {
    setBaseLines((prev) => {
      const next = [...prev];
      const val = next[position - 1];
      if (val === null) return next;
      // 7 (young yang) <-> 9 (old yang), 8 (young yin) <-> 6 (old yin)
      if (val === 7) next[position - 1] = 9;
      else if (val === 9) next[position - 1] = 7;
      else if (val === 8) next[position - 1] = 6;
      else if (val === 6) next[position - 1] = 8;
      return next;
    });
    setReading(null);
    setTextPassages(null);
    setError(null);
  }, []);

  /** Set all 6 lines at once (from coin casting or auto-cast). */
  const setAllLines = useCallback((lineValues: LineValue[]) => {
    if (lineValues.length === 6) {
      setBaseLines([...lineValues]);
      setReading(null);
      setTextPassages(null);
      setError(null);
    }
  }, []);

  /** Set lines from a King Wen number. */
  const setFromNumber = useCallback((n: number) => {
    const hex = lookupByNumber(n);
    if (!hex) return;

    // Convert binary to line values (all stable: yang=7, yin=8)
    // Binary is MSB-first: index 0 = line 6, index 5 = line 1
    const lines: LineValue[] = [];
    for (let i = 5; i >= 0; i--) {
      lines.push(hex.binary[i] === "1" ? 7 : 8);
    }
    setBaseLines(lines);
    setReading(null);
    setTextPassages(null);
    setError(null);
  }, []);

  /** Clear everything. */
  const clear = useCallback(() => {
    setBaseLines([...INITIAL_LINES]);
    setQuestion("");
    setReading(null);
    setTextPassages(null);
    setError(null);
  }, []);

  return {
    baseLines,
    inputMode,
    setInputMode,
    question,
    setQuestion,
    isComplete,
    castResult,
    isLoading,
    setIsLoading,
    reading,
    setReading,
    error,
    setError,
    textPassages,
    setTextPassages,
    setLine,
    toggleChanging,
    setAllLines,
    setFromNumber,
    clear,
  };
}
