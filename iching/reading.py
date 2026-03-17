"""I Ching reading interpretation module.

Retrieves relevant passages from ChromaDB, builds a structured prompt,
and uses the LLM to synthesize a coherent reading interpretation.

Reading structure (from Interpreting Casts.md):
  1. Primary hexagram Judgment + Image (overall theme)
  2. Changing lines bottom-to-top (stages of the process)
  3. Relating hexagram Judgment (direction / new equilibrium)
  4. Nuclear hexagrams (hidden inner dynamic / unconscious undercurrent)
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator

from iching import chromadb_client, config
from iching.hexagram_lookup import CastResult, nuclear_hexagram
from iching import hexagram_text
from iching import llm_client


# ---------------------------------------------------------------------------
# Question-type classifier (runs in Python, NOT in the LLM)
# ---------------------------------------------------------------------------

# Yes/no starters — highest priority, unambiguous
_YES_NO_PATTERNS = re.compile(
    r"^\s*(should\s+I|will\s+(this|it|that|I|we|my)|is\s+(it|this|that)|"
    r"can\s+I|am\s+I|are\s+(we|they|you)|do\s+I|does\s+(this|it|that)|"
    r"could\s+I|would\s+(it|this|that))\b",
    re.IGNORECASE,
)

# Wh-words that route to "open" (excludes "what" and "why" which get special handling)
_WH_OPEN_PATTERN = re.compile(
    r"^\s*(when|where|how|which|who)\b",
    re.IGNORECASE,
)

# Diagnostic keywords — checked before wh-word routing so
# "What is blocking me?" goes diagnostic, not reflective
_DIAGNOSTIC_KEYWORDS = re.compile(
    r"block(ing|ed)?|stuck|break(ing)?\s+down|keeps?\s+happen|going\s+wrong|"
    r"root\s+cause|what('s|s)\s+wrong|falling\s+apart|not\s+working|"
    r"keep\s+fail|obstacle|barrier|holding\s+(me|us|it)\s+back|"
    r"prevent(ing)?|the\s+problem",
    re.IGNORECASE,
)

# Reflective keywords — introspective, self-referential
_REFLECTIVE_KEYWORDS = re.compile(
    r"(not|am\s+I)\s+seeing|reveal|about\s+(me|myself)|"
    r"need\s+to\s+(learn|understand|know|focus)|focus\s+on|"
    r"teach(ing)?\s+me|tell(ing)?\s+me\s+about\s+(myself|me)|"
    r"blind\s+spot|my\s+(shadow|blind|pattern|lesson|growth|role\s+in)|"
    r"behind\s+(my|that|this)\s+(reaction|behavior|feeling)|"
    r"what\s+(does|is)\s+this\s+(reveal|teach|show|mean\s+for\s+me)",
    re.IGNORECASE,
)

# Verb starters that indicate a question/command even without wh-words
_VERB_STARTER = re.compile(
    r"^\s*(tell|explain|describe|show|help)\b",
    re.IGNORECASE,
)


def classify_question(question: str | None) -> str:
    """Classify a question into one of six types.

    Types:
      - 'none':        No input provided
      - 'yes_no':      Binary decision question (should I, will this, is it...)
      - 'diagnostic':  Seeking root causes, blockages, patterns (why, what's blocking...)
      - 'reflective':  Self-knowledge, blind spots, inner states (what am I not seeing...)
      - 'open':        Practical guidance (how, when, where, who, which...)
      - 'topic':       Not a question — a situation, person, place, or thing

    Detection priority:
      1. Empty/null → none
      2. Yes/no starters → yes_no
      3. Diagnostic keywords → diagnostic
      4. Starts with "why" → diagnostic
      5. Starts with "what" + reflective keywords → reflective
      6. Starts with "what" (without reflective markers) → open
      7. Other wh-words (how, when, where, which, who) → open
      8. Reflective keywords (without wh-word) → reflective
      9. Has question mark or verb starter → open
     10. Default fallback → topic
    """
    if not question or not question.strip():
        return "none"

    q = question.strip()
    q_lower = q.lower()

    # 1. Yes/no starters (highest priority — unambiguous)
    if _YES_NO_PATTERNS.match(q):
        return "yes_no"

    # 2. Diagnostic keywords (before wh-word routing)
    if _DIAGNOSTIC_KEYWORDS.search(q_lower):
        return "diagnostic"

    # 3. "Why" → almost always diagnostic in divination context
    if re.match(r"^\s*why\b", q_lower):
        return "diagnostic"

    # 4. "What" — split between reflective and open
    if re.match(r"^\s*what\b", q_lower):
        if _REFLECTIVE_KEYWORDS.search(q_lower):
            return "reflective"
        return "open"

    # 5. Other wh-words → open
    if _WH_OPEN_PATTERN.match(q):
        return "open"

    # 6. Reflective keywords without wh-word ("tell me what I'm missing")
    if _REFLECTIVE_KEYWORDS.search(q_lower):
        return "reflective"

    # 7. Looks like a question (question mark or imperative verb)
    if q.endswith("?") or _VERB_STARTER.match(q):
        return "open"

    # 8. Default: it's a topic/situation, not a question
    return "topic"


# Line position symbolic meanings
LINE_STAGES = {
    1: "beginning",
    2: "development",
    3: "difficulty / transition",
    4: "emerging awareness",
    5: "authority / center",
    6: "completion / excess",
}

ORDINALS = {1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth"}


def _jaccard_similarity(text_a: str, text_b: str) -> float:
    """Word-level Jaccard similarity between two strings."""
    words_a = set(text_a.lower().split())
    words_b = set(text_b.lower().split())
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a | words_b)


def _deduplicate(results: list[dict], threshold: float = 0.7) -> list[dict]:
    """Remove results that overlap heavily with a higher-ranked result."""
    if len(results) <= 1:
        return results
    kept: list[dict] = []
    for r in results:
        text = r.get("chunk_text", "")
        if any(_jaccard_similarity(text, k.get("chunk_text", "")) >= threshold for k in kept):
            continue
        kept.append(r)
    return kept


def _filter_by_hexagram(results: list[dict], hex_num: int) -> list[dict]:
    """Keep only results whose metadata hexagram_number matches, or has no metadata."""
    filtered = []
    for r in results:
        meta = r.get("metadata", {})
        chunk_hex = meta.get("hexagram_number")
        # Keep if metadata matches, or if chunk has no hexagram_number at all
        # (untagged chunks may still be relevant)
        if chunk_hex is None or chunk_hex == hex_num:
            filtered.append(r)
    return filtered


async def _query_collection(
    collection: str,
    query: str,
    n_results: int = 3,
    where: dict | None = None,
    expected_hex: int | None = None,
) -> list[dict]:
    """Run a vector query with post-retrieval validation and dedup.

    Args:
        expected_hex: If provided, post-filter results to only include
            chunks tagged with this hexagram number (or untagged chunks).
    """
    results = await chromadb_client.query(
        collection=collection,
        query_text=query,
        n_results=n_results,
        where=where,
    )
    if expected_hex is not None:
        results = _filter_by_hexagram(results, expected_hex)
    results = _deduplicate(results)
    return results


async def retrieve_reading_passages(
    collection: str,
    cast: CastResult,
    use_markdown: bool = True,
) -> dict[str, list[dict]]:
    """Retrieve all passages needed for a reading interpretation.

    Args:
        collection: ChromaDB collection name (used when use_markdown=False).
        cast: The CastResult to retrieve passages for.
        use_markdown: If True, use the structured markdown files in Data/Hexagrams/
            for deterministic, clean text retrieval. If False, use ChromaDB vector search.

    Returns a dict with keys:
      - "primary": passages about the primary hexagram
      - "line_N": passages for each changing line N
      - "relating": passages about the relating hexagram (if any)
      - "nuclear_primary": passages about the primary's nuclear hexagram
      - "nuclear_relating": passages about the relating's nuclear hexagram (if any)
    """
    if use_markdown:
        return hexagram_text.get_reading_passages(cast)

    passages: dict[str, list[dict]] = {}

    primary = cast.primary
    hex_filter = {"hexagram_number": primary.king_wen}

    # 1. Primary hexagram: Judgment + Image
    # Request extra results since post-filtering may remove some
    primary_query = (
        f"hexagram {primary.king_wen} {primary.name} {primary.title} "
        f"judgment image overall meaning"
    )
    passages["primary"] = await _query_collection(
        collection, primary_query, n_results=6, where=hex_filter,
        expected_hex=primary.king_wen,
    )
    # Fallback without metadata filter, but still post-filter by hexagram
    if not passages["primary"]:
        passages["primary"] = await _query_collection(
            collection, primary_query, n_results=6,
            expected_hex=primary.king_wen,
        )

    # 2. Changing lines (bottom to top)
    for line in sorted(cast.changing_lines):
        val = cast.line_values[line - 1]
        # Nine for yang changing (9), Six for yin changing (6)
        prefix = "nine" if val == 9 else "six"
        ordinal = ORDINALS[line]

        line_query = (
            f"hexagram {primary.king_wen} {primary.name} "
            f"{prefix} in the {ordinal} place line {line}"
        )
        key = f"line_{line}"
        passages[key] = await _query_collection(
            collection, line_query, n_results=4, where=hex_filter,
            expected_hex=primary.king_wen,
        )
        if not passages[key]:
            passages[key] = await _query_collection(
                collection, line_query, n_results=4,
                expected_hex=primary.king_wen,
            )

    # 3. Relating hexagram (if exists)
    if cast.relating:
        rel = cast.relating
        rel_query = (
            f"hexagram {rel.king_wen} {rel.name} {rel.title} "
            f"judgment overall meaning"
        )
        rel_filter = {"hexagram_number": rel.king_wen}
        passages["relating"] = await _query_collection(
            collection, rel_query, n_results=4, where=rel_filter,
            expected_hex=rel.king_wen,
        )
        if not passages["relating"]:
            passages["relating"] = await _query_collection(
                collection, rel_query, n_results=4,
                expected_hex=rel.king_wen,
            )

    # 4. Nuclear hexagram of primary
    if cast.nuclear:
        nuc = cast.nuclear
        nuc_query = (
            f"hexagram {nuc.king_wen} {nuc.name} {nuc.title} "
            f"judgment image overall meaning"
        )
        nuc_filter = {"hexagram_number": nuc.king_wen}
        passages["nuclear_primary"] = await _query_collection(
            collection, nuc_query, n_results=4, where=nuc_filter,
            expected_hex=nuc.king_wen,
        )
        if not passages["nuclear_primary"]:
            passages["nuclear_primary"] = await _query_collection(
                collection, nuc_query, n_results=4,
                expected_hex=nuc.king_wen,
            )

    # 5. Nuclear hexagram of relating (if exists and differs from primary's nuclear)
    if cast.relating:
        rel_nuc = nuclear_hexagram(cast.relating.binary)
        if rel_nuc and (not cast.nuclear or rel_nuc.king_wen != cast.nuclear.king_wen):
            rel_nuc_query = (
                f"hexagram {rel_nuc.king_wen} {rel_nuc.name} {rel_nuc.title} "
                f"judgment image overall meaning"
            )
            rel_nuc_filter = {"hexagram_number": rel_nuc.king_wen}
            passages["nuclear_relating"] = await _query_collection(
                collection, rel_nuc_query, n_results=4, where=rel_nuc_filter,
                expected_hex=rel_nuc.king_wen,
            )
            if not passages["nuclear_relating"]:
                passages["nuclear_relating"] = await _query_collection(
                    collection, rel_nuc_query, n_results=4,
                    expected_hex=rel_nuc.king_wen,
                )

    # 6. Zong Gua (complement) of primary
    if cast.zong_gua:
        zong = cast.zong_gua
        zong_query = (
            f"hexagram {zong.king_wen} {zong.name} {zong.title} "
            f"judgment image overall meaning"
        )
        zong_filter = {"hexagram_number": zong.king_wen}
        passages["zong_gua"] = await _query_collection(
            collection, zong_query, n_results=4, where=zong_filter,
            expected_hex=zong.king_wen,
        )
        if not passages["zong_gua"]:
            passages["zong_gua"] = await _query_collection(
                collection, zong_query, n_results=4,
                expected_hex=zong.king_wen,
            )

    return passages


def _passages_text(results: list[dict], label: str) -> str:
    """Format retrieved passages into a labeled text block."""
    if not results:
        return f"[{label}: no passages found]\n"

    parts = [f"--- {label} ---"]
    for r in results:
        text = r.get("chunk_text", "")[:800]
        parts.append(text)
    return "\n".join(parts) + "\n"


def _build_system_prompt(q_type: str) -> str:
    """Build the system prompt incorporating the reading guide and Shuo Kua."""

    # Load the reading guide as the foundation of the system prompt
    reading_guide = hexagram_text.get_reading_guide()

    _OPEN_PROMPT = (
        "You are a learned I Ching interpreter. You synthesize traditional I Ching passages "
        "and Wing commentaries into a coherent, insightful reading.\n\n"
        "Follow this structure:\n\n"
        "1. Begin with the primary hexagram's overall meaning (Judgment and Image). "
        "Use the T'uan Chuan to explain *why* the Judgment counsels what it does — "
        "identify the ruler line, the trigram interaction, and the structural logic.\n"
        "2. Interpret each changing line in order from bottom to top, noting what stage "
        "of the process it represents. Use the Hsiang Chuan line commentary to explain "
        "the structural reason behind each line's counsel — correspondences, character-place "
        "relationships, and position within the trigram.\n"
        "3. Discuss the relating hexagram as the direction the situation moves toward. "
        "Use the Tsa Kua for a sharp characterization and the Hsu Kua for narrative context.\n"
        "4. If nuclear hexagram passages are provided, discuss the nuclear hexagram(s) "
        "as the hidden inner dynamic — the unconscious undercurrent or deeper structural "
        "tendency beneath the surface. Include the hexagram number in the heading, e.g. "
        "'### Nuclear Hexagram of Primary (54): Kuei Mei / The Marrying Maiden'.\n"
        "5. If Zong Gua (complement) passages are provided, conclude with the Zong Gua "
        "as the polar opposite — what the situation is NOT, and by contrast, what it "
        "fundamentally IS. Include the hexagram number in the heading, e.g. "
        "'### Zong Gua (Complement) (44): Kou / Coming to Meet'.\n"
        "6. If the querent asked a question, conclude with a '### Counsel' section that "
        "directly addresses their question with concrete, practical guidance drawn from "
        "all layers of the reading. Omit this section if no question was asked.\n\n"
        "Principles:\n"
        "- Always start from the hexagram source texts. The Wings deepen and explain.\n"
        "- Use the T'uan Chuan and Hsiang Chuan as interpretive backbone.\n"
        "- Use trigram symbolism from the Shuo Kua when it enriches interpretation.\n"
        "- Speak with clarity, not mysticism. The Wings themselves are analytical — follow their example.\n"
        "- Respect passage boundaries. Never conflate material from different hexagrams."
    )

    _YES_NO_PROMPT = (
        "You are a learned I Ching interpreter. The querent has asked a yes/no question. "
        "Your task is to give them a direct answer derived from the hexagram texts and "
        "Wing commentaries, followed by a focused explanation.\n\n"
        "Step 1: READ the Judgment text carefully. Use the T'uan Chuan to understand "
        "the structural logic. Identify specific language: 'success', 'it furthers', "
        "'good fortune'? Or 'nothing furthers', 'misfortune', 'danger', 'withdraw'? "
        "Caution or withdrawal language means NO or NOT YET — do NOT default to yes.\n"
        "Step 2: Check the changing lines — do they reinforce or contradict the Judgment? "
        "Use the Hsiang Chuan line commentaries for structural reasoning.\n"
        "Step 3: COMMIT to your answer. Open with a single bold heading: "
        "'## Yes', '## No', '## Yes, but...', '## No, unless...', or '## Not yet'. "
        "Do NOT hedge or soften. The hexagram has spoken.\n"
        "Step 4: Follow with a condensed explanation drawing from Judgment, changing "
        "lines, and relating hexagram to explain WHY. Keep it focused and direct.\n"
        "Step 5: Do NOT include nuclear hexagram or Zong Gua sections.\n"
        "Step 6: End with a brief '### Counsel' section.\n\n"
        "Use the retrieved passages as your source material. Speak with clarity and wisdom."
    )

    _TOPIC_PROMPT = (
        "You are a learned I Ching interpreter. The querent has not asked a question — "
        "they have offered a topic, situation, person, or subject for the Oracle to address. "
        "Your task is to illuminate the nature and dynamics of the subject through the hexagram.\n\n"
        "Follow this structure:\n\n"
        "1. Begin with the primary hexagram's overall meaning (Judgment and Image). "
        "Use the T'uan Chuan to explain the structural logic. Frame the interpretation "
        "as the Oracle speaking to the nature of the subject — what it is, what forces "
        "are at work, what dynamics are in play.\n"
        "2. Interpret each changing line in order from bottom to top, noting what stage "
        "of the process it represents. Use the Hsiang Chuan line commentary for structural "
        "reasoning. Each line reveals a facet of the subject's current state.\n"
        "3. Discuss the relating hexagram as the direction the situation moves toward. "
        "Use the Tsa Kua for a sharp characterization and the Hsu Kua for narrative context.\n"
        "4. If nuclear hexagram passages are provided, discuss the nuclear hexagram(s) "
        "as the hidden inner dynamic — what is really going on beneath the surface of "
        "this subject. Include the hexagram number in the heading.\n"
        "5. If Zong Gua (complement) passages are provided, conclude with the Zong Gua "
        "as the polar opposite — what this subject is NOT, and by contrast, what it "
        "fundamentally IS. Include the hexagram number in the heading.\n"
        "6. Do NOT include a Counsel section. The querent did not ask a question — "
        "they asked the Oracle to speak to a subject. End the reading with the final "
        "hexagram layer (Zong Gua, or nuclear if no Zong Gua is provided).\n\n"
        "Principles:\n"
        "- The Oracle speaks to the subject with authority, not as if answering a question.\n"
        "- Illuminate rather than advise. Describe the nature, dynamics, and trajectory.\n"
        "- Always start from the hexagram source texts. The Wings deepen and explain.\n"
        "- Use the T'uan Chuan and Hsiang Chuan as interpretive backbone.\n"
        "- Use trigram symbolism from the Shuo Kua when it enriches interpretation.\n"
        "- Speak with clarity, not mysticism.\n"
        "- Respect passage boundaries. Never conflate material from different hexagrams."
    )

    _prompts = {
        "yes_no": _YES_NO_PROMPT,
        "topic": _TOPIC_PROMPT,
    }
    base_prompt = _prompts.get(q_type, _OPEN_PROMPT)

    # Append key sections from the reading guide (not the full document — too large)
    if reading_guide:
        # Extract just the structural sections: line correspondences and four judgments
        sections_to_include = []
        for section_header in [
            "## 5. Line Correspondences and Structural Relationships",
            "## 6. The Four Judgments",
        ]:
            idx = reading_guide.find(section_header)
            if idx != -1:
                # Find the next ## heading or end of text
                next_section = reading_guide.find("\n## ", idx + len(section_header))
                section_text = reading_guide[idx:next_section] if next_section != -1 else reading_guide[idx:]
                sections_to_include.append(section_text.strip())

        if sections_to_include:
            base_prompt += (
                "\n\n--- Reference: Structural Relationships & Judgments ---\n"
                + "\n\n".join(sections_to_include)
            )

    return base_prompt


def _build_shuo_kua_context() -> str:
    """Load the essential trigram reference from the Shuo Kua (Chapter III).

    Skips the philosophical Chapters I and II to save context tokens.
    Chapter III contains the practical trigram symbols: attributes, animals,
    body parts, family relationships, and detailed symbolic associations.
    """
    shuo_kua = hexagram_text.get_shuo_kua()
    if not shuo_kua:
        return ""

    # Extract from Chapter III onwards (the practical trigram reference)
    ch3_marker = "#### CHAPTER III"
    ch3_idx = shuo_kua.find(ch3_marker)
    if ch3_idx != -1:
        trimmed = shuo_kua[ch3_idx:]
    else:
        # Fallback: try to find the attributes section directly
        attr_marker = "#### 7. The Attributes"
        attr_idx = shuo_kua.find(attr_marker)
        trimmed = shuo_kua[attr_idx:] if attr_idx != -1 else shuo_kua

    return (
        "\n\n--- Trigram Reference: Shuo Kua (Discussion of the Trigrams) ---\n"
        + trimmed
    )


def build_interpretation_prompt(
    cast: CastResult,
    passages: dict[str, list[dict]],
    question: str | None = None,
) -> list[dict]:
    """Build the LLM prompt for synthesizing a reading interpretation."""

    primary = cast.primary
    num_changing = len(cast.changing_lines)

    # Describe the cast situation
    if num_changing == 0:
        situation = "No lines are changing. The hexagram is stable — interpret only the primary hexagram."
    elif num_changing == 1:
        situation = f"One line is changing (line {cast.changing_lines[0]}). This is the focal point of the reading."
    elif num_changing <= 3:
        lines_str = ", ".join(str(l) for l in cast.changing_lines)
        situation = f"Lines {lines_str} are changing. Read them bottom to top as stages of the process."
    elif num_changing <= 5:
        lines_str = ", ".join(str(l) for l in cast.changing_lines)
        situation = f"Lines {lines_str} are changing — this indicates significant transformation and turbulence."
    else:
        situation = "All six lines are changing — a complete inversion. Focus on the relating hexagram as the primary message."

    # Build the context from retrieved passages — Layer 1 (hexagram text) + Layer 2 (Wings)
    context_parts = []

    # Primary hexagram
    context_parts.append(_passages_text(passages.get("primary", []),
                                        f"Hexagram {primary.king_wen} — {primary.name} / {primary.title}"))
    # Primary Wings (T'uan Chuan, Tsa Kua, Sequence)
    context_parts.append(_passages_text(passages.get("primary_wings", []),
                                        f"Wings — Hexagram {primary.king_wen} ({primary.name})"))

    # Changing lines (text + Wing commentary paired together)
    for line in sorted(cast.changing_lines):
        val = cast.line_values[line - 1]
        prefix = "Nine" if val == 9 else "Six"
        stage = LINE_STAGES.get(line, "")
        label = f"{prefix} in the {ORDINALS[line]} place (line {line} — {stage})"
        context_parts.append(_passages_text(passages.get(f"line_{line}", []), label))
        # Wing line commentary
        wing_label = f"Hsiang Chuan — {prefix} in the {ORDINALS[line]} place (line {line})"
        context_parts.append(_passages_text(passages.get(f"line_{line}_wings", []), wing_label))

    # Relating hexagram
    if cast.relating:
        rel = cast.relating
        context_parts.append(_passages_text(passages.get("relating", []),
                                            f"Relating Hexagram {rel.king_wen} — {rel.name} / {rel.title}"))
        context_parts.append(_passages_text(passages.get("relating_wings", []),
                                            f"Wings — Relating Hexagram {rel.king_wen} ({rel.name})"))

    # Nuclear hexagrams (hidden inner dynamic)
    if cast.nuclear:
        nuc = cast.nuclear
        context_parts.append(_passages_text(
            passages.get("nuclear_primary", []),
            f"Nuclear Hexagram of Primary — #{nuc.king_wen} {nuc.name} / {nuc.title} (hidden inner dynamic)",
        ))

    if passages.get("nuclear_relating") and cast.relating:
        rel_nuc = nuclear_hexagram(cast.relating.binary)
        if rel_nuc:
            context_parts.append(_passages_text(
                passages["nuclear_relating"],
                f"Nuclear Hexagram of Relating — #{rel_nuc.king_wen} {rel_nuc.name} / {rel_nuc.title} (hidden inner dynamic)",
            ))

    # Zong Gua (complement hexagram)
    if cast.zong_gua and passages.get("zong_gua"):
        zong = cast.zong_gua
        context_parts.append(_passages_text(
            passages["zong_gua"],
            f"Zong Gua (Complement) — #{zong.king_wen} {zong.name} / {zong.title} (polar opposite / shadow)",
        ))

    retrieved_text = "\n".join(p for p in context_parts if p.strip())

    # Classify question type
    q_type = classify_question(question)

    # Build system prompt with reading guide
    system_prompt = _build_system_prompt(q_type)

    # Add Shuo Kua as trigram reference context
    system_prompt += _build_shuo_kua_context()

    # Build user message
    user_content = f"Cast result:\n"
    user_content += f"Primary: Hexagram {primary.king_wen} — {primary.name} / {primary.title}\n"
    if cast.relating:
        user_content += f"Relating: Hexagram {cast.relating.king_wen} — {cast.relating.name} / {cast.relating.title}\n"
    user_content += f"Changing lines: {', '.join(str(l) for l in cast.changing_lines) or 'none'}\n"
    if cast.nuclear:
        user_content += f"Nuclear (primary): Hexagram {cast.nuclear.king_wen} — {cast.nuclear.name} / {cast.nuclear.title}\n"
    if cast.relating:
        rel_nuc = nuclear_hexagram(cast.relating.binary)
        if rel_nuc:
            user_content += f"Nuclear (relating): Hexagram {rel_nuc.king_wen} — {rel_nuc.name} / {rel_nuc.title}\n"
    if cast.zong_gua:
        user_content += f"Zong Gua (complement): Hexagram {cast.zong_gua.king_wen} — {cast.zong_gua.name} / {cast.zong_gua.title}\n"
    user_content += f"\n{situation}\n"

    if question:
        if q_type == "topic":
            user_content += f"\nThe subject of the reading: {question}\n"
        else:
            user_content += f"\nThe querent's question: {question}\n"

    user_content += f"\n--- Retrieved Source Passages ---\n{retrieved_text}\n"
    user_content += "\nPlease synthesize a reading interpretation from these passages."

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


async def synthesize_reading(
    cast: CastResult,
    passages: dict[str, list[dict]],
    question: str | None = None,
    model: str | None = None,
) -> str:
    """Use the LLM to synthesize a coherent reading from retrieved passages."""
    messages = build_interpretation_prompt(cast, passages, question)

    response = await llm_client.chat(
        messages=messages,
        temperature=0.7,
        max_tokens=config.get_max_tokens(model),
        model=model,
    )

    raw = response.choices[0].message.content
    clean, _ = llm_client.strip_think_blocks(raw)
    return clean


async def synthesize_reading_stream(
    cast: CastResult,
    passages: dict[str, list[dict]],
    question: str | None = None,
    model: str | None = None,
) -> AsyncIterator[tuple[str, str]]:
    """Stream LLM interpretation tokens with thinking classification.

    Yields (event_type, text) tuples where event_type is
    'thinking', 'thinking_done', or 'content'.
    """
    messages = build_interpretation_prompt(cast, passages, question)
    async for event_type, token in llm_client.chat_stream_with_thinking(
        messages=messages,
        temperature=0.7,
        max_tokens=config.get_max_tokens(model),
        model=model,
    ):
        yield event_type, token


def format_reading_header(cast: CastResult, question: str | None = None) -> str:
    """Format the cast details as a header for the reading display."""
    line_symbols = {
        6: "---x---  (old yin, changing)",
        7: "-------  (young yang)",
        8: "--- ---  (young yin)",
        9: "---o---  (old yang, changing)",
    }

    lines = []
    for i in range(5, -1, -1):  # top to bottom for display
        val = cast.line_values[i]
        marker = " <-" if (i + 1) in cast.changing_lines else ""
        lines.append(f"  Line {i+1}: {line_symbols[val]}{marker}")

    header = "\n".join(lines)
    if question:
        header = f"Question: {question}\n\n" + header

    primary = cast.primary
    header += f"\n\nPrimary: #{primary.king_wen} {primary.name} / {primary.title}"
    header += f"\n  Binary: {primary.binary}  |  Upper: {primary.upper_trigram}  |  Lower: {primary.lower_trigram}"

    if cast.relating:
        rel = cast.relating
        header += f"\n\nRelating: #{rel.king_wen} {rel.name} / {rel.title}"
        header += f"\n  Changing lines: {', '.join(str(l) for l in cast.changing_lines)}"
        header += f"\n  Change mask: {cast.change_mask}"
    else:
        header += "\n\nNo changing lines -- the situation is stable."

    if cast.nuclear:
        nuc = cast.nuclear
        header += f"\n\nNuclear (primary): #{nuc.king_wen} {nuc.name} / {nuc.title}"
    if cast.relating:
        rel_nuc = nuclear_hexagram(cast.relating.binary)
        if rel_nuc:
            header += f"\nNuclear (relating): #{rel_nuc.king_wen} {rel_nuc.name} / {rel_nuc.title}"

    if cast.zong_gua:
        zong = cast.zong_gua
        header += f"\nZong Gua (complement): #{zong.king_wen} {zong.name} / {zong.title}"

    return header
