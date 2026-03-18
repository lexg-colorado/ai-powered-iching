# AI-Powered I Ching: How Readings Work

This document traces the complete journey of an I Ching consultation — from the moment a user initiates a reading to the final interpretation appearing on screen. The app provides three interfaces (CLI REPL, CLI auto-cast, and Web UI), but they all converge on the same core pipeline: a CSPRNG-based coin oracle, two layers of classical source material, and a local LLM that synthesizes structurally grounded readings.

---

## 1. Initiating a Reading

There are three ways to consult the oracle:

| Interface | How to Start | What Happens |
|-----------|-------------|--------------|
| **CLI REPL** | Type `/cast [question]` | Interactive mode: choose auto or manual toss, build the hexagram line by line with visual feedback |
| **CLI Auto-Cast** | Run `iching -a -q "my question"` | Non-interactive: all six lines cast at once, reading streams to terminal |
| **Web UI** | Build a hexagram (coin animation, manual builder, or number entry), then click **Get Reading** | Hexagram sent to API server, reading streams back via Server-Sent Events |

All three paths feed into the same casting engine, passage assembler, and LLM synthesis pipeline.

---

## 2. The Three-Coin Method

The fundamental unit of divination is the three-coin toss, repeated six times (bottom line to top line) to build a hexagram.

Each coin is generated using Python's `secrets.choice` — a **cryptographically secure pseudo-random number generator** (CSPRNG), ensuring true unpredictability rather than the deterministic sequences of `random`.
conversely 
### Coin Values

Each coin face has a fixed numerical value:

- **Heads** = 3
- **Tails** = 2

Three coins are tossed. Their sum determines the line:

| Sum | Coins | Line Name | Symbol | Changing? | Meaning |
|-----|-------|-----------|--------|-----------|---------|
| **6** | TTT (0 heads) | Old Yin | `---x---` | Yes | Yin at its extreme — transforms into yang |
| **7** | HTT (1 head) | Young Yang | `-------` | No | Stable yang — holds its ground |
| **8** | HHT (2 heads) | Young Yin | `--- ---` | No | Stable yin — holds its ground |
| **9** | HHH (3 heads) | Old Yang | `---o---` | Yes | Yang at its extreme — transforms into yin |

The "old" lines (6 and 9) are where the action lives. They mark the points of instability — where the situation is actively transforming.

---

## 3. What the Cast Produces

Six line values (each 6, 7, 8, or 9) are passed to `build_cast_result()`, which computes the full structural picture:

### Primary Hexagram

The line values map to a 6-bit binary vector: yang values (7, 9) become `1`, yin values (6, 8) become `0`. This binary string is looked up in the **King Wen sequence** — the traditional ordering of the 64 hexagrams — to identify the primary hexagram.

The primary hexagram represents **the current situation**.

### Changing Lines

Any line with value 6 (old yin) or 9 (old yang) is a changing line. These are the specific points of instability in the reading — where transformation is actively occurring.

### Relating Hexagram

If changing lines exist, the relating hexagram is computed by **XOR**: flip every changing line. Old yin (6) becomes yang; old yang (9) becomes yin. The result is the hexagram the situation is **moving toward**.

Mathematically: `relating = primary XOR change_mask`

### Nuclear Hexagram (Hu Gua)

Derived from the primary hexagram's inner trigrams: lines 2-3-4 form the lower nuclear trigram, lines 3-4-5 form the upper. These combine into a new hexagram representing the **hidden inner dynamic** — the unconscious undercurrent beneath the surface of the situation.

### Zong Gua (Complement)

Every line inverted (bitwise NOT). The Zong Gua reveals what the situation fundamentally **IS** by showing what it is **NOT** — the polar opposite, the shadow.

### The CastResult

All of this is bundled into a single data structure:

```
CastResult:
  line_values:    [7, 8, 9, 7, 6, 8]     six values, bottom to top
  primary:        Hexagram 61 (Chung Fu)   the current situation
  changing_lines: [3, 5]                   where instability lives
  relating:       Hexagram 37 (Chia Jen)   where things are heading
  change_mask:    "010010"                 which lines flip
  nuclear:        Hexagram 27 (I)          hidden inner dynamic
  zong_gua:       Hexagram 62 (Hsiao Kuo)  polar opposite
```

---

## 4. Assembling the Source Material

The app draws from two distinct layers of classical text, both stored as structured markdown files:

### Layer 1: The Hexagram Files (`Data/Hexagrams/`)

Each of the 64 hexagram files contains:

- **Overview** — concise summary of the hexagram's theme
- **Judgment** — the core counsel: what to do, what attitude to hold
- **Image** — the natural image formed by the two trigrams and the conduct it suggests
- **The Lines** — individual texts for each of the six line positions

These are the primary source texts. Every reading begins here.

**What gets included for each component:**

| Component | Sections Used |
|-----------|--------------|
| Primary hexagram | Overview + Judgment + Image |
| Each changing line | Individual line text |
| Relating hexagram | Judgment + Image |
| Nuclear hexagram | Overview + Judgment |
| Zong Gua | Overview + Judgment |

### Layer 2: The Wing Commentaries (`Data/Wings/`)

The Wings are the classical commentaries that deepen and contextualize the hexagram texts. Each per-hexagram Wing file contains several commentaries from the Wilhelm/Baynes translation.

**What gets included for each component:**

| Component | Wing Sections Used | What They Provide |
|-----------|-------------------|-------------------|
| Primary hexagram | **T'uan Chuan** (Commentary on the Decision) | Structural logic of the Judgment: which lines are rulers, how trigrams interact, why the counsel is what it is |
| Primary hexagram | **Tsa Kua** (Miscellaneous Notes) | Terse, aphoristic characterization — anchors the reading |
| Primary hexagram | **Hsu Kua** (The Sequence) | Why this hexagram follows the previous one in the King Wen sequence — narrative context |
| Each changing line | **Hsiang Chuan** (Commentary on the Images — line section) | Structural reasoning behind each line's counsel: correspondences, character-place relationships, trigram positions |
| Relating hexagram | **Tsa Kua** + **Hsu Kua** | Essential character and narrative position of the outcome |

### System-Level Reference

Two additional reference documents are loaded into the LLM's system prompt:

- **Shuo Kua** (Discussion of the Trigrams), Chapter III — the master reference for trigram symbolism: attributes, animals, body parts, family relationships, cardinal directions, seasons. This is the symbolic vocabulary the original text draws from.
- **How to Do an I-Ching Reading** — structural reference covering line correspondences (which lines relate to each other across trigrams), character-place relationships (firm line in yielding place creates tension), and the Four Judgments (good fortune, misfortune, remorse, humiliation).

---

## 5. Constructing the LLM Prompt

The assembled passages and reference material are structured into a two-message prompt: one system message and one user message. The prompt varies significantly based on what the querent brought to the Oracle.

### Question Classification

Before building the prompt, the app classifies the querent's input using regex-based pattern matching in Python (no LLM call). The classifier runs through a priority-ordered chain of checks:

| Type | Detection | Examples | Reading Effect |
|------|-----------|----------|----------------|
| **`none`** | Empty or null input | *(no question provided)* | Pure divination — Oracle speaks freely, no Counsel section |
| **`yes_no`** | Starts with "should I", "will this", "is it", "can I", etc. | "Should I take the job?" | Direct Yes/No/Not Yet answer, skip nuclear and Zong Gua, focused Counsel |
| **`diagnostic`** | Contains keywords (blocking, stuck, breaking down, keeps happening) OR starts with "why" | "Why does this keep happening?", "What's blocking me?" | Full reading with structural tension analysis *(dedicated prompt planned)* |
| **`reflective`** | Starts with "what" + introspective keywords (not seeing, reveal, about me, focus on, need to learn) | "What am I not seeing?", "What should I focus on?" | Full reading with elevated inner-dynamic emphasis *(dedicated prompt planned)* |
| **`open`** | Starts with how, when, where, which, who, or "what" without reflective markers | "How should I approach this?" | Full 6-section reading with practical Counsel |
| **`topic`** | Default fallback — bare nouns, phrases, situations that aren't grammatical questions | "2026", "going to prom", "career change" | Oracle illuminates rather than advises — no Counsel section |

**Detection priority matters.** Diagnostic keywords are checked before wh-word routing, so "What is blocking me?" correctly classifies as diagnostic rather than open. "What should I focus on?" catches the reflective keyword "focus on" and routes to reflective rather than open. Bare phrases without question marks, wh-words, or verb starters fall through to topic.

### System Prompt Templates

Each question type selects a different system prompt template that instructs the LLM how to structure and frame the reading.

**Open readings** follow a six-part structure:

1. **Primary hexagram** — Judgment and Image, deepened by the T'uan Chuan's structural logic (ruler line, trigram interaction, why the Judgment counsels what it does)
2. **Changing lines** — bottom to top, with Hsiang Chuan reasoning for each line (correspondences, character-place relationships, position within the trigram)
3. **Relating hexagram** — direction of movement, anchored by Tsa Kua characterization and Hsu Kua narrative context
4. **Nuclear hexagram** — hidden inner dynamic beneath the surface
5. **Zong Gua** — polar opposite / shadow — what the situation is NOT
6. **Counsel** — direct, practical guidance addressing the querent's specific question

**Yes/no readings** use a compressed template: commit to Yes/No/Not Yet based on the Judgment's specific language, explain why using changing lines and relating hexagram, end with brief Counsel. Nuclear and Zong Gua are skipped for directness.

**Topic readings** use the full six-layer structure but with different framing: the Oracle speaks to the subject with authority rather than answering a question. The tone shifts from advising to illuminating — describing nature, dynamics, and trajectory. The user message says "The subject of the reading:" instead of "The querent's question:". No Counsel section.

**Diagnostic and reflective** readings are classified but currently use the open prompt. Their dedicated prompts (planned) will reframe the same structural layers: diagnostic readings will emphasize structural tension and root-cause identification through line correspondences; reflective readings will elevate the nuclear hexagram and Zong Gua as mirrors of the querent's inner state.

### System-Level Reference Context

All prompt templates are augmented with two reference sections appended to the system message:

- **Reading guide excerpts** — sections on line correspondences (which lines relate across trigrams, character-place tension, central lines) and the Four Judgments (good fortune, misfortune, remorse, humiliation) from `Data/How to Do an I-Ching Reading.md`
- **Shuo Kua Chapter III** — the practical trigram reference (attributes, symbolic animals, body parts, family relationships, detailed symbolic associations) from `Data/Wings/shuo_kua.md`. Chapters I-II (philosophical) are skipped to conserve context tokens.

### User Message

The user message contains:

1. **Cast details** — all hexagram numbers and names, changing line positions, structural relationships (nuclear, Zong Gua)
2. **Situation description** — adapts dynamically to the number of changing lines:
   - 0 lines: "The hexagram is stable — interpret only the primary hexagram"
   - 1 line: "This is the focal point of the reading"
   - 2-3 lines: "Read them bottom to top as stages of the process"
   - 4-5 lines: "Significant transformation and turbulence"
   - 6 lines: "Complete inversion — focus on the relating hexagram"
3. **The querent's input** — labeled as "question" (for open/yes_no/diagnostic/reflective) or "subject of the reading" (for topic)
4. **All retrieved passages** — Layer 1 (hexagram text) and Layer 2 (Wing commentaries) interleaved with clear section labels. Primary passages are followed by primary Wings, each changing line is paired with its Hsiang Chuan commentary, relating passages are followed by relating Wings.

---

## 6. Generating the Reading

### Model Auto-Detection

At startup, the app queries LM Studio's `/v1/models` endpoint and auto-detects the loaded model. Models with "embed" in their name are classified as embedding models; everything else is used for chat/synthesis. This means you can swap models in LM Studio without changing any configuration — just restart the app.

### Thinking Model Support

Some models (Qwen 3.x, DeepSeek-R1) emit internal reasoning before their actual response. The app detects these by name pattern and adapts:

- **Token budget**: 16,384 max tokens (vs. 4,096 for non-thinking models) to accommodate the reasoning overhead
- **Streaming parser**: A stateful classifier separates thinking tokens from content tokens. For LM Studio's Qwen 3 chat template (which implicitly prepends `<think>`), the parser starts in thinking mode and transitions to content mode at `</think>`
- **Non-thinking models**: All tokens pass through as content — zero overhead

### Streaming vs. Non-Streaming

Both paths are available:

- **Streaming** (used by CLI and Web UI): `chat_stream_with_thinking()` yields `(event_type, token)` tuples in real time
- **Non-streaming** (available via `/api/reading`): `synthesize_reading()` calls the LLM, strips think blocks, returns clean text

---

## 7. Delivering the Output

### CLI Display

The streaming loop prints thinking tokens in dim/grey styling in real time (so the user knows the model is working), then renders the accumulated content as a **Rich Markdown panel** with a green border:

```
Thinking...the hexagram shows a stable configuration with...

 ╭── Reading Interpretation ──────────────────────────────╮
 │                                                        │
 │  ## Hexagram 33: Tun / Retreat (Primary)              │
 │                                                        │
 │  **Judgment and Image** Retreat signifies strategic    │
 │  withdrawal and the wisdom of yielding to superior    │
 │  force...                                              │
 │                                                        │
 ╰────────────────────────────────────────────────────────╯
```

### Web UI — SSE Streaming

The API server wraps the pipeline in a **Server-Sent Events** stream with five event types:

| Event | Payload | When |
|-------|---------|------|
| `meta` | Cast details + formatted header | Immediately, before LLM starts |
| `thinking` | `{ text: "..." }` | During model's internal reasoning |
| `thinking_done` | `{}` | Reasoning complete |
| `token` | `{ text: "..." }` | Each content token |
| `done` | `{}` | Stream complete |

The frontend batches UI updates via `requestAnimationFrame` to avoid excessive re-renders during fast token streaming.

### Ghost Thinking Overlay

When a thinking model is active, the **GhostThinkingOverlay** component renders a fixed-position translucent overlay across the top 20% of the viewport:

- Thinking text appears at **12% opacity** in monospace font — visible as a ghostly shimmer but clearly secondary
- A pulsing dot and "The oracle is contemplating..." label indicate activity
- Only the last ~600 characters are shown (the text naturally scrolls)
- When thinking ends, the overlay **fades out** over 500ms
- The actual reading then streams into the interpretation area — right where the user is looking, no scrolling needed

---

## The Complete Data Flow

```
User initiates reading
    │
    ▼
┌─────────────────────────────────────────────────┐
│  CASTING (hexagram_lookup.py)                   │
│  secrets.choice CSPRNG × 3 coins × 6 lines     │
│  → six values (each 6/7/8/9)                    │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  CAST COMPUTATION (hexagram_lookup.py)           │
│  build_cast_result()                             │
│  → primary, relating, nuclear, zong gua,         │
│    changing lines, change mask                   │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  PASSAGE ASSEMBLY (hexagram_text.py)             │
│                                                  │
│  Layer 1: Data/Hexagrams/*.md                    │
│    Overview, Judgment, Image, Line texts          │
│                                                  │
│  Layer 2: Data/Wings/*.md                        │
│    T'uan Chuan, Tsa Kua, Hsu Kua,               │
│    Hsiang Chuan (line commentaries)              │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  PROMPT CONSTRUCTION (reading.py)                │
│                                                  │
│  System: interpretation structure +              │
│    reading guide + Shuo Kua trigram reference    │
│                                                  │
│  User: cast details + situation +                │
│    question + all passages (interleaved)         │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│  LLM SYNTHESIS (llm_client.py → LM Studio)      │
│                                                  │
│  Auto-detected local model                       │
│  Streaming with thinking/content classification  │
│  Dynamic max_tokens based on model type          │
└──────────┬───────────────────────┬──────────────┘
           │                       │
     CLI path                 Web path
           │                       │
           ▼                       ▼
┌──────────────────┐   ┌──────────────────────────┐
│  Rich terminal   │   │  SSE stream → browser    │
│  Dim thinking    │   │  Ghost overlay (thinking) │
│  Markdown panel  │   │  Streamed Markdown        │
│  (content)       │   │  (content)                │
└──────────────────┘   └──────────────────────────┘
```

---

## Key Design Principles

1. **CSPRNG over PRNG** — `secrets` module ensures genuine unpredictability, not reproducible sequences
2. **Two-layer source material** — hexagram texts provide the *what*; Wing commentaries explain the *why*
3. **Structural reasoning** — readings are grounded in line correspondences, character-place relationships, and trigram interactions, not vague mysticism
4. **Model-agnostic** — auto-detects whatever model is loaded in LM Studio; thinking model support is transparent
5. **Streaming-first** — both CLI and Web UI stream tokens in real time for responsive UX
6. **Passage boundaries respected** — source material from different hexagrams is never conflated
