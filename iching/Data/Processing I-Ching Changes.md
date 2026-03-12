In the **I Ching**, a _change_ occurs when one or more lines in a hexagram **flip polarity**:

- **Yang (solid line)** → becomes **Yin (broken line)**
    
- **Yin (broken line)** → becomes **Yang (solid line)**
    

Mathematically, this maps very cleanly onto **binary operations**.

---

# 1. Binary Representation of Lines

Each hexagram has **6 lines**.

We encode them as bits:

|Line Type|Binary|
|---|---|
|Yang (—)|1|
|Yin (-- --)|0|

Lines are usually indexed:

- **Line 1 = bottom**
    
- **Line 6 = top**
    

So a hexagram becomes a **6-bit binary number**.

Example:

```
Hexagram = b1 b2 b3 b4 b5 b6
(bottom → top)
```

---

# 2. Line Changes = Bit Flips

A changing line simply means:

```
0 → 1
1 → 0
```

Mathematically this is a **bit inversion**.

Two common representations:

### XOR operation

```
new_hexagram = original_hexagram XOR change_mask
```

Where:

- **change_mask** = binary pattern marking which lines change.
    

Example:

```
original  = 100000
mask      = 101001
result    = 001001
```

Each **1 in the mask flips that line**.

---

# 3. Change Masks

Each possible pattern of changing lines corresponds to a **6-bit mask**.

Examples:

|Changing Lines|Mask|
|---|---|
|line 1|000001|
|line 3|000100|
|line 6|100000|
|lines 1 & 6|100001|
|lines 1,3,6|101001|

General rule:

```
mask = Σ 2^(line-1)
```

for every changing line.

---

# 4. Complement Operation (All Lines Change)

If **all six lines change**, we get the **bitwise NOT**:

```
new_hexagram = NOT(original)
```

Example:

```
111111 → 000000
```

This is the transformation between:

- **Hexagram 1 – The Creative**
    
- **Hexagram 2 – The Receptive**
    

---

# 5. Vector Space Interpretation

Mathematically, hexagrams form a **6-dimensional binary vector space**:

```
V = GF(2)^6
```

Where:

- GF(2) = binary arithmetic (0/1)
    
- each hexagram = vector
    

Changes correspond to **vector addition modulo 2**.

Example:

```
h₂ = h₁ + change_vector  (mod 2)
```

Addition rules:

```
0+0=0
1+0=1
0+1=1
1+1=0
```

That is exactly **XOR**.

---

# 6. Distance Between Hexagrams

We can measure change using **Hamming distance**:

```
distance(h1,h2) = number of differing lines
```

Examples:

|Transition|Distance|
|---|---|
|one line change|1|
|three line change|3|
|full inversion|6|

---
