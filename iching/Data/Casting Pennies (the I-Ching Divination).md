The **three-coin method** is a simple way to generate a hexagram for the **I Ching**. Using three coins (like U.S. pennies), each toss produces **one line** of the hexagram. Repeating the toss **six times** builds the full figure from **bottom to top**.

Below is the method step-by-step, including the mathematical interpretation.

---

# 1. Assign Numerical Values to the Coins

Traditionally:

|Coin Side|Value|
|---|---|
|Heads|3|
|Tails|2|

You toss **three coins** and **add the values**.

Possible totals:

|Coins|Total|Line Type|
|---|---|---|
|TTT|6|Old Yin (changing)|
|HTT|7|Young Yang|
|HHT|8|Young Yin|
|HHH|9|Old Yang (changing)|

---

# 2. Interpret the Resulting Line

Each total maps to a line in the hexagram.

|Total|Line|Binary|Changes?|
|---|---|---|---|
|6|broken (yin)|0|yes|
|7|solid (yang)|1|no|
|8|broken (yin)|0|no|
|9|solid (yang)|1|yes|

So mathematically:

```text
yang = 1
yin = 0
```

But **6 and 9 are flagged as changing lines**.

---

# 3. Build the Hexagram

You repeat the coin toss **six times**.

Important rule:

- **First toss = bottom line**
    
- **Sixth toss = top line**
    

So after six throws you get a vector:

```text
(b1, b2, b3, b4, b5, b6)
```

where:

- b1 = bottom line
    
- b6 = top line
    

This becomes the **primary hexagram**.

---

# 4. Identify Changing Lines

If a toss produced:

- **6 (old yin)** → that line flips to yang
    
- **9 (old yang)** → that line flips to yin
    

Mathematically:

```text
0 → 1
1 → 0
```

These flips generate the **second hexagram**.

Equivalent binary operation:

```text
result_hexagram = primary_hexagram XOR change_mask
```

---

# 5. Example Cast

Suppose the six tosses produce:

|Toss|Coins|Total|Line|
|---|---|---|---|
|1|HHT|8|yin|
|2|HTT|7|yang|
|3|TTT|6|changing yin|
|4|HHT|8|yin|
|5|HTT|7|yang|
|6|HHH|9|changing yang|

Primary hexagram (bottom → top):

```text
0 1 0 0 1 1
```

Changing lines:

```text
line 3
line 6
```

After flipping:

```text
0 1 1 0 1 0
```

So the reading consists of:

1. primary hexagram meaning
    
2. line 3 text
    
3. line 6 text
    
4. resulting hexagram meaning
    

---

# 6. Probabilities (Important)

With three coins there are **8 equally likely outcomes**.

|Result|Probability|
|---|---|
|6|1/8|
|7|3/8|
|8|3/8|
|9|1/8|

So:

- **changing lines occur 25% of the time**
    
- most lines are stable.
    

This differs from the traditional **Yarrow Stalk Method**, which produces a different probability distribution.

---

# 7. Mathematical Summary

A full casting process produces:

```text
primary_hexagram  = binary vector of 6 lines
change_mask       = vector marking lines with 6 or 9
result_hexagram   = primary XOR change_mask
```

Interpretation reads:

1. the primary hexagram
    
2. the changing line texts
    
3. the resulting hexagram
    

---
