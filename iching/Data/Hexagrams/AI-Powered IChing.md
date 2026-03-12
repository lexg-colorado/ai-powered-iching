
---

## How Readings Are Generated — The Full Pipeline

### Stage 1: The Cast

When you cast (via CLI, REPL, or Web UI), `build_cast_result()` in `hexagram_lookup.py` takes your 6 line values (each 6/7/8/9) and computes everything:

- **Primary hexagram** — looked up from the binary pattern of your cast
- **Changing lines** — which lines are "old" (6 or 9) and will flip
- **Relating hexagram** — the primary with all changing lines inverted (XOR with the change mask)
- **Nuclear hexagram (Hu Gua)** — inner trigrams: lines 2-3-4 form the lower, 3-4-5 form the upper
- **Zong Gua (complement)** — every line inverted (bitwise NOT of the primary's binary)

This `CastResult` is the structural foundation — it tells the system _what_ to look up.

### Stage 2: Passage Retrieval

`retrieve_reading_passages()` in `reading.py` gathers the source material. There are **two retrieval paths**:

**Path A — Markdown files (default, `use_markdown=True`):** Delegates to `hexagram_text.py`, which parses the 64 structured markdown files in `Data/Hexagrams/`. Each file has the same structure (like that Hexagram 36 file): Overview, Judgment, Image, and The Lines (with ### subsections for each line position). This path is **deterministic** — no embeddings, no vector search, no cross-hexagram contamination.

**Path B — ChromaDB vector search (`use_markdown=False`):** Queries ChromaDB with natural language strings like `"hexagram 36 Darkening of the Light judgment image overall meaning"`. Uses metadata filters (`hexagram_number`) to scope results, then post-filters by hexagram number and deduplicates via Jaccard similarity (threshold 0.7). Includes fallbacks: if the metadata-filtered query returns nothing, retries without the metadata filter but still post-filters.

**What gets retrieved (6 categories):**

|Key|What|Sections pulled|
|---|---|---|
|`primary`|The cast hexagram|Overview + Judgment + Image|
|`line_N`|Each changing line|Individual line text|
|`relating`|The transformation target|Judgment + Image|
|`nuclear_primary`|Hidden dynamic of primary|Overview + Judgment|
|`nuclear_relating`|Hidden dynamic of relating|Overview + Judgment (only if it differs from primary's nuclear)|
|`zong_gua`|Complement/shadow|Overview + Judgment|

### Stage 3: Prompt Construction

`build_interpretation_prompt()` builds a two-message prompt (system + user):

**The system prompt** defines the LLM's role and reading structure:

1. Begin with the primary hexagram's Judgment and Image
2. Interpret each changing line bottom-to-top, noting what stage it represents
3. Discuss the relating hexagram as the direction the situation moves toward
4. Nuclear hexagrams as the hidden inner dynamic / unconscious undercurrent
5. Zong Gua as the polar opposite / shadow that reveals what the situation fundamentally IS by showing what it is NOT

It also instructs: use the passages as source material, speak with clarity not mysticism, stay grounded and practical.

**The user message** has three parts:

**Part 1 — Cast summary:**

```
Primary: Hexagram 36 -- Ming I / Darkening of the Light
Relating: Hexagram 55 -- Feng / Abundance
Changing lines: 1, 3
Nuclear (primary): Hexagram 40 -- Hsieh / Deliverance
Zong Gua (complement): Hexagram 6 -- Sung / Conflict
```

**Part 2 — Situational framing** (varies by number of changing lines):

- 0 lines: "The hexagram is stable"
- 1 line: "This is the focal point"
- 2-3 lines: "Read them bottom to top as stages"
- 4-5 lines: "Significant transformation and turbulence"
- 6 lines: "Complete inversion — focus on the relating hexagram"

Plus the querent's question if provided.

**Part 3 — All retrieved passages**, formatted as labeled blocks:

```
--- Hexagram 36 -- Ming I / Darkening of the Light ---
[overview + judgment + image text]

--- Nine in the first place (line 1 -- beginning) ---
[line 1 text]

--- Nine in the third place (line 3 -- difficulty / transition) ---
[line 3 text]

--- Relating Hexagram 55 -- Feng / Abundance ---
[judgment + image text]

--- Nuclear Hexagram of Primary -- #40 Hsieh / Deliverance (hidden inner dynamic) ---
[overview + judgment text]

--- Zong Gua (Complement) -- #6 Sung / Conflict (polar opposite / shadow) ---
[overview + judgment text]
```

Each passage block is capped at 800 characters. The line labels include symbolic meanings from `LINE_STAGES` (e.g., line 1 = "beginning", line 3 = "difficulty / transition", line 5 = "authority / center").

### Stage 4: LLM Synthesis

The assembled prompt goes to `llm_client.chat()` (or `chat_stream()` for the web UI):

- **Model:** `qwen2.5-14b-instruct` via LM Studio
- **Temperature:** 0.7
- **Max tokens:** 2048

The LLM weaves the passages into a cohesive narrative following the prescribed structure. For the Web UI, tokens stream via SSE; for the CLI, the full response is returned at once.

### What Makes a Good vs. Bad Reading

The quality hinges on the **passage retrieval layer**. The markdown path gives clean, consistent source text. The ChromaDB path can suffer from cross-hexagram contamination (retrieving passages from the wrong hexagram) — that's why there are metadata filters, post-filtering by hexagram number, and Jaccard deduplication.

The **situational framing** also matters — it tells the LLM how many lines are changing and what that means structurally, so it knows whether to focus on the primary, the transition, or the relating hexagram.