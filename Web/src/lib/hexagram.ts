/**
 * Client-side hexagram logic — mirrors key functions from hexagram_lookup.py.
 *
 * Hexagrams are 6-bit vectors in GF(2)^6. Binary strings are MSB-first
 * (index 0 = line 6/top, index 5 = line 1/bottom).
 */

import type { HexagramData, LineValue, LineInfo, TrigramInfo } from "./types";

// ---- Trigrams ----

export const TRIGRAMS: Record<string, TrigramInfo> = {
  "111": { name: "Ch'ien", attribute: "Heaven" },
  "000": { name: "K'un", attribute: "Earth" },
  "001": { name: "Chen", attribute: "Thunder" },
  "010": { name: "K'an", attribute: "Water" },
  "011": { name: "Tui", attribute: "Lake" },
  "100": { name: "Ken", attribute: "Mountain" },
  "101": { name: "Li", attribute: "Fire" },
  "110": { name: "Sun", attribute: "Wind" },
};

// ---- Line info ----

export const LINE_INFO: Record<number, LineInfo> = {
  6: { name: "old yin", symbol: "---x---", isChanging: true },
  7: { name: "young yang", symbol: "-------", isChanging: false },
  8: { name: "young yin", symbol: "--- ---", isChanging: false },
  9: { name: "old yang", symbol: "---o---", isChanging: true },
};

export const HEADS_COUNT: Record<number, number> = { 6: 0, 7: 1, 8: 2, 9: 3 };

// ---- Hexagram data cache ----

let _hexagrams: HexagramData[] = [];
let _byNumber: Map<number, HexagramData> = new Map();
let _byBinary: Map<string, HexagramData> = new Map();
let _loaded = false;

export async function loadHexagrams(): Promise<void> {
  if (_loaded) return;

  const res = await fetch("/data/king_wen_sequence.json");
  const data: HexagramData[] = await res.json();

  _hexagrams = data;
  _byNumber = new Map(data.map((h) => [h.king_wen, h]));
  _byBinary = new Map(data.map((h) => [h.binary, h]));
  _loaded = true;
}

export function isLoaded(): boolean {
  return _loaded;
}

export function lookupByNumber(n: number): HexagramData | undefined {
  return _byNumber.get(n);
}

export function lookupByBinary(binary: string): HexagramData | undefined {
  return _byBinary.get(binary);
}

export function allHexagrams(): HexagramData[] {
  return [..._hexagrams];
}

// ---- Binary operations ----

export function xorBinary(a: string, b: string): string {
  return a
    .split("")
    .map((bit, i) => (bit !== b[i] ? "1" : "0"))
    .join("");
}

export function computeChangeMask(changingLines: number[]): string {
  const bits = ["0", "0", "0", "0", "0", "0"];
  for (const line of changingLines) {
    if (line >= 1 && line <= 6) {
      bits[6 - line] = "1";
    }
  }
  return bits.join("");
}

// ---- Trigram operations ----

export function trigramName(bits: string): string {
  const entry = TRIGRAMS[bits];
  return entry ? `${entry.name} (${entry.attribute})` : `Unknown (${bits})`;
}

export function nuclearTrigrams(binary: string): [string, string] {
  // Lower nuclear = lines 2,3,4; Upper nuclear = lines 3,4,5
  // Binary MSB-first: index 0=line6, 1=line5, 2=line4, 3=line3, 4=line2, 5=line1
  // Trigram key is MSB-first (top of trigram first)
  const lowerNuclear = binary[2] + binary[3] + binary[4]; // lines 4,3,2 (top-to-bottom)
  const upperNuclear = binary[1] + binary[2] + binary[3]; // lines 5,4,3 (top-to-bottom)
  return [lowerNuclear, upperNuclear];
}

export function nuclearHexagram(binary: string): HexagramData | undefined {
  const [lower, upper] = nuclearTrigrams(binary);
  const nuclearBinary = upper + lower;
  return _byBinary.get(nuclearBinary);
}

export function complementHexagram(binary: string): HexagramData | undefined {
  const inverted = binary
    .split("")
    .map((b) => (b === "0" ? "1" : "0"))
    .join("");
  return _byBinary.get(inverted);
}

// ---- Cast result building ----

export interface ClientCastResult {
  lineValues: number[];
  primary: HexagramData;
  changingLines: number[];
  relating: HexagramData | null;
  changeMask: string;
  nuclear: HexagramData | null;
  zongGua: HexagramData | null;
}

/**
 * Build a cast result from 6 line values (each 6/7/8/9), bottom to top.
 * Mirrors build_cast_result() from hexagram_lookup.py.
 */
export function buildCastResult(lineValues: number[]): ClientCastResult | null {
  if (lineValues.length !== 6) return null;
  if (!lineValues.every((v) => [6, 7, 8, 9].includes(v))) return null;

  const primaryBits: string[] = [];
  const changingLines: number[] = [];

  for (let lineNum = 1; lineNum <= 6; lineNum++) {
    const val = lineValues[lineNum - 1];
    if (val === 6) {
      // old yin: currently yin, will change to yang
      primaryBits.push("0");
      changingLines.push(lineNum);
    } else if (val === 7) {
      // young yang: stable yang
      primaryBits.push("1");
    } else if (val === 8) {
      // young yin: stable yin
      primaryBits.push("0");
    } else if (val === 9) {
      // old yang: currently yang, will change to yin
      primaryBits.push("1");
      changingLines.push(lineNum);
    }
  }

  // Binary string: MSB = line 6, LSB = line 1
  const primaryBinary = [...primaryBits].reverse().join("");
  const primary = _byBinary.get(primaryBinary);
  if (!primary) return null;

  let relating: HexagramData | null = null;
  let mask = "000000";

  if (changingLines.length > 0) {
    mask = computeChangeMask(changingLines);
    const relatingBinary = xorBinary(primaryBinary, mask);
    relating = _byBinary.get(relatingBinary) ?? null;
  }

  const nuclear = nuclearHexagram(primaryBinary) ?? null;
  const zongGua = complementHexagram(primaryBinary) ?? null;

  return {
    lineValues,
    primary,
    changingLines,
    relating,
    changeMask: mask,
    nuclear,
    zongGua,
  };
}

/**
 * Convert a line value to its binary bit (yang=1, yin=0).
 */
export function lineValueToBit(val: LineValue): "0" | "1" {
  return val === 7 || val === 9 ? "1" : "0";
}

/**
 * Check if a line value is yang (solid).
 */
export function isYang(val: LineValue): boolean {
  return val === 7 || val === 9;
}

/**
 * Check if a line value represents a changing line.
 */
export function isChanging(val: LineValue): boolean {
  return val === 6 || val === 9;
}
