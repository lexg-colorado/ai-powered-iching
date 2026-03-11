"""Deterministic text formatting for raw ChromaDB passage chunks.

Cleans up PDF extraction artifacts, detects I Ching section headers,
and segments text into structured blocks for clean UI rendering.
No LLM involved — pure regex and string processing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# ---- Page number stripping ----

# Lines that are exclusively a 3+ digit number (PDF page numbers)
_PAGE_NUMBER_RE = re.compile(r'^\s*\d{3,}\s*$')

# ---- Known I Ching section headers ----

_HEADER_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r'^\s*(THE\s+JUDGMENT)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(THE\s+IMAGE)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(THE\s+LINES)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(JUDGMENT)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(IMAGE)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(Commentary\s+on\s+the\s+Decision)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(Commentary\s+on\s+the\s+Images?)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(The\s+Sequence)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(Miscellaneous\s+Notes)\s*$', re.IGNORECASE),
    re.compile(r'^\s*(Appended\s+Judgments?)\s*$', re.IGNORECASE),
    # "Nine in the third place" / "Six at the top" / "Nine at the beginning"
    re.compile(
        r'^\s*((?:Nine|Six)\s+(?:in\s+the\s+\w+\s+place|at\s+the\s+(?:beginning|top)))'
        r'[.:]?\s*$',
        re.IGNORECASE,
    ),
    # Hexagram title lines like "34. Ta Chuang / The Power of the Great"
    re.compile(r'^\s*(\d{1,2}\.\s+\S.*?/.*\S)\s*$'),
]


@dataclass
class FormattedBlock:
    """One unit of formatted passage text."""
    type: str   # "header" | "paragraph"
    content: str


def _strip_page_numbers(text: str) -> str:
    """Remove lines that are just standalone page numbers."""
    lines = text.split('\n')
    cleaned = [line for line in lines if not _PAGE_NUMBER_RE.match(line)]
    return '\n'.join(cleaned)


def _normalize_whitespace(text: str) -> str:
    """Trim trailing spaces per line, collapse runs of 3+ blank lines to 2."""
    lines = [line.rstrip() for line in text.split('\n')]
    result: list[str] = []
    blank_count = 0
    for line in lines:
        if not line.strip():
            blank_count += 1
            if blank_count <= 2:
                result.append('')
        else:
            blank_count = 0
            result.append(line)
    return '\n'.join(result).strip()


def _match_header(line: str) -> str | None:
    """If the line matches a known section header, return the matched text."""
    stripped = line.strip()
    if not stripped:
        return None
    for pattern in _HEADER_PATTERNS:
        m = pattern.match(stripped)
        if m:
            return m.group(1).strip()
    return None


def _flush_paragraph(accumulated: list[str]) -> FormattedBlock | None:
    """Join accumulated non-header lines into a paragraph block."""
    text = ' '.join(accumulated).strip()
    # Collapse internal multi-spaces
    text = re.sub(r'  +', ' ', text)
    if text:
        return FormattedBlock(type="paragraph", content=text)
    return None


def format_passage(raw_text: str) -> list[FormattedBlock]:
    """Format a raw ChromaDB passage chunk into structured blocks.

    Pipeline:
      1. Strip stray page numbers
      2. Normalize whitespace
      3. Detect section headers and segment into header/paragraph blocks

    Returns a list of FormattedBlock with type "header" or "paragraph".
    """
    text = _strip_page_numbers(raw_text)
    text = _normalize_whitespace(text)

    blocks: list[FormattedBlock] = []
    paragraph_lines: list[str] = []

    for line in text.split('\n'):
        # Check for blank line -> paragraph break
        if not line.strip():
            block = _flush_paragraph(paragraph_lines)
            if block:
                blocks.append(block)
            paragraph_lines = []
            continue

        # Check for header
        header = _match_header(line)
        if header:
            # Flush any accumulated paragraph first
            block = _flush_paragraph(paragraph_lines)
            if block:
                blocks.append(block)
            paragraph_lines = []
            blocks.append(FormattedBlock(type="header", content=header))
            continue

        # Regular text line -> accumulate into paragraph
        paragraph_lines.append(line.strip())

    # Flush remaining
    block = _flush_paragraph(paragraph_lines)
    if block:
        blocks.append(block)

    return blocks
