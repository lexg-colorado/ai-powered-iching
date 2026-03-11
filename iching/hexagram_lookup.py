"""Hexagram lookup module for I Ching knowledge enrichment.

Merges the binary representations (combinatorial ordering) with the
King Wen sequence (traditional ordering) to provide multi-format
lookup, query expansion, hexagram detection, and change mechanics.

Change mechanics: hexagrams form GF(2)^6 — a 6-dimensional binary
vector space where transformation = XOR with a change mask.
"""

from __future__ import annotations
import json
import os
import re
import secrets
from dataclasses import dataclass


# The eight trigrams: 3-bit binary -> (name, attribute)
TRIGRAMS: dict[str, tuple[str, str]] = {
    "111": ("Ch'ien", "Heaven"),
    "000": ("K'un", "Earth"),
    "001": ("Chen", "Thunder"),
    "010": ("K'an", "Water"),
    "011": ("Tui", "Lake"),
    "100": ("Ken", "Mountain"),
    "101": ("Li", "Fire"),
    "110": ("Sun", "Wind"),
}


@dataclass
class HexagramInfo:
    king_wen: int
    name: str
    title: str
    binary: str
    upper_trigram: str
    lower_trigram: str

    @property
    def aliases(self) -> list[str]:
        """All searchable representations of this hexagram."""
        return [
            str(self.king_wen),
            self.name,
            self.title,
            self.binary,
            self.upper_trigram.split("(")[0].strip(),
            self.lower_trigram.split("(")[0].strip(),
        ]


@dataclass
class CastResult:
    """Result of a divination casting."""
    line_values: list[int]       # 6 values, each 6/7/8/9, bottom to top
    primary: HexagramInfo        # the initial hexagram
    changing_lines: list[int]    # 1-indexed positions of moving lines
    relating: HexagramInfo | None  # the resulting hexagram (None if no changes)
    change_mask: str             # 6-bit mask showing which lines change
    nuclear: HexagramInfo | None  # nuclear (mutual) hexagram of the primary


# Module-level cache
_hexagrams: list[HexagramInfo] = []
_by_number: dict[int, HexagramInfo] = {}
_by_binary: dict[str, HexagramInfo] = {}
_by_name: dict[str, HexagramInfo] = {}
_loaded = False


def _load():
    """Load hexagram data from the King Wen sequence JSON file."""
    global _hexagrams, _by_number, _by_binary, _by_name, _loaded
    if _loaded:
        return

    data_path = os.path.join(
        os.path.dirname(__file__),
        "Data", "king_wen_sequence.json"
    )

    with open(data_path, "r") as f:
        raw = json.load(f)

    for entry in raw:
        info = HexagramInfo(
            king_wen=entry["king_wen"],
            name=entry["name"],
            title=entry["title"],
            binary=entry["binary"],
            upper_trigram=entry["upper_trigram"],
            lower_trigram=entry["lower_trigram"],
        )
        _hexagrams.append(info)
        _by_number[info.king_wen] = info
        _by_binary[info.binary] = info
        _by_name[info.name.lower()] = info
        _by_name[info.title.lower()] = info

    _loaded = True


def lookup_by_number(n: int) -> HexagramInfo | None:
    """Look up a hexagram by its King Wen sequence number (1-64)."""
    _load()
    return _by_number.get(n)


def lookup_by_name(name: str) -> HexagramInfo | None:
    """Look up a hexagram by its traditional or English name (case-insensitive)."""
    _load()
    return _by_name.get(name.lower())


def lookup_by_binary(binary: str) -> HexagramInfo | None:
    """Look up a hexagram by its 6-bit binary representation."""
    _load()
    return _by_binary.get(binary)


def all_hexagrams() -> list[HexagramInfo]:
    """Return all 64 hexagrams in King Wen order."""
    _load()
    return list(_hexagrams)


# ---- Transformation Engine (Change Mechanics) ----

def _xor_binary(a: str, b: str) -> str:
    """XOR two 6-bit binary strings."""
    return "".join("1" if x != y else "0" for x, y in zip(a, b))


def compute_change_mask(changing_lines: list[int]) -> str:
    """Convert a list of changing line positions (1-6, bottom to top) to a 6-bit mask.

    Line 1 = bottom, Line 6 = top. Output is MSB-first (index 0 = line 6)
    to match the binary string format used in HexagramInfo.
    """
    bits = ['0'] * 6
    for line in changing_lines:
        if 1 <= line <= 6:
            bits[6 - line] = '1'  # line 6 -> index 0, line 1 -> index 5
    return ''.join(bits)


def transform(binary: str, changing_lines: list[int]) -> HexagramInfo | None:
    """Apply changing lines to a hexagram and return the relating hexagram.

    Uses XOR: relating = primary XOR change_mask.
    """
    _load()
    mask = compute_change_mask(changing_lines)
    result_binary = _xor_binary(binary, mask)
    return _by_binary.get(result_binary)


def complement(binary: str) -> HexagramInfo | None:
    """Return the complement hexagram (all lines inverted / bitwise NOT)."""
    _load()
    inverted = "".join("1" if b == "0" else "0" for b in binary)
    return _by_binary.get(inverted)


def find_transformation(from_hex: HexagramInfo, to_hex: HexagramInfo) -> list[int]:
    """Find which lines must change to transform one hexagram into another.

    Returns a list of 1-indexed line positions.
    """
    changing = []
    for i, (a, b) in enumerate(zip(from_hex.binary, to_hex.binary)):
        if a != b:
            # binary string is MSB-first: index 0 = line 6, index 5 = line 1
            changing.append(6 - i)
    return sorted(changing)


def hamming_distance(h1: HexagramInfo, h2: HexagramInfo) -> int:
    """Count the number of differing lines between two hexagrams."""
    return sum(a != b for a, b in zip(h1.binary, h2.binary))


def nearby_hexagrams(binary: str, max_distance: int = 2) -> list[tuple[HexagramInfo, int]]:
    """Find hexagrams within a given Hamming distance.

    Returns a list of (hexagram, distance) tuples sorted by distance.
    """
    _load()
    results = []
    for info in _hexagrams:
        dist = sum(a != b for a, b in zip(binary, info.binary))
        if 0 < dist <= max_distance:
            results.append((info, dist))
    results.sort(key=lambda x: (x[1], x[0].king_wen))
    return results


# ---- Trigram Operations ----

def trigram_name(bits: str) -> str:
    """Map a 3-bit string to its trigram name and attribute."""
    entry = TRIGRAMS.get(bits)
    if entry:
        return f"{entry[0]} ({entry[1]})"
    return f"Unknown ({bits})"


def nuclear_trigrams(binary: str) -> tuple[str, str]:
    """Extract nuclear (inner) trigrams from a hexagram's binary representation.

    Lower nuclear = lines 2-3-4, Upper nuclear = lines 3-4-5.
    Binary string is MSB-first: index 0=line6, 1=line5, 2=line4, 3=line3, 4=line2, 5=line1.
    """
    # line N is at index (6 - N)
    lower_nuclear = binary[4] + binary[3] + binary[2]  # lines 2,3,4
    upper_nuclear = binary[3] + binary[2] + binary[1]  # lines 3,4,5
    return lower_nuclear, upper_nuclear


def nuclear_hexagram(binary: str) -> HexagramInfo | None:
    """Compute the nuclear (mutual) hexagram from the inner lines.

    The nuclear hexagram is formed by combining the nuclear trigrams:
    lower nuclear (lines 2-3-4) + upper nuclear (lines 3-4-5).
    """
    _load()
    lower_nuc, upper_nuc = nuclear_trigrams(binary)
    nuclear_binary = upper_nuc + lower_nuc  # upper trigram first in MSB representation
    return _by_binary.get(nuclear_binary)


def find_by_trigram(trigram_name_or_attr: str, position: str = "any") -> list[HexagramInfo]:
    """Find all hexagrams containing a given trigram.

    Args:
        trigram_name_or_attr: Trigram name (e.g. "Ch'ien") or attribute (e.g. "Heaven")
        position: "upper", "lower", or "any"
    """
    _load()
    search = trigram_name_or_attr.lower()
    results = []
    for info in _hexagrams:
        upper_match = search in info.upper_trigram.lower()
        lower_match = search in info.lower_trigram.lower()
        if position == "upper" and upper_match:
            results.append(info)
        elif position == "lower" and lower_match:
            results.append(info)
        elif position == "any" and (upper_match or lower_match):
            results.append(info)
    return results


# ---- Divination Simulation ----

def cast_single_line_auto() -> tuple[int, str]:
    """Cast a single line by tossing three coins with cryptographic randomness.

    Simulates three U.S. pennies: Heads = 3, Tails = 2.
    Returns (total, coins_display) where total is 6/7/8/9
    and coins_display is like "H T H".
    """
    coins = [secrets.choice(["H", "T"]) for _ in range(3)]
    total = sum(3 if c == "H" else 2 for c in coins)
    return total, " ".join(coins)


def parse_manual_toss(raw: str) -> int | None:
    """Parse user input describing a penny toss into a line value (6-9).

    Accepted formats:
      - Direct number: "6", "7", "8", "9"
      - Letter combos: "HHT", "H H T", "hht", "tth" (any order)
      - Shorthand: "2h1t", "3h", "3t", "1h2t"
      - Natural: "2 heads 1 tail"

    Returns the total (6-9) or None if unparsable.
    """
    text = raw.strip()
    if not text:
        return None

    # Direct number
    if text in ("6", "7", "8", "9"):
        return int(text)

    # Letter combo: strip spaces, check for 3 H/T characters
    letters = text.replace(" ", "").upper()
    if len(letters) == 3 and all(c in ("H", "T") for c in letters):
        return sum(3 if c == "H" else 2 for c in letters)

    # Shorthand: "2h1t", "3h", "3t", "1h2t", "2t1h", etc.
    lower = text.lower().strip()

    # Match patterns like "2h1t" or "1t2h"
    m = re.match(r'^(\d)\s*h(?:eads?)?\s*(\d)\s*t(?:ails?)?$', lower)
    if m:
        h, t = int(m.group(1)), int(m.group(2))
        if h + t == 3:
            return h * 3 + t * 2
    m = re.match(r'^(\d)\s*t(?:ails?)?\s*(\d)\s*h(?:eads?)?$', lower)
    if m:
        t, h = int(m.group(1)), int(m.group(2))
        if h + t == 3:
            return h * 3 + t * 2

    # "3h" or "3t" alone
    m = re.match(r'^(\d)\s*h(?:eads?)?$', lower)
    if m and int(m.group(1)) == 3:
        return 9
    m = re.match(r'^(\d)\s*t(?:ails?)?$', lower)
    if m and int(m.group(1)) == 3:
        return 6

    # Natural language: "2 heads 1 tail", "1 head 2 tails"
    m = re.match(r'^(\d)\s+heads?\s+(\d)\s+tails?$', lower)
    if m:
        h, t = int(m.group(1)), int(m.group(2))
        if h + t == 3:
            return h * 3 + t * 2
    m = re.match(r'^(\d)\s+tails?\s+(\d)\s+heads?$', lower)
    if m:
        t, h = int(m.group(1)), int(m.group(2))
        if h + t == 3:
            return h * 3 + t * 2

    return None


def build_cast_result(line_values: list[int]) -> CastResult:
    """Build a CastResult from 6 line values (each 6/7/8/9), bottom to top.

    This is the shared logic used by both auto and manual casting modes.
    """
    _load()
    primary_bits = []
    changing_lines = []

    for line_num, val in enumerate(line_values, start=1):
        if val == 6:    # old yin: currently yin, will change to yang
            primary_bits.append("0")
            changing_lines.append(line_num)
        elif val == 7:  # young yang: stable yang
            primary_bits.append("1")
        elif val == 8:  # young yin: stable yin
            primary_bits.append("0")
        elif val == 9:  # old yang: currently yang, will change to yin
            primary_bits.append("1")
            changing_lines.append(line_num)

    # Build binary string (MSB = line 6, LSB = line 1)
    primary_binary = "".join(reversed(primary_bits))
    primary = _by_binary.get(primary_binary)

    relating = None
    mask = "000000"
    if changing_lines:
        mask = compute_change_mask(changing_lines)
        relating_binary = _xor_binary(primary_binary, mask)
        relating = _by_binary.get(relating_binary)

    nuc = nuclear_hexagram(primary_binary) if primary else None

    return CastResult(
        line_values=line_values,
        primary=primary,
        changing_lines=changing_lines,
        relating=relating,
        change_mask=mask,
        nuclear=nuc,
    )


def build_cast_from_number(king_wen: int, changing_lines: list[int] | None = None) -> CastResult | None:
    """Build a CastResult from a King Wen number and optional changing lines.

    Useful for reference lookups: creates stable line values (7/8) for the
    hexagram, then marks specified positions as changing (9/6).

    Args:
        king_wen: King Wen sequence number (1-64).
        changing_lines: Optional 1-indexed line positions to mark as changing.

    Returns:
        CastResult or None if the hexagram number is invalid.
    """
    info = lookup_by_number(king_wen)
    if not info:
        return None

    # Convert binary to stable line values (MSB-first: index 0 = line 6)
    line_values = []
    for i in range(5, -1, -1):
        line_values.append(7 if info.binary[i] == "1" else 8)

    # Mark changing lines
    if changing_lines:
        for pos in changing_lines:
            if 1 <= pos <= 6:
                idx = pos - 1
                if line_values[idx] == 7:
                    line_values[idx] = 9  # young yang -> old yang
                elif line_values[idx] == 8:
                    line_values[idx] = 6  # young yin -> old yin

    return build_cast_result(line_values)


def cast_coins() -> CastResult:
    """Simulate a full three-coin I Ching casting (non-interactive).

    Uses cryptographic randomness (secrets module) to simulate
    tossing three pennies six times. Convenience wrapper around
    cast_single_line_auto() and build_cast_result().
    """
    line_values = []
    for _ in range(6):
        val, _ = cast_single_line_auto()
        line_values.append(val)
    return build_cast_result(line_values)


# Patterns for detecting hexagram references in text
_HEXAGRAM_NUM_RE = re.compile(
    r'(?:hexagram|gua|hex\.?)\s*#?\s*(\d{1,2})\b',
    re.IGNORECASE
)
_BINARY_RE = re.compile(r'\b([01]{6})\b')

# Patterns for detecting changing lines
_CHANGING_LINES_RE = re.compile(
    r'(?:changing|moving|old)\s+(?:lines?|yang|yin)\s+(?:in\s+)?(?:positions?\s+)?'
    r'([\d,\s]+(?:and\s+\d+)?)',
    re.IGNORECASE
)
_LINE_POSITIONS_RE = re.compile(
    r'(?:lines?\s+)([\d,\s]+(?:and\s+\d+)?)',
    re.IGNORECASE
)
_NINE_SIX_RE = re.compile(
    r'(?:nine|six)\s+(?:in\s+the\s+)?(\w+)\s+place',
    re.IGNORECASE
)

# Ordinal word to number mapping
_ORDINALS = {
    "first": 1, "second": 2, "third": 3,
    "fourth": 4, "fifth": 5, "sixth": 6,
    "1st": 1, "2nd": 2, "3rd": 3,
    "4th": 4, "5th": 5, "6th": 6,
}


def _parse_line_numbers(text: str) -> list[int]:
    """Extract line position numbers from text like '1, 3, and 6' or '1 4'."""
    nums = re.findall(r'\d+', text)
    return [int(n) for n in nums if 1 <= int(n) <= 6]


def detect_changing_lines(text: str) -> list[int]:
    """Detect changing/moving line references in text.

    Returns a sorted list of 1-indexed line positions.
    """
    lines = set()

    for match in _CHANGING_LINES_RE.finditer(text):
        lines.update(_parse_line_numbers(match.group(1)))

    for match in _NINE_SIX_RE.finditer(text):
        ordinal = match.group(1).lower()
        if ordinal in _ORDINALS:
            lines.add(_ORDINALS[ordinal])

    return sorted(lines)


def detect_hexagram_references(text: str) -> list[HexagramInfo]:
    """Detect hexagram references in text by number, name, or binary pattern.

    Returns a deduplicated list of identified hexagrams.
    """
    _load()
    found: dict[int, HexagramInfo] = {}

    # Match "hexagram N", "gua N", etc.
    for match in _HEXAGRAM_NUM_RE.finditer(text):
        num = int(match.group(1))
        if 1 <= num <= 64:
            info = _by_number.get(num)
            if info:
                found[info.king_wen] = info

    # Match 6-bit binary patterns
    for match in _BINARY_RE.finditer(text):
        info = _by_binary.get(match.group(1))
        if info:
            found[info.king_wen] = info

    # Match hexagram names in text (case-insensitive, word-boundary aware)
    text_lower = text.lower()
    for info in _hexagrams:
        # Check traditional name (at least 3 chars to avoid false positives like "I", "Pi", "Li", "Fu", "Ko")
        name_lower = info.name.lower()
        if len(name_lower) >= 3 and re.search(r'\b' + re.escape(name_lower) + r'\b', text_lower):
            found[info.king_wen] = info
        # Check English title (word boundary match)
        title_lower = info.title.lower()
        if re.search(r'\b' + re.escape(title_lower) + r'\b', text_lower):
            found[info.king_wen] = info

    return list(found.values())


def expand_query(query: str) -> str:
    """Expand a query with hexagram aliases for better retrieval.

    If the query mentions a hexagram (by number, name, or binary),
    appends all known aliases to improve embedding similarity.
    Also detects changing lines and includes the relating hexagram.

    Returns the original query if no hexagram reference is detected.
    """
    refs = detect_hexagram_references(query)
    if not refs:
        return query

    expansions = []
    for info in refs:
        expansions.append(
            f"{info.name} {info.title} hexagram {info.king_wen} "
            f"{info.binary} {info.upper_trigram} {info.lower_trigram}"
        )

    # Detect changing lines and compute relating hexagram
    changing = detect_changing_lines(query)
    if changing and len(refs) == 1:
        primary = refs[0]
        relating = transform(primary.binary, changing)
        if relating and relating.king_wen != primary.king_wen:
            ordinals = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth"}
            # Add line-specific terms for retrieval (e.g., "nine in the third place")
            for line in changing:
                expansions.append(f"nine in the {ordinals.get(line, '')} place")
                expansions.append(f"six in the {ordinals.get(line, '')} place")
            expansions.append(
                f"{relating.name} {relating.title} hexagram {relating.king_wen} "
                f"relating hexagram"
            )

    # Add nuclear hexagram aliases for retrieval enrichment
    for info in refs:
        nuc = nuclear_hexagram(info.binary)
        if nuc and nuc.king_wen != info.king_wen:
            expansions.append(
                f"{nuc.name} {nuc.title} hexagram {nuc.king_wen} "
                f"nuclear hexagram inner dynamic"
            )

    return query + " " + " ".join(expansions)


def enrich_metadata(metadata: dict, text: str) -> dict:
    """Add hexagram identification fields to chunk metadata.

    Scans the chunk text (and heading if present) for hexagram references
    and adds structured fields for ChromaDB filtering.
    """
    search_text = text[:500]
    heading = metadata.get("heading", "")
    if heading:
        search_text = heading + " " + search_text

    refs = detect_hexagram_references(search_text)
    if not refs:
        return metadata

    if len(refs) == 1:
        info = refs[0]
        metadata["hexagram_number"] = info.king_wen
        metadata["hexagram_name"] = info.name
        metadata["hexagram_title"] = info.title
        metadata["hexagram_binary"] = info.binary
        metadata["hexagram_upper_trigram"] = info.upper_trigram
        metadata["hexagram_lower_trigram"] = info.lower_trigram
        # Add nuclear hexagram
        nuc = nuclear_hexagram(info.binary)
        if nuc:
            metadata["nuclear_hexagram"] = nuc.king_wen
            metadata["nuclear_hexagram_name"] = nuc.name
    else:
        # Multiple hexagrams referenced -- still set hexagram_number to the
        # first (most prominent) reference so ChromaDB WHERE filters work,
        # plus store all as comma-separated for informational purposes.
        info = refs[0]
        metadata["hexagram_number"] = info.king_wen
        metadata["hexagram_name"] = info.name
        metadata["hexagram_title"] = info.title
        metadata["hexagram_binary"] = info.binary
        metadata["hexagram_upper_trigram"] = info.upper_trigram
        metadata["hexagram_lower_trigram"] = info.lower_trigram
        nuc = nuclear_hexagram(info.binary)
        if nuc:
            metadata["nuclear_hexagram"] = nuc.king_wen
            metadata["nuclear_hexagram_name"] = nuc.name
        metadata["hexagram_numbers"] = ",".join(str(r.king_wen) for r in refs)
        metadata["hexagram_names"] = ",".join(r.name for r in refs)

    return metadata
