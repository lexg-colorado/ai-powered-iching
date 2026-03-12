/**
 * Client-side coin casting using Web Crypto API (CSPRNG).
 * Mirrors cast_single_line_auto() from hexagram_lookup.py.
 */

import type { LineValue, TossResult } from "./types";
import { LINE_INFO } from "./hexagram";

/** Timing constants for casting animations (ms). */
export const CASTING_TIMING = {
  spinDuration: 500,
  decelerationDuration: 300,
  landDuration: 200,
  settleDuration: 200,
  totalTossDuration: 1200,
  autoCastTossDuration: 400,
  autoCastPauseBetween: 200,
  lineRevealDuration: 300,
};

/**
 * Cast a single line by tossing three coins with cryptographic randomness.
 * Heads = 3, Tails = 2. Sum produces 6/7/8/9.
 *
 * Uses crypto.getRandomValues() — equivalent to Python's secrets module.
 */
export function castSingleLine(): { coins: ("H" | "T")[]; total: LineValue } {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);

  const coins: ("H" | "T")[] = Array.from(bytes, (b) =>
    b % 2 === 0 ? ("T" as const) : ("H" as const)
  );

  const total = coins.reduce(
    (sum: number, c) => sum + (c === "H" ? 3 : 2),
    0
  ) as unknown as LineValue;

  return { coins, total };
}

/**
 * Cast all 6 lines at once.
 */
export function castAllLines(): {
  coins: ("H" | "T")[][];
  totals: LineValue[];
} {
  const coins: ("H" | "T")[][] = [];
  const totals: LineValue[] = [];

  for (let i = 0; i < 6; i++) {
    const result = castSingleLine();
    coins.push(result.coins);
    totals.push(result.total);
  }

  return { coins, totals };
}

/**
 * Build a TossResult from a single coin toss.
 */
export function buildTossResult(
  lineNumber: number,
  coins: ("H" | "T")[],
  total: LineValue
): TossResult {
  const info = LINE_INFO[total];
  return {
    lineNumber,
    coins,
    total,
    name: info.name,
    isChanging: info.isChanging,
  };
}

/**
 * Get a label for a line position (e.g., "Line 1 (bottom)").
 */
export function linePositionLabel(lineNumber: number): string {
  if (lineNumber === 1) return "Line 1 (bottom)";
  if (lineNumber === 6) return "Line 6 (top)";
  return `Line ${lineNumber}`;
}
