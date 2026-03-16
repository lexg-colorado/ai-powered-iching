"""Direct markdown-based hexagram and Wings text retrieval.

Loads the 64 structured markdown files from Data/Hexagrams/ and the
per-hexagram Wing commentaries from Data/Wings/. Provides deterministic,
per-hexagram text lookup — no embeddings, no ChromaDB, no cross-hexagram
contamination.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

from iching.hexagram_lookup import CastResult, nuclear_hexagram

# Directories containing source material
_HEXAGRAMS_DIR = Path(__file__).parent / "Data" / "Hexagrams"
_WINGS_DIR = Path(__file__).parent / "Data" / "Wings"
_DATA_DIR = Path(__file__).parent / "Data"

# Module-level caches
_cache: dict[int, HexagramText] = {}
_file_index: dict[int, Path] = {}
_loaded = False

_wing_cache: dict[int, WingText] = {}
_wing_file_index: dict[int, Path] = {}
_wings_loaded = False

# Standalone Wing documents (loaded once)
_shuo_kua_text: str | None = None
_reading_guide_text: str | None = None

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

# Pattern to split Wing line commentaries (e.g., "Six at the beginning:", "Nine in the second place:")
_WING_LINE_RE = re.compile(
    r'^((?:Nine|Six)\s+(?:at\s+the\s+|in\s+the\s+)\w+(?:\s+place)?)\s*:',
    re.MULTILINE | re.IGNORECASE,
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


@dataclass
class WingText:
    """Parsed content of a per-hexagram Wing file."""
    king_wen: int
    name: str = ""
    sequence: str = ""           # Hsu Kua
    miscellaneous: str = ""      # Tsa Kua
    tuan_chuan: str = ""         # Commentary on the Decision
    image_commentary: str = ""   # Hsiang Chuan — THE IMAGE section
    line_commentaries: dict[int, str] = field(default_factory=dict)  # Hsiang Chuan — per-line


# ---------------------------------------------------------------------------
# Hexagram file parsing (unchanged)
# ---------------------------------------------------------------------------

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
        num_match = re.search(r'Hexagram\s+(\d+)', heading)
        if num_match:
            result.king_wen = int(num_match.group(1))
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
            parsed.king_wen = num
            _cache[num] = parsed
        except Exception:
            pass
    _loaded = True


# ---------------------------------------------------------------------------
# Wings file parsing
# ---------------------------------------------------------------------------

def _build_wing_file_index() -> None:
    """Scan the Wings directory and map King Wen numbers to file paths."""
    global _wing_file_index
    if not _WINGS_DIR.is_dir():
        return
    for entry in _WINGS_DIR.iterdir():
        if entry.suffix == ".md" and entry.name[:2].isdigit():
            num = int(entry.name[:2])
            _wing_file_index[num] = entry


def _parse_wing_line_commentaries(lines_text: str) -> dict[int, str]:
    """Parse the THE LINES section of a Wing file into per-line commentaries."""
    commentaries: dict[int, str] = {}

    # Split on line heading patterns like "Six at the beginning:" or "Nine in the third place:"
    splits = list(_WING_LINE_RE.finditer(lines_text))
    if not splits:
        return commentaries

    for i, match in enumerate(splits):
        heading = match.group(1)
        start = match.end()
        end = splits[i + 1].start() if i + 1 < len(splits) else len(lines_text)
        body = lines_text[start:end].strip()

        pos = _parse_line_position(heading)
        if pos is not None:
            commentaries[pos] = body

    return commentaries


def _parse_wing_markdown(text: str) -> WingText:
    """Parse a per-hexagram Wing markdown file into structured sections."""
    result = WingText(king_wen=0)

    lines = text.split("\n")

    # Parse H1 heading: "# Hexagram N — Name / English — Wings"
    if lines and lines[0].startswith("# "):
        heading = lines[0][2:].strip()
        num_match = re.search(r'Hexagram\s+(\d+)', heading)
        if num_match:
            result.king_wen = int(num_match.group(1))
        parts = heading.split("—")
        if len(parts) >= 2:
            result.name = parts[1].strip().split("/")[0].strip()

    # Split into ## sections
    section_pattern = re.compile(r'^## (.+)$', re.MULTILINE)
    section_splits = list(section_pattern.finditer(text))

    for i, match in enumerate(section_splits):
        section_name = match.group(1).strip().lower()
        start = match.end()
        end = section_splits[i + 1].start() if i + 1 < len(section_splits) else len(text)
        body = text[start:end].strip()

        if "sequence" in section_name or "hsu kua" in section_name:
            result.sequence = body
        elif "miscellaneous" in section_name or "tsa kua" in section_name:
            result.miscellaneous = body
        elif "commentary on the decision" in section_name or "t'uan chuan" in section_name:
            result.tuan_chuan = body
        elif "commentary on the images" in section_name or "hsiang chuan" in section_name:
            # Split into IMAGE and LINES subsections
            h3_pattern = re.compile(r'^### (.+)$', re.MULTILINE)
            h3_splits = list(h3_pattern.finditer(body))

            for j, h3_match in enumerate(h3_splits):
                h3_name = h3_match.group(1).strip().upper()
                h3_start = h3_match.end()
                h3_end = h3_splits[j + 1].start() if j + 1 < len(h3_splits) else len(body)
                h3_body = body[h3_start:h3_end].strip()

                if "IMAGE" in h3_name and "LINE" not in h3_name:
                    result.image_commentary = h3_body
                elif "LINE" in h3_name:
                    result.line_commentaries = _parse_wing_line_commentaries(h3_body)

    return result


def _load_wings() -> None:
    """Load and cache all per-hexagram Wing files."""
    global _wings_loaded
    if _wings_loaded:
        return
    _build_wing_file_index()
    for num, path in _wing_file_index.items():
        try:
            text = path.read_text(encoding="utf-8")
            parsed = _parse_wing_markdown(text)
            parsed.king_wen = num
            _wing_cache[num] = parsed
        except Exception:
            pass
    _wings_loaded = True


def load_wing_text(king_wen: int) -> WingText | None:
    """Get the parsed Wing commentary for a hexagram by King Wen number."""
    _load_wings()
    return _wing_cache.get(king_wen)


# ---------------------------------------------------------------------------
# Standalone Wing documents
# ---------------------------------------------------------------------------

def get_shuo_kua() -> str:
    """Load the Shuo Kua (Discussion of the Trigrams) as a single string."""
    global _shuo_kua_text
    if _shuo_kua_text is None:
        path = _WINGS_DIR / "shuo_kua.md"
        if path.is_file():
            _shuo_kua_text = path.read_text(encoding="utf-8")
        else:
            _shuo_kua_text = ""
    return _shuo_kua_text


def get_reading_guide() -> str:
    """Load the reading guide as a single string."""
    global _reading_guide_text
    if _reading_guide_text is None:
        path = _DATA_DIR / "How to Do an I-Ching Reading.md"
        if path.is_file():
            _reading_guide_text = path.read_text(encoding="utf-8")
        else:
            _reading_guide_text = ""
    return _reading_guide_text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

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


def _wing_passages(king_wen: int, sections: list[str]) -> list[dict]:
    """Build passage dicts from Wing commentary for a hexagram.

    Args:
        sections: List of wing sections to include. Valid values:
            "tuan_chuan", "miscellaneous", "sequence", "image_commentary"
    """
    wt = load_wing_text(king_wen)
    if not wt:
        return []

    label_map = {
        "tuan_chuan": ("T'uan Chuan (Commentary on the Decision)", wt.tuan_chuan),
        "miscellaneous": ("Tsa Kua (Miscellaneous Notes)", wt.miscellaneous),
        "sequence": ("Hsu Kua (The Sequence)", wt.sequence),
        "image_commentary": ("Hsiang Chuan (Commentary on the Image)", wt.image_commentary),
    }

    results = []
    for sec in sections:
        label, text = label_map.get(sec, ("", ""))
        if text:
            results.append({
                "chunk_text": f"[{label}]\n{text}",
                "metadata": {
                    "hexagram_number": king_wen,
                    "source": "wings",
                    "wing_section": sec,
                },
            })
    return results


def get_reading_passages(cast: CastResult) -> dict[str, list[dict]]:
    """Retrieve structured passages for a reading from markdown and Wing files.

    Returns a dict with keys: "primary", "primary_wings", "line_N",
    "line_N_wings", "relating", "relating_wings", "nuclear_primary",
    "nuclear_relating", "zong_gua".
    """
    _load()
    _load_wings()
    passages: dict[str, list[dict]] = {}

    primary = cast.primary

    # 1. Primary hexagram: Overview + Judgment + Image
    passages["primary"] = _hex_passages(
        primary.king_wen, ["overview", "judgment", "image"],
    )

    # 1b. Primary Wings: T'uan Chuan + Tsa Kua
    passages["primary_wings"] = _wing_passages(
        primary.king_wen, ["tuan_chuan", "miscellaneous", "sequence"],
    )

    # 2. Changing lines
    ht = load_hexagram_text(primary.king_wen)
    wt = load_wing_text(primary.king_wen)
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
            # 2b. Wing line commentary (Hsiang Chuan)
            if wt and line in wt.line_commentaries:
                passages[f"line_{line}_wings"] = [{
                    "chunk_text": f"[Hsiang Chuan — Line {line} Commentary]\n{wt.line_commentaries[line]}",
                    "metadata": {
                        "hexagram_number": primary.king_wen,
                        "line": line,
                        "source": "wings",
                        "wing_section": "hsiang_chuan_line",
                    },
                }]

    # 3. Relating hexagram
    if cast.relating:
        rel = cast.relating
        passages["relating"] = _hex_passages(
            rel.king_wen, ["judgment", "image"],
        )
        # 3b. Relating Wings: Tsa Kua + Sequence
        passages["relating_wings"] = _wing_passages(
            rel.king_wen, ["miscellaneous", "sequence"],
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
