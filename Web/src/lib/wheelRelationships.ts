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

// ---------------------------------------------------------------------------
// Wu Xing (Five Elements) relationships
// ---------------------------------------------------------------------------

/** Traditional element-to-trigram mapping */
export const WU_XING_TRIGRAM_MAP: Record<string, string[]> = {
  Fire:  ["101"],              // Li
  Earth: ["000", "100"],       // K'un, Ken
  Metal: ["111", "011"],       // Ch'ien, Tui
  Water: ["010"],              // K'an
  Wood:  ["001", "110"],       // Chen, Sun
};

/** Generating (Sheng) cycle: each element generates the next */
const SHENG_CYCLE = ["Wood", "Fire", "Earth", "Metal", "Water"];

/** Overcoming (Ke) cycle: each element overcomes the one two steps ahead */
// Wood->Earth->Water->Fire->Metal->Wood

export interface ElementRelationships {
  name: string;
  generates: string;
  generatedBy: string;
  overcomes: string;
  overcomeBy: string;
  trigramBits: string[];
  trigramNames: string[];
}

const TRIGRAM_NAME_MAP: Record<string, string> = {
  "111": "Ch'ien", "000": "K'un", "001": "Chen", "010": "K'an",
  "011": "Tui", "100": "Ken", "101": "Li", "110": "Sun",
};

/**
 * Get Wu Xing cycle relationships for a given element.
 */
export function getElementRelationships(name: string): ElementRelationships {
  const idx = SHENG_CYCLE.indexOf(name);
  const bits = WU_XING_TRIGRAM_MAP[name] ?? [];
  return {
    name,
    generates: SHENG_CYCLE[(idx + 1) % 5],
    generatedBy: SHENG_CYCLE[(idx + 4) % 5],
    overcomes: SHENG_CYCLE[(idx + 2) % 5],
    overcomeBy: SHENG_CYCLE[(idx + 3) % 5],
    trigramBits: bits,
    trigramNames: bits.map((b) => TRIGRAM_NAME_MAP[b] ?? b),
  };
}

/**
 * Primary element for each hexagram (King Wen number → element name).
 *
 * Derived from the traditional trigram-to-element mapping with balance-aware
 * tiebreaking: when a hexagram's two trigrams belong to different elements,
 * it is assigned to the less-populated element. This produces a near-equal
 * 13-13-13-13-12 distribution while ensuring every assignment is backed
 * by a genuine trigram association.
 */
const HEXAGRAM_PRIMARY_ELEMENT: Record<number, string> = {
  1: "Metal", 2: "Earth", 3: "Water", 4: "Water", 5: "Water",
  6: "Water", 7: "Water", 8: "Water", 9: "Wood", 10: "Metal",
  11: "Earth", 12: "Earth", 13: "Fire", 14: "Fire", 15: "Earth",
  16: "Earth", 17: "Wood", 18: "Earth", 19: "Earth", 20: "Earth",
  21: "Fire", 22: "Fire", 23: "Earth", 24: "Earth", 25: "Wood",
  26: "Earth", 27: "Earth", 28: "Wood", 29: "Water", 30: "Fire",
  31: "Metal", 32: "Wood", 33: "Metal", 34: "Wood", 35: "Fire",
  36: "Fire", 37: "Fire", 38: "Fire", 39: "Water", 40: "Water",
  41: "Metal", 42: "Wood", 43: "Metal", 44: "Metal", 45: "Metal",
  46: "Wood", 47: "Water", 48: "Water", 49: "Fire", 50: "Fire",
  51: "Wood", 52: "Earth", 53: "Wood", 54: "Metal", 55: "Fire",
  56: "Fire", 57: "Wood", 58: "Metal", 59: "Wood", 60: "Metal",
  61: "Metal", 62: "Wood", 63: "Water", 64: "Water",
};

/**
 * Get all hexagrams whose primary element matches the given element name.
 * Each hexagram belongs to exactly one element (single-assignment).
 */
export function getHexagramsByElement(elementName: string): HexagramData[] {
  return allHexagrams().filter(
    (h) => HEXAGRAM_PRIMARY_ELEMENT[h.king_wen] === elementName,
  );
}

/**
 * Get the primary element for a given hexagram.
 */
export function getElementForHexagram(kingWen: number): string | null {
  return HEXAGRAM_PRIMARY_ELEMENT[kingWen] ?? null;
}

// ---------------------------------------------------------------------------
// Compass mode — Earlier & Later Heaven trigram arrangements
// ---------------------------------------------------------------------------

export interface CompassTrigramInfo {
  bits: string;
  name: string;
  attribute: string;
  direction: string;
  season: string;
  family: string;
  animal: string;
  bodyPart: string;
  element: string;
  role: string;
  oppositeBits: string;
}

/**
 * Earlier Heaven (Fu Xi / Xian Tian) arrangement — ideal/cosmological order.
 * Trigrams are placed in opposing complementary pairs.
 */
const EARLIER_HEAVEN: CompassTrigramInfo[] = [
  { bits: "111", name: "Ch'ien", attribute: "Heaven", direction: "S",  season: "", family: "Father",       animal: "Horse",   bodyPart: "Head",    element: "Metal", role: "Creative force, pure yang", oppositeBits: "000" },
  { bits: "000", name: "K'un",   attribute: "Earth",  direction: "N",  season: "", family: "Mother",       animal: "Ox",      bodyPart: "Belly",   element: "Earth", role: "Receptive force, pure yin", oppositeBits: "111" },
  { bits: "101", name: "Li",     attribute: "Fire",   direction: "E",  season: "", family: "Middle Daughter", animal: "Pheasant", bodyPart: "Eye",    element: "Fire",  role: "Clinging, illumination",   oppositeBits: "010" },
  { bits: "010", name: "K'an",   attribute: "Water",  direction: "W",  season: "", family: "Middle Son",    animal: "Pig",     bodyPart: "Ear",     element: "Water", role: "Abysmal, depth",           oppositeBits: "101" },
  { bits: "011", name: "Tui",    attribute: "Lake",   direction: "SE", season: "", family: "Youngest Daughter", animal: "Sheep", bodyPart: "Mouth",  element: "Metal", role: "Joyous, reflection",       oppositeBits: "100" },
  { bits: "100", name: "Ken",    attribute: "Mountain", direction: "NW", season: "", family: "Youngest Son", animal: "Dog",     bodyPart: "Hand",    element: "Earth", role: "Keeping still, meditation", oppositeBits: "011" },
  { bits: "001", name: "Chen",   attribute: "Thunder", direction: "NE", season: "", family: "Eldest Son",   animal: "Dragon",  bodyPart: "Foot",    element: "Wood",  role: "Arousing, initiation",     oppositeBits: "110" },
  { bits: "110", name: "Sun",    attribute: "Wind",   direction: "SW", season: "", family: "Eldest Daughter", animal: "Fowl",   bodyPart: "Thigh",   element: "Wood",  role: "Gentle, penetration",      oppositeBits: "001" },
];

/**
 * Later Heaven (King Wen / Hou Tian) arrangement — seasonal/practical order.
 * Trigrams follow the cycle of the year and the Wu Xing elements.
 */
const LATER_HEAVEN: CompassTrigramInfo[] = [
  { bits: "101", name: "Li",     attribute: "Fire",     direction: "S",  season: "Summer",         family: "Middle Daughter", animal: "Pheasant", bodyPart: "Eye",   element: "Fire",  role: "Midday, full illumination",   oppositeBits: "010" },
  { bits: "010", name: "K'an",   attribute: "Water",    direction: "N",  season: "Winter",         family: "Middle Son",      animal: "Pig",      bodyPart: "Ear",   element: "Water", role: "Midnight, deep stillness",    oppositeBits: "101" },
  { bits: "001", name: "Chen",   attribute: "Thunder",  direction: "E",  season: "Spring",         family: "Eldest Son",      animal: "Dragon",   bodyPart: "Foot",  element: "Wood",  role: "Sunrise, new beginning",      oppositeBits: "011" },
  { bits: "011", name: "Tui",    attribute: "Lake",     direction: "W",  season: "Autumn",         family: "Youngest Daughter", animal: "Sheep",  bodyPart: "Mouth", element: "Metal", role: "Harvest, joyous gathering",   oppositeBits: "001" },
  { bits: "110", name: "Sun",    attribute: "Wind",     direction: "SE", season: "Late Spring",    family: "Eldest Daughter",  animal: "Fowl",     bodyPart: "Thigh", element: "Wood",  role: "Growth, gentle penetration",  oppositeBits: "111" },
  { bits: "111", name: "Ch'ien", attribute: "Heaven",   direction: "NW", season: "Late Autumn",    family: "Father",           animal: "Horse",    bodyPart: "Head",  element: "Metal", role: "Creative judgment, authority", oppositeBits: "000" },
  { bits: "000", name: "K'un",   attribute: "Earth",    direction: "SW", season: "Late Summer",    family: "Mother",           animal: "Ox",       bodyPart: "Belly", element: "Earth", role: "Nourishment, receptivity",    oppositeBits: "100" },
  { bits: "100", name: "Ken",    attribute: "Mountain", direction: "NE", season: "Late Winter",    family: "Youngest Son",     animal: "Dog",      bodyPart: "Hand",  element: "Earth", role: "Transition, keeping still",   oppositeBits: "000" },
];

export const COMPASS_DATA: {
  earlier: CompassTrigramInfo[];
  later: CompassTrigramInfo[];
} = {
  earlier: EARLIER_HEAVEN,
  later: LATER_HEAVEN,
};

/** The four opposing pair axes (same pairs in both arrangements) */
export const COMPASS_PAIR_AXES = [
  { a: "111", b: "000", label: "Heaven / Earth",  aName: "Ch'ien", bName: "K'un" },
  { a: "101", b: "010", label: "Fire / Water",    aName: "Li",     bName: "K'an" },
  { a: "001", b: "110", label: "Thunder / Wind",  aName: "Chen",   bName: "Sun" },
  { a: "100", b: "011", label: "Mountain / Lake", aName: "Ken",    bName: "Tui" },
] as const;

/**
 * Look up compass info for a trigram in a given arrangement.
 */
export function getCompassTrigram(
  arrangement: "earlier" | "later",
  bits: string,
): CompassTrigramInfo | undefined {
  return COMPASS_DATA[arrangement].find((t) => t.bits === bits);
}
