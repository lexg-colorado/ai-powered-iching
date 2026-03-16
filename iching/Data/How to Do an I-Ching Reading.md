# How to Do an I-Ching Reading

This document is the primary reference for the local AI when generating I Ching readings. It covers the structural anatomy of a reading, the source layers that inform interpretation, and how the Wings deepen every stage of the process.

---

## 1. What a Reading Consists Of

A single cast produces three structural elements: 
```
Primary hexagram   →  the current situation
Changing lines     →  where instability and movement live
Relating hexagram  →  the direction the situation is moving toward
```

Additionally, the pipeline computes:

- **Nuclear hexagram (Hu Gua)** — the hidden inner dynamic (lines 2-3-4 form the lower trigram, 3-4-5 form the upper)
- **Zong Gua (complement)** — the polar opposite (bitwise NOT of the primary), revealing what the situation fundamentally IS by showing what it is NOT

Mathematically:

```
primary_hexagram  = 6-bit binary vector from the cast
change_mask       = vector marking lines with value 6 or 9
relating_hexagram = primary XOR change_mask
```

The meaning of a reading lies not just in the endpoints but in the **transition path** between them.

---

## 2. Source Layers for Interpretation

A thorough reading draws from two distinct layers of source material. Both are available in the knowledge base and should be used together.

### Layer 1: The Hexagram Files (`Data/Hexagrams/`)

Each of the 64 hexagram markdown files contains:

- **Overview** — a concise summary of the hexagram's theme and situation
- **Judgment** — the core counsel: what to do, what attitude to hold
- **Image** — the natural image formed by the two trigrams and the conduct it suggests
- **The Lines** — individual line texts for each of the six positions

These are the primary source texts. Every reading begins here.

### Layer 2: The Wing Files (`Data/Wings/`)

The Wings are the classical commentaries that deepen and contextualize the hexagram texts. Each per-hexagram Wing file (e.g., `Wings/59_dispersion.md`) contains several commentaries. There are also five standalone Wing documents that apply across all hexagrams.

The Wings most directly useful for generating readings are:

| Wing | What It Provides | When to Use It |
|------|-----------------|----------------|
| **T'uan Chuan** (Commentary on the Decision) | Explains *why* the Judgment says what it says — traces the structural logic of the hexagram: which lines are rulers, how the trigrams interact, what the firm and yielding elements are doing | Always — it is the interpretive backbone of the Judgment |
| **Hsiang Chuan** (Commentary on the Images) | Two parts: the Image commentary (on the hexagram as a whole) and the Line commentaries (on each individual line) — explains the symbolic logic behind the Image and gives the reasoning behind each line's counsel | Always — it grounds line-level interpretation in structural reasoning |
| **Shuo Kua** (Discussion of the Trigrams) | The master reference for trigram symbolism: attributes, animals, body parts, family relationships, cardinal directions, seasons, and the Primal vs. Inner-World Arrangements | When interpreting trigram interactions, when explaining *why* a hexagram's image works the way it does, and when the natural symbolism of the trigrams enriches the reading |
| **Hsu Kua** (Sequence of the Hexagrams) | Explains why each hexagram follows the one before it in the King Wen sequence — provides narrative logic connecting hexagrams as stages in a larger process | When contextualizing the primary or relating hexagram within the larger arc of the I Ching's narrative; especially useful when the sequence relationship between the primary and relating hexagram is meaningful |
| **Tsa Kua** (Miscellaneous Notes) | Terse, aphoristic characterizations of each hexagram, often highlighting the essential contrast between paired hexagrams and noting structural features (nuclear trigrams, movement directions) | When a sharp one-line characterization helps anchor the reading, or when the paired-hexagram contrast is illuminating |

---

## 3. The Anatomy of a Reading, Step by Step

### Step 1 — The Primary Hexagram: Establishing the Situation

Read the **Overview**, **Judgment**, and **Image** from the hexagram file.

Then deepen with the Wings:

- **T'uan Chuan** — Look at *which lines are structurally significant*. The Commentary on the Decision identifies the ruler of the hexagram (often the fifth line, but not always), explains the interaction between the two primary trigrams, and reveals why the Judgment counsels what it does. For example, in Hexagram 59 (Dispersion), the T'uan Chuan explains that the firm nine in the second place "comes and does not exhaust itself" — it provides an inexhaustible basis for action. The yielding six in the fourth place "receives a place without and acts in harmony with the one above." These structural relationships *are* the meaning.

- **Hsiang Chuan (Image section)** — The Image commentary explains the symbolic logic of the trigram pairing. Wind over Water is not just a label; the Commentary explains that wind driving over water evokes the ancient kings' practice of sacrifice and temple-building — using spiritual means to hold together what is outwardly dispersing. This transforms a simple nature image into interpretive guidance.

- **Shuo Kua** — Draw on trigram attributes to enrich the interpretation. The eight trigrams carry dense symbolic networks:
  - **Ch'ien (Creative):** heaven, father, strength, horse, head, jade, deep red, the prince, roundness
  - **K'un (Receptive):** earth, mother, yielding, cow, belly, cloth, the multitude, black
  - **Chên (Arousing):** thunder, eldest son, movement, dragon, foot, dark yellow, bamboo
  - **Sun (Gentle):** wind/wood, eldest daughter, penetration, cock, thighs, white, the long
  - **K'an (Abysmal):** water, middle son, danger, pig, ear, blood, ditches, the moon, melancholy
  - **Li (Clinging):** fire/sun, middle daughter, brightness/dependence, pheasant, eye, dryness, weapons
  - **Kên (Keeping Still):** mountain, youngest son, stopping, dog, hand, gates, fruits and seeds
  - **Tui (Joyous):** lake, youngest daughter, pleasure, sheep, mouth, sorceress, smashing and breaking apart, autumn

  These associations are not decorative — they are the symbolic vocabulary the original text draws from. When a hexagram's line text mentions a horse, a well, a gate, or blood, the Shuo Kua is the key to understanding why.

- **Hsu Kua** — Note where the hexagram sits in the King Wen sequence. What came before it and why? For Hexagram 59: "After joy comes dispersal." This one sentence from the Sequence frames the entire hexagram — dispersion is what happens *after* the joyousness of Hexagram 58 (The Joyous) reaches its natural limit. This context helps the AI explain the *why* behind the situation, not just the *what*.

- **Tsa Kua** — If the Miscellaneous Notes offer a sharp characterization or a structural insight, use it. For Hexagram 59, the Tsa Kua notes that the hexagram has a "double meaning" — the breaking up of ice and rigidity (wind over water) AND penetration (Sun penetrating into K'an). It also connects the image of wood over water to the invention of boats, suggesting that dispersion is not merely loss but the creation of new means of communication and connection.

### Step 2 — The Changing Lines: Where Transformation Happens

Changing lines are the **specific points of instability** in the situation. They are read bottom to top, representing stages in the process.

The six line positions carry inherent symbolic meaning:

| Line | Position | Symbolic Role |
|------|----------|--------------|
| 1 | Bottom | Beginning — the situation is just forming; potential, not yet manifest |
| 2 | Lower inner | Development — gaining footing; the place of the official or the devoted |
| 3 | Top of lower trigram | Difficulty / transition — caught between inner and outer worlds; the most dangerous position |
| 4 | Bottom of upper trigram | Emerging awareness — entering the outer realm; proximity to authority; the minister's position |
| 5 | Upper inner | Authority / center — the ruler's place; the position of greatest influence and responsibility |
| 6 | Top | Completion / excess — the end of the process; things may have gone too far, or the sage withdraws |

For each changing line:

1. **Read the line text** from the hexagram file.
2. **Read the Hsiang Chuan line commentary** from the Wing file — this explains the *structural reason* the line says what it says. It identifies correspondences (which lines relate to each other), the relationship between the line's character (firm or yielding) and its place (strong or weak position), and the line's function within the trigram.
3. **Consider the line's position** in the symbolic framework above. A changing line in the third position inherently carries the theme of difficulty and transition, regardless of the hexagram. A changing line in the fifth position involves questions of authority and central responsibility.
4. **Note the character-place relationship.** A yielding line in a strong place (e.g., six in the third) or a firm line in a weak place (e.g., nine in the fourth) creates tension that often explains the line's counsel. The Hsiang Chuan frequently highlights this.

**Framing based on number of changing lines:**

- **0 lines changing:** The hexagram is stable. Focus entirely on the primary hexagram. The situation is settled; the counsel applies as stated.
- **1 line changing:** This is the focal point — the single point of instability concentrates all the reading's dynamic energy.
- **2–3 lines changing:** Read them bottom to top as stages in a process. The situation is in motion but navigable.
- **4–5 lines changing:** Significant transformation and turbulence. The relating hexagram begins to carry more weight than the primary.
- **6 lines changing:** Complete inversion. Focus on the relating hexagram as the destination; the primary represents what is being entirely left behind.

### Step 3 — The Relating Hexagram: Where Things Are Moving

The relating hexagram is the **result state** — the new configuration after all changing lines have flipped.

Read its **Judgment** and **Image** from the hexagram file. Then:

- **T'uan Chuan** — Understand the structural logic of this new state. What makes it stable or unstable? Which lines are its rulers?
- **Hsu Kua** — Where does this hexagram sit in the sequence? What does it naturally follow from and lead to? This positions the outcome within the larger narrative arc.
- **Tsa Kua** — Does the Miscellaneous Notes entry reveal something about the essential character of this outcome that the Judgment alone doesn't convey?

The relating hexagram represents the **new equilibrium** — the direction the system moves toward after the instability of the changing lines resolves.

### Step 4 — The Nuclear Hexagram: The Hidden Inner Dynamic

The nuclear hexagram (Hu Gua) is derived from the inner lines of the primary hexagram. It represents the **unconscious undercurrent** — what is really going on beneath the surface of the situation.

Read its **Overview** and **Judgment**. When the nuclear hexagram's theme illuminates something the primary hexagram's surface meaning doesn't address directly, draw it into the interpretation as a deeper layer.

### Step 5 — The Zong Gua: The Shadow

The Zong Gua (complement) is the bitwise inversion of the primary hexagram — every yang line becomes yin and vice versa. It represents the **polar opposite** of the situation.

Read its **Overview** and **Judgment**. The Zong Gua reveals what the situation fundamentally IS by showing what it is NOT. If the primary is Dispersion (scattering, letting go), the complement might reveal the shadow of rigidity or hoarding that the situation is specifically moving away from.

### Step 6 — Synthesis

Weave the layers together into a coherent narrative:

1. **Establish the situation** from the primary hexagram, grounded in the structural logic of the T'uan Chuan and enriched by trigram symbolism from the Shuo Kua.
2. **Walk through the changing lines** bottom to top, using the Hsiang Chuan to explain *why* each line counsels what it does — not just *what* it says.
3. **Show the direction of movement** through the relating hexagram, contextualized by its position in the King Wen sequence (Hsu Kua).
4. **Surface the hidden dynamic** through the nuclear hexagram.
5. **Illuminate the shadow** through the Zong Gua.

The goal is a reading that is grounded, practical, and structurally sound — one that uses the classical commentaries to deepen interpretation rather than floating in vague mysticism.

---

## 4. The Trigram Pairs and Their Interactions

Every hexagram is formed by two trigrams: a lower (inner) and an upper (outer). The Shuo Kua establishes two fundamental arrangements of the trigrams:

### The Primal Arrangement (Fu Hsi / Earlier Heaven)

This represents the **ideal, archetypal order** — the world of pure principles. The trigrams are arranged as pairs of opposites:

- Heaven (Ch'ien) and Earth (K'un) determine the north-south axis
- Mountain (Kên) and Lake (Tui) — their forces are united; wind blows from mountain to lake, mists rise from lake to mountain
- Thunder (Chên) and Wind (Sun) — they strengthen each other
- Fire (Li) and Water (K'an) — irreconcilable in the phenomenal world, they balance each other in the primal order

### The Inner-World Arrangement (King Wen / Later Heaven)

This represents the **phenomenal world** — the cycle of seasons and manifest reality:

- **Chên (east, spring):** God comes forth — arousing, beginning
- **Sun (southeast):** Completion — beings flow into their forms
- **Li (south, summer):** Brightness — creatures perceive one another; the ruler governs turned toward the light
- **K'un (southwest):** Nourishment — the earth provides for all
- **Tui (west, autumn):** Joy — the harvest, the fruition of the year
- **Ch'ien (northwest):** Battle — the dark and the light arouse each other; judgment
- **K'an (north, winter):** Toil — concentration, the gathering of reserves
- **Kên (northeast):** Perfection — the mysterious place where end and beginning meet; death and resurrection

When interpreting a hexagram, the Inner-World Arrangement should be seen as **transparent, with the Primal Arrangement shining through it**. This is the Shuo Kua's own instruction. The phenomenal world is grounded in the archetypal order.

### The Three Powers in a Hexagram

The six lines of a hexagram represent three cosmic principles, each allocated two lines:

| Lines | Power | Domain |
|-------|-------|--------|
| 1–2 | Earth | The material, the given conditions |
| 3–4 | Man | The human realm, choice, action |
| 5–6 | Heaven | The spiritual, fate, the overarching order |

This framework from the Shuo Kua helps explain why line 3 (top of Earth, entering Man) is the position of difficulty and transition, and why line 5 (center of Heaven) is the position of the ruler.

---

## 5. Line Correspondences and Structural Relationships

The Wing commentaries (especially the Hsiang Chuan and T'uan Chuan) frequently refer to structural relationships between lines. Understanding these is essential for interpreting line texts accurately:

### Correspondence

Lines in matching positions of the lower and upper trigrams are said to *correspond*:
- Line 1 corresponds with Line 4
- Line 2 corresponds with Line 5
- Line 3 corresponds with Line 6

A correspondence is **favorable** when one line is firm and the other yielding — they complement each other. When both are the same type, the correspondence is weak or conflicted.

### Central Lines

The middle line of each trigram (lines 2 and 5) holds the **central** position. Central lines are inherently moderate and balanced, which is generally favorable. The T'uan Chuan often identifies the ruler of the hexagram as the central line — usually the five, but sometimes the two.

### Character and Place

Each position has an inherent character:
- Odd positions (1, 3, 5) are **strong** places — favorable for firm (yang) lines
- Even positions (2, 4, 6) are **yielding** places — favorable for yielding (yin) lines

When a line's character matches its place, the line is said to be **correct**. When it doesn't match, there is tension — which may be productive or problematic depending on the hexagram's overall theme.

### Holding Together and Receiving

Adjacent lines can be in a relationship of *holding together* (when firm and yielding are next to each other and support each other) or *receiving* (when a yielding line below a firm line accepts its influence). These relationships are frequently referenced in the Hsiang Chuan line commentaries.

---

## 6. The Four Judgments

The Ta Chuan (Great Treatise) establishes four categories of judgment that appear throughout the line texts:

| Judgment | Meaning | Implication |
|----------|---------|-------------|
| **Good fortune** | The trend is in harmony with cosmic law | Gain; proceed with confidence |
| **Misfortune** | The trend opposes cosmic law | Loss; change course |
| **Remorse** | A deviation has occurred, but sorrow leads to correction | Turn back — there is still time |
| **Humiliation** | A deviation has occurred, and heedlessness prevents correction | Forethought is needed — the wrong path continues |

A fifth category, **"No blame,"** means that a mistake has been made but can be corrected in the right way. Mistakes are compared to rents in a garment: when mended, the garment is whole again.

These are not merely labels. The Ta Chuan explains that **remorse and humiliation arise at the borderline** — the point where good or evil has begun to stir in the mind but has not yet crossed into action. Recognizing this threshold is the key to the counsel these judgments carry.

---

## 7. Walkthrough Example

If a cast produced:

- **Primary hexagram:** Hexagram 59 — Dispersion (Huan)
- **Changing lines:** 3 and 6
- **Relating hexagram:** Hexagram 48 — The Well (Jing)

### Primary Hexagram (59 — Dispersion)

**From the hexagram file:** Wind over Water. Dissolution of obstacles, scattering of what has become rigid. Progress comes through letting go.

**From the T'uan Chuan:** The firm nine in the second place "comes and does not exhaust itself" — it is the inexhaustible engine of the hexagram. The six in the fourth place receives a place in the outer trigram and acts in harmony with the ruler (nine in the fifth). The king approaches his temple — the five's central position enables him to hold together what is dispersing. Crossing the great water derives from Sun (wood) over K'an (water).

**From the Hsu Kua:** "After joy comes dispersal." Dispersion follows The Joyous (58) — this is what happens when joy reaches its natural limit and must scatter to renew.

**From the Shuo Kua:** Sun (wind/wood) is penetrating, reaching everywhere; K'an (water) is dangerous, melancholy, the element that flows to the lowest point. Together they produce the image of wind dispersing stagnant water — or wood floating on water (the boat that makes communication possible despite distance).

### Changing Lines

**Line 3 — "He dissolves his self. No remorse."**

From the Hsiang Chuan: "His will is directed outward." This is a weak line in a strong place — normally cause for remorse. But it is the only line of the inner trigram in correspondence with the outer trigram. At the top of K'an (water), it is in direct contact with Sun (wind). The structural logic is clear: dissolving one's own ego or attachment is the *correct* response at this transition point, because the line's correspondence pulls it outward toward resolution.

**Line 6 — "He dissolves his blood. Departing, keeping at a distance, going out, is without blame."**

From the Hsiang Chuan: "Thus he keeps at a distance from injury." K'an is blood. Wind dissolves. At the extreme top of the hexagram, the process of dispersion reaches its final stage: even danger itself (blood, the symbol of K'an) is dissolved. The line not only resolves its own peril but helps the six in the third place, to which it corresponds.

### Relating Hexagram (48 — The Well)

**From the hexagram file:** Water over Wind. A stable, shared resource. Returning to fundamentals, drawing from deep sources, renewing something essential.

**From the Tsa Kua:** "THE WELL means union." And: "THE WELL abides in its place, yet has influence on other things." Character must have a deep foundation and a lasting connection with the springs of life.

**From the Hsu Kua:** "He who is oppressed above is sure to turn downward." The Well follows Oppression (47) — after being pressed from above, one turns to the deep source below.

### Synthesis

The situation involves something tense or congested that needs to dissolve (59 — Dispersion). The Sequence tells us this follows a period of joy that has run its course. The T'uan Chuan reveals that the hexagram's power lies in the inexhaustible firmness of the second line and the ruler's ability to hold the center while allowing the periphery to scatter.

The two changing lines trace a process: at line 3, the obstacle is personal — dissolving one's own attachment is what allows the transition from inner to outer. At line 6, the dispersion reaches completion — even danger itself is dissolved, and distance from what once threatened brings safety.

After this clearing, the situation stabilizes into The Well (48): something deep, enduring, and nourishing. The Tsa Kua's characterization — "THE WELL abides in its place, yet has influence on other things" — captures the outcome precisely. What remains after dispersion is not emptiness but a stable source that serves everyone who approaches it.

---

## 8. Principles for AI-Generated Readings

1. **Always start from the source texts.** The hexagram files are the primary layer; the Wings deepen and explain.

2. **Use the T'uan Chuan and Hsiang Chuan as interpretive backbone.** They explain *why* the Judgment and lines say what they say. A reading that includes this structural reasoning is stronger than one that merely paraphrases the Judgment.

3. **Draw on the Shuo Kua for trigram symbolism.** When the text mentions natural images — wind, water, mountains, thunder — the Shuo Kua provides the symbolic network that makes those images meaningful. Use it to explain the *Image* section and to enrich line interpretations where trigram symbolism is relevant.

4. **Use the Hsu Kua for narrative context.** The Sequence positions every hexagram within a larger story. Knowing what came before and what follows enriches the interpretation, especially when explaining *why* the querent is in this particular situation.

5. **Use the Tsa Kua for precision.** The Miscellaneous Notes often capture the essential character of a hexagram in a single phrase. These terse characterizations can anchor a reading or highlight a key contrast.

6. **Respect the structural logic.** Correspondences, central positions, character-place relationships — these are not abstract technicalities. They are the grammar of the I Ching. The Wing commentaries use them constantly, and readings that reflect this structural awareness are more accurate and more useful.

7. **Speak with clarity, not mysticism.** The Wings themselves are analytical and precise. Follow their example. Ground interpretations in practical counsel. Explain the reasoning. The I Ching is a tool for understanding situations and making decisions — treat it that way.

8. **Respect passage boundaries.** When retrieving text from the hexagram and Wing files, do not conflate material from different hexagrams. Each hexagram's source material is self-contained. Cross-hexagram contamination degrades the reading.

---
