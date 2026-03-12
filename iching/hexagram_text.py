"""Direct markdown-based hexagram text retrieval.

Loads the 64 structured markdown files from Data/Hexagrams/ and provides
deterministic, per-hexagram text lookup — no embeddings, no ChromaDB,
no cross-hexagram contamination.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from iching.hexagram_lookup import CastResult, nuclear_hexagram

# Directory containing the 64 hexagram markdown files
_HEXAGRAMS_DIR = Path(__file__).parent / "Data" / "Hexagrams"

# Module-level cache
_cache: dict[int, HexagramText] = {}
_file_index: dict[int, Path] = {}
_loaded = False

# Map line heading keywords to 1-indexed positions
_LINE_POSITION_MAP = {
    "beginning": 1,
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "fifth": 5,
    "top": 6,
    "sixth": 6,
}

_LINE_HEADING_RE = re.compile(
    r'(?:nine|six)\s+(?:at\s+the\s+|in\s+the\s+)?(\w+)',
    re.IGNORECASE,
)


@dataclass
class HexagramText:
    """Parsed content of a hexagram markdown file."""
    king_wen: int
    name: str
    alternate_names: list[str] = field(default_factory=list)
    overview: str = ""
    judgment: str = ""
    image: str = ""
    lines: dict[int, str] = field(default_factory=dict)
    raw_markdown: str = ""


def _build_file_index() -> None:
    """Scan the Hexagrams directory and map King Wen numbers to file paths."""
    global _file_index
    if not _HEXAGRAMS_DIR.is_dir():
        return
    for entry in _HEXAGRAMS_DIR.iterdir():
        if entry.suffix == ".md" and entry.name[:2].isdigit():
            num = int(entry.name[:2])
            _file_index[num] = entry


def _parse_line_position(heading: str) -> int | None:
    """Extract line position (1-6) from a line heading like 'Nine at the Beginning'."""
    m = _LINE_HEADING_RE.search(heading)
    if m:
        keyword = m.group(1).lower()
        return _LINE_POSITION_MAP.get(keyword)
    return None


def _parse_markdown(text: str) -> HexagramText:
    """Parse a hexagram markdown file into structured sections."""
    result = HexagramText(king_wen=0, name="", raw_markdown=text)

    lines = text.split("\n")

    # Parse H1 heading: "# Hexagram N — ... — Name"
    if lines and lines[0].startswith("# "):
        heading = lines[0][2:].strip()
        # Extract King Wen number
        num_match = re.search(r'Hexagram\s+(\d+)', heading)
        if num_match:
            result.king_wen = int(num_match.group(1))
        # Extract name (last segment after —)
        parts = heading.split("—")
        if len(parts) >= 3:
            result.name = parts[-1].strip()
        elif len(parts) >= 2:
            result.name = parts[-1].strip()

    # Parse alternate names
    for line in lines:
        if line.startswith("**Alternate Names:**"):
            names_str = line.replace("**Alternate Names:**", "").strip()
            result.alternate_names = [
                n.strip().strip('"').strip("'")
                for n in names_str.split(",")
                if n.strip()
            ]
            break

    # Split into ## sections
    section_pattern = re.compile(r'^## (.+)$', re.MULTILINE)
    section_splits = list(section_pattern.finditer(text))

    for i, match in enumerate(section_splits):
        section_name = match.group(1).strip().lower()
        start = match.end()
        end = section_splits[i + 1].start() if i + 1 < len(section_splits) else len(text)
        body = text[start:end].strip()

        if section_name == "overview":
            result.overview = body
        elif section_name == "judgment":
            result.judgment = body
        elif section_name == "image":
            result.image = body
        elif section_name == "the lines":
            # Parse ### subsections for individual lines
            line_pattern = re.compile(r'^### (.+)$', re.MULTILINE)
            line_splits = list(line_pattern.finditer(body))
            for j, lmatch in enumerate(line_splits):
                line_heading = lmatch.group(1).strip()
                lstart = lmatch.end()
                lend = line_splits[j + 1].start() if j + 1 < len(line_splits) else len(body)
                line_body = body[lstart:lend].strip()

                pos = _parse_line_position(line_heading)
                if pos is not None:
                    result.lines[pos] = line_body

    return result


def _load() -> None:
    """Load and cache all hexagram markdown files."""
    global _loaded
    if _loaded:
        return
    _build_file_index()
    for num, path in _file_index.items():
        try:
            text = path.read_text(encoding="utf-8")
            parsed = _parse_markdown(text)
            parsed.king_wen = num  # ensure consistency with filename
            _cache[num] = parsed
        except Exception:
            pass  # skip unparseable files
    _loaded = True


def load_hexagram_text(king_wen: int) -> HexagramText | None:
    """Get the parsed text for a hexagram by King Wen number."""
    _load()
    return _cache.get(king_wen)


def get_section(king_wen: int, section: str) -> str | None:
    """Get a specific section for a hexagram.

    Args:
        king_wen: King Wen sequence number (1-64).
        section: One of "overview", "judgment", "image", or "line_N" (e.g. "line_3").
    """
    ht = load_hexagram_text(king_wen)
    if not ht:
        return None
    if section == "overview":
        return ht.overview
    if section == "judgment":
        return ht.judgment
    if section == "image":
        return ht.image
    if section.startswith("line_"):
        try:
            pos = int(section.split("_")[1])
            return ht.lines.get(pos)
        except (ValueError, IndexError):
            return None
    return None


def _hex_passages(king_wen: int, sections: list[str]) -> list[dict]:
    """Build passage dicts for a hexagram from specified sections."""
    ht = load_hexagram_text(king_wen)
    if not ht:
        return []

    parts = []
    for sec in sections:
        text = None
        if sec == "overview":
            text = ht.overview
        elif sec == "judgment":
            text = ht.judgment
        elif sec == "image":
            text = ht.image
        if text:
            parts.append(text)

    if not parts:
        return []

    return [{
        "chunk_text": "\n\n".join(parts),
        "metadata": {
            "hexagram_number": king_wen,
            "hexagram_name": ht.name,
            "source": "hexagram_text",
        },
    }]


def get_reading_passages(cast: CastResult) -> dict[str, list[dict]]:
    """Retrieve structured passages for a reading from markdown files.

    Drop-in replacement for reading.retrieve_reading_passages().
    Returns the same dict shape with keys: "primary", "line_N",
    "relating", "nuclear_primary", "nuclear_relating".
    """
    _load()
    passages: dict[str, list[dict]] = {}

    primary = cast.primary

    # 1. Primary hexagram: Overview + Judgment + Image
    passages["primary"] = _hex_passages(
        primary.king_wen, ["overview", "judgment", "image"],
    )

    # 2. Changing lines
    ht = load_hexagram_text(primary.king_wen)
    if ht:
        for line in sorted(cast.changing_lines):
            line_text = ht.lines.get(line)
            if line_text:
                passages[f"line_{line}"] = [{
                    "chunk_text": line_text,
                    "metadata": {
                        "hexagram_number": primary.king_wen,
                        "line": line,
                        "source": "hexagram_text",
                    },
                }]

    # 3. Relating hexagram
    if cast.relating:
        rel = cast.relating
        passages["relating"] = _hex_passages(
            rel.king_wen, ["judgment", "image"],
        )

    # 4. Nuclear hexagram of primary
    if cast.nuclear:
        passages["nuclear_primary"] = _hex_passages(
            cast.nuclear.king_wen, ["overview", "judgment"],
        )

    # 5. Nuclear hexagram of relating
    if cast.relating:
        rel_nuc = nuclear_hexagram(cast.relating.binary)
        if rel_nuc and (not cast.nuclear or rel_nuc.king_wen != cast.nuclear.king_wen):
            passages["nuclear_relating"] = _hex_passages(
                rel_nuc.king_wen, ["overview", "judgment"],
            )

    # 6. Zong Gua (complement) of primary
    if cast.zong_gua:
        passages["zong_gua"] = _hex_passages(
            cast.zong_gua.king_wen, ["overview", "judgment"],
        )

    return passages
