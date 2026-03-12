/**
 * Hexagram relationship computations for the wheel visualization.
 *
 * Ports key functions from Python hexagram_lookup.py to TypeScript,
 * plus new functions for the wheel's needs.
 */

import type { HexagramData } from "./types";
import {
  allHexagrams,
  lookupByBinary,
  nuclearHexagram,
  complementHexagram,
} from "./hexagram";

// ---------------------------------------------------------------------------
// Ported from hexagram_lookup.py
// ---------------------------------------------------------------------------

/**
 * Count the number of differing bits (lines) between two 6-bit binary strings.
 * Equivalent to Python's hamming_distance().
 */
export function hammingDistance(a: string, b: string): number {
  let count = 0;
  for (let i = 0; i < 6; i++) {
    if (a[i] !== b[i]) count++;
  }
  return count;
}

/**
 * Determine which line positions (1-6, bottom-to-top) differ between two hexagrams.
 * Returns a sorted ascending array of line numbers.
 * Equivalent to Python's find_transformation().
 */
export function findTransformation(
  fromBinary: string,
  toBinary: string,
): number[] {
  const lines: number[] = [];
  for (let i = 0; i < 6; i++) {
    if (fromBinary[i] !== toBinary[i]) {
      // Binary index 0 = line 6 (top), index 5 = line 1 (bottom)
      lines.push(6 - i);
    }
  }
  return lines.sort((a, b) => a - b);
}

/**
 * Find all hexagrams containing a given trigram.
 * @param trigramBits 3-bit trigram binary (e.g. "111" for Ch'ien)
 * @param position "upper" | "lower" | "any"
 */
export function findByTrigram(
  trigramBits: string,
  position: "upper" | "lower" | "any" = "any",
): HexagramData[] {
  return allHexagrams().filter((h) => {
    const upper = h.binary.slice(0, 3);
    const lower = h.binary.slice(3, 6);
    if (position === "upper") return upper === trigramBits;
    if (position === "lower") return lower === trigramBits;
    return upper === trigramBits || lower === trigramBits;
  });
}

// ---------------------------------------------------------------------------
// New: overturned hexagram (Pang Tong Gua)
// ---------------------------------------------------------------------------

/**
 * The overturned hexagram: reverse the binary string (flip the hexagram upside-down).
 * This is the Pang Tong Gua — the hexagram you get by turning the page upside-down.
 * Not the same as the complement (Zong Gua), which inverts all lines.
 */
export function overturnedHexagram(
  binary: string,
): HexagramData | undefined {
  const reversed = binary.split("").reverse().join("");
  return lookupByBinary(reversed);
}

// ---------------------------------------------------------------------------
// Relationship bundle (computed on selection)
// ---------------------------------------------------------------------------

export interface HexagramRelationships {
  source: HexagramData;
  nuclear: HexagramData | null;
  zongGua: HexagramData | null;
  overturned: HexagramData | null;
}

/**
 * Compute all relationships for a given hexagram.
 */
export function computeRelationships(
  hex: HexagramData,
): HexagramRelationships {
  const nuclear = nuclearHexagram(hex.binary) ?? null;
  const zongGua = complementHexagram(hex.binary) ?? null;
  const overturned = overturnedHexagram(hex.binary) ?? null;

  return { source: hex, nuclear, zongGua, overturned };
}

// ---------------------------------------------------------------------------
// Transformation info (computed on dual-select)
// ---------------------------------------------------------------------------

export interface TransformationInfo {
  from: HexagramData;
  to: HexagramData;
  changingLines: number[];
  distance: number;
  changeMask: string;
}

/**
 * Compute transformation details between two hexagrams.
 */
export function computeTransformation(
  from: HexagramData,
  to: HexagramData,
): TransformationInfo {
  const changingLines = findTransformation(from.binary, to.binary);
  const distance = hammingDistance(from.binary, to.binary);

  // Build change mask: "1" where lines differ
  const maskBits = ["0", "0", "0", "0", "0", "0"];
  for (const line of changingLines) {
    maskBits[6 - line] = "1";
  }

  return {
    from,
    to,
    changingLines,
    distance,
    changeMask: maskBits.join(""),
  };
}

// ---------------------------------------------------------------------------
// New: flip a single line (for pathway mode)
// ---------------------------------------------------------------------------

/**
 * Toggle a single line in a 6-bit binary string.
 * @param binary 6-bit binary string (MSB-first)
 * @param lineNumber 1-indexed bottom-to-top (line 1 = index 5, line 6 = index 0)
 */
export function flipLine(binary: string, lineNumber: number): string {
  const idx = 6 - lineNumber;
  const bits = binary.split("");
  bits[idx] = bits[idx] === "0" ? "1" : "0";
  return bits.join("");
}

// ---------------------------------------------------------------------------
// New: neighbors at Hamming distance (for neighbors mode)
// ---------------------------------------------------------------------------

export interface NeighborEntry {
  hex: HexagramData;
  differingLines: number[];
}

/**
 * Find all hexagrams within a given Hamming distance, grouped by distance.
 * Returns a Map where keys are distances (1..maxDistance) and values are arrays
 * of hexagram + the line positions that differ.
 */
export function findNeighbors(
  binary: string,
  maxDistance: number,
): Map<number, NeighborEntry[]> {
  const result = new Map<number, NeighborEntry[]>();
  for (let d = 1; d <= maxDistance; d++) {
    result.set(d, []);
  }

  for (const h of allHexagrams()) {
    if (h.binary === binary) continue;
    const dist = hammingDistance(binary, h.binary);
    if (dist >= 1 && dist <= maxDistance) {
      const differingLines = findTransformation(binary, h.binary);
      result.get(dist)!.push({ hex: h, differingLines });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// New: trigram pair filter (for trigram filter mode)
// ---------------------------------------------------------------------------

/**
 * Filter hexagrams by upper and/or lower trigram.
 * If only one is provided, returns all 8 hexagrams with that trigram in the given position.
 * If both provided, returns the single hexagram formed by the pair (or empty if not found).
 */
export function filterByTrigramPair(
  upperBits?: string | null,
  lowerBits?: string | null,
): HexagramData[] {
  return allHexagrams().filter((h) => {
    const upper = h.binary.slice(0, 3);
    const lower = h.binary.slice(3, 6);
    if (upperBits && lowerBits) {
      return upper === upperBits && lower === lowerBits;
    }
    if (upperBits) return upper === upperBits;
    if (lowerBits) return lower === lowerBits;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Trigram → hexagram mapping (precomputed for inner ring)
// ---------------------------------------------------------------------------

export interface TrigramMapping {
  bits: string;
  name: string;
  attribute: string;
  asUpper: number[]; // King Wen numbers
  asLower: number[]; // King Wen numbers
}

let _trigramMappings: TrigramMapping[] | null = null;

/**
 * Build a mapping from each of the 8 trigrams to the hexagrams containing them.
 * Cached after first call.
 */
export function getTrigramMappings(): TrigramMapping[] {
  if (_trigramMappings) return _trigramMappings;

  const trigramDefs: Record<string, { name: string; attribute: string }> = {
    "111": { name: "Ch'ien", attribute: "Heaven" },
    "000": { name: "K'un", attribute: "Earth" },
    "001": { name: "Chen", attribute: "Thunder" },
    "010": { name: "K'an", attribute: "Water" },
    "011": { name: "Tui", attribute: "Lake" },
    "100": { name: "Ken", attribute: "Mountain" },
    "101": { name: "Li", attribute: "Fire" },
    "110": { name: "Sun", attribute: "Wind" },
  };

  const hexagrams = allHexagrams();
  const mappings: TrigramMapping[] = [];

  for (const [bits, def] of Object.entries(trigramDefs)) {
    const asUpper: number[] = [];
    const asLower: number[] = [];

    for (const h of hexagrams) {
      if (h.binary.slice(0, 3) === bits) asUpper.push(h.king_wen);
      if (h.binary.slice(3, 6) === bits) asLower.push(h.king_wen);
    }

    mappings.push({ bits, ...def, asUpper, asLower });
  }

  _trigramMappings = mappings;
  return mappings;
}
