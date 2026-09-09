# bluff-catcher — settled product decisions

The single source of truth for what we are building. Every implementation subagent
reads this first. Do **not** re-litigate anything here; if a decision needs changing,
raise it with the owner and update this file.

The design reference lives in `../design_handoff_runout/` — read its `README.md` for the
pixel spec, and `design/Runout.dc.html`'s `<script data-dc-script>` block for the
reference logic. That HTML runtime is **not** to be ported; recreate in React.

## What it is

An odds **drill** (not a game): deal a random poker spot (hero hole cards + flop, or
+ turn) → the hand-read is **hidden** → the player taps a 0–100 rail to commit a single
percentage guess for "chance you improve by the river" → the true number + the hand read
reveal immediately, scored green/amber/red → a `?` sheet teaches the **rule of 2 and 4**
(outs × 4 on the flop, × 2 on the turn) plus the "subtract outs above 8" correction.

No chips, no betting, no villain range, no showdown, no exact combinatorics on screen.

## Stack

- **React + TypeScript + Vite.** Strict TS.
- **vitest** for unit tests (odds engine + classifier).
- **Installable PWA** via `vite-plugin-pwa` (web manifest + minimal offline shell), so it
  installs to a phone home screen like the owner's `today` app.
- Inter **self-hosted** (not Google Fonts CDN) — heading weight 500 only.

## Core model — random hands, not a curated list

This is the defining change from the prototype. There is **no hardcoded spot list in the
product**. Instead:

1. Deal genuinely at random from a full 52-card deck (hero 2 cards + board 3 or 4).
2. Run `classify(hero, board)` → returns a draw-taxonomy entry (category, human name,
   note, outs, out-cards) **or** `null`/`air`/`made` for non-keepers.
3. **Reject** anything outside the target taxonomy and re-deal (rejection sampling — cheap).
4. Reveal the classified read only *after* the player commits (identifying the draw is
   part of the task).

The ten prototype spots survive **only as test fixtures** (see FIXTURES below).

### Target taxonomy (the "keepers")

| Category id | Name shown | Notes |
|---|---|---|
| `flushDraw` | A flush draw | 4 to a suit, ~9 outs |
| `openEnder` | An open-ended straight draw | both ends live, 8 outs |
| `gutshot` | A gutshot | one belly card, 4 outs |
| `doubleGutshot` | A double gutshot | two inside draws, 8 outs (a trap) |
| `combo` | A flush draw and an open-ender | flush + straight, overlap counted once (~15 outs) |
| `pairImproving` | A pair looking to improve | pair → trips/two-pair, ~5 outs |
| `overcards` | Two overcards | both hole cards over the board, 6 outs |
| `backdoor` | A backdoor flush draw | exactly 3 to a suit, 0 one-card outs, special ~4% math |

Everything else (`air`, `made` — already a straight/flush/trips/two-pair+, etc.) is a
**reject**: re-deal.

### Classifier contract — COMPOSITIONAL out-counting (the central rule)

Random hands are frequently more than one draw at once (flush + overcard, flush +
straight, pair + flush). The classifier counts a hand's **full combined outs**, not a
single "clean" draw:

- Detect every **component** draw present: `flush` (4 to a suit → 9 outs), the straight
  family (`openEnder` 8 / `gutshot` 4 / `doubleGutshot` 8), and `pairing`.
- **Outs = the UNION of every component's out-cards, overlaps counted once.** (The "15,
  not 17" trap: on a two-suited straighty board the flush and straight out-lists overlap —
  dedup them. `analyse()` already dedups because it counts distinct cards `c` where any
  `hits` predicate fires; build the composite `hits` as the OR of component predicates.)

**The pairing component — the critical constraint (trap #1):** a pairing card counts as an
out **only** when it is:
- an **overcard to the entire board** — a hole card strictly higher than the highest board
  card, so pairing it makes **top pair** (e.g. the ace on `Q-8-3` → 3 aces; A+K over a
  9-high board → 6). One overcard → up to 3, two → up to 6.
- or a rank the hero **already holds as a pair with the board** (a made pair), improving to
  **trips or two-pair** (the pair's remaining cards + overcard-kicker two-pair outs).

A pairing card **NEVER** counts when it would only make **bottom or middle pair** — i.e. a
hole card that is not an overcard and is not already paired. Pairing the `7` kicker on
`Q-8-3` is **not** an out. This is exactly trap #1: name the rank the predicate means; a
generic "any hole card pairs" wrongly inflated the 12-out spot to 15.

**Overcards stack on EVERYTHING — no carve-out (owner decision).** Overcard-pairing outs
are added to *whatever else the hand has_, including straight draws and combos. This makes
the rule fully compositional and uniform. Worked ground truth (compute via `analyse()` with
the composite `hits`):

| Hero | Board | Components | Outs | True% |
|---|---|---|---|---|
| A♠ 7♠ | K♠ 4♠ 9♦ | flush + overcard(A) | 12 | 45.0 |
| 7♠ 5♠ | K♠ 4♠ 9♦ | flush (no overcard) | 9 | 35.0 |
| A♥ K♣ | 9♦ 7♠ 2♥ | overcards(A,K) | 6 | 24.1 |
| Q♣ J♠ | T♥ 8♦ 2♣ | gutshot + overcards(Q,J) | 10 | ~38 |
| 6♣ 5♠ | 9♥ 8♦ 2♣ | gutshot (no overcard) | 4 | 16.5 |
| 9♥ 8♣ | 7♦ 6♠ K♣ | open-ender (no overcard) | 8 | 31.5 |
| J♦ T♦ | 9♦ 8♣ 2♦ | flush + open-ender + overcards(J,T) | 21 | ~70 |
| A♥ 9♣ | 9♦ 5♠ 2♥ | pair(9→trips) + overcard-two-pair(A) | 5 | 20.4 |

`quick = outs × mult` may exceed the true number a lot at high out counts — that's expected;
the step-03 drift correction (subtract outs above 8) handles it.

**Straight-draw sub-classification (standard definitions, unambiguous).** Compute the set
of *completing ranks* `C` = ranks `r` such that adding one card of rank `r` to
`hero ∪ board` makes a 5-card straight (ace counts high and low). Then:
- `|C| == 0` → no straight draw.
- `|C| == 1` → **gutshot** (4 outs).
- `|C| >= 2` and there exist four consecutive present ranks whose low-neighbour and
  high-neighbour are **both** in `C` → **openEnder** (8 outs).
- `|C| >= 2` otherwise (two separate inside gaps) → **doubleGutshot** (8 outs).

By this rule the prototype's `J9` on `Q-T-7` classifies as **openEnder** (it is four-in-a-
row 9-T-J-Q), not doubleGutshot — accept this; outs and true % are unchanged. A *genuine*
doubleGutshot test case is `K9` on `J-T-7` (completing ranks `{Q, 8}`, no four-in-a-row) —
add it to the classifier tests. A straight draw is only the hero's if the completed straight
uses **at least one hole card**; a straight that the board makes on its own is board texture,
not the hero's out — do not count it, and a hand already holding a made straight/flush is a
`made` reject.

**Backdoor is only a keeper when the hand is otherwise air.** `backdoor` classifies **only**
when the hand has exactly 3 to one suit AND no other counted component — no flush draw (4+
to a suit), no straight draw, no overcard-pairing outs, no made pair. Its number is the
~4% two-running-cards math. If the hand *also* has overcards or a straight draw, those win
and backdoor is at most a mention in the note, never the category. (So the prototype's
`A♥K♦` on `9♥5♥2♣` classifies as `overcards`, 6 outs — the standalone-backdoor fixture for
classifier tests must be a genuinely otherwise-air 3-flush hand, e.g. `8♥6♦` on `A♥K♥2♣`.)
The Phase-1 backdoor **math** fixture (`A♥K♦`, `mode:'backdoor'`) still validates the 4.2%
formula in isolation and is unaffected.

**Naming & category:** a hand's shown `name` is composed from its components (e.g.
"A flush draw with an overcard", "A flush draw and an open-ender"). For weighted selection
and per-category stats, each hand also has a single `primaryCategory` = its strongest
component by this precedence: `combo` (flush+straight) > `flushDraw` > `openEnder` >
`doubleGutshot` > `gutshot` > `pairImproving` > `overcards` > `backdoor`. A flush-draw-plus-
overcard buckets as `flushDraw` (primary) but reveals the full 12-out read and name.

`classify()` returns `{ primaryCategory, components, name, note, outs, outsList, hits }`
(or a reject marker). The `hits` it returns is the composite predicate `analyse()` consumes,
so the odds engine stays the single source of the true number — the classifier only decides
*which predicates* apply.

### Selection — weighted, no-repeat

- Pick a category by tunable weight (rare types don't vanish, common ones don't dominate):
  ```
  flushDraw 3, openEnder 3, gutshot 2, doubleGutshot 1,
  combo 1, pairImproving 2, overcards 2, backdoor 1
  ```
- Reject-sample a board that classifies to the chosen category.
- **Never repeat the exact same board within a session** (dedupe set).
- Weights live in one config object — easy to tune, and the seam adaptive difficulty
  plugs into later.

### Streets — flop AND turn from day 1

- Every deal is either a **flop** (3 board cards, 2 to come, ×4) or a **turn** (4 board
  cards, 1 to come, ×2). Randomly mixed.
- Question wording is always "chance you improve **by the river**"; only the multiplier
  the explanation teaches changes.
- The odds engine already handles both `streets === 2` and `streets === 1`.

## The odds engine (port almost verbatim)

Lift `fullDeck`, `hasFlush`, `hasStraight`, `pairsUp`, and the `analyse` math from the
reference logic into a pure `lib/odds.ts` — **no UI imports**. Math:

```
unseen  = 52 − heroCards − boardCards        // 47 on the flop, 46 on the turn
streets = 5 − boardCards                     // 2 on the flop, 1 on the turn
outs    = unseen cards c where hits(known + c)
total   = streets === 2
            ? (1 − ((u−o)(u−o−1)) / (u(u−1))) × 100   // exactly "at least one out"
            : (o / u) × 100
quick   = outs × (streets === 2 ? 4 : 2)     // the shortcut being taught
```

Backdoor bypasses `hits` (zero outs) and multiplies two conditional draws:
`P(suit on turn) × P(suit on river | turn hit)`.

### Two correctness traps — keep the guards, assert in tests

1. **`hits` must name the rank it means.** A generic "any hole card pairs" predicate
   wrongly counted a bottom-pair kicker as an out on the 12-out spot (inflated to 15).
   Rank-specific predicates only.
2. **Zero one-card outs on a non-backdoor spot = mis-specified**, not a 0% drill (e.g.
   `Q9` on `J-7-2` is a double gutshot needing two cards). The engine logs an error on any
   non-backdoor spot with zero one-card outs — keep that guard and assert it.

### FIXTURES — the ten verified spots (test data only)

| Spot | Hero | Board | Category | Outs | True |
|---|---|---|---|---|---|
| Flush draw | A♠ 7♠ | K♠ 4♠ 9♦ | flushDraw | 9 | 35.0% |
| Open-ender | 9♥ 8♣ | 7♦ 6♠ K♣ | openEnder | 8 | 31.5% |
| Gutshot | Q♣ J♠ | 10♥ 8♦ 2♣ | gutshot | 4 | 16.5% |
| Double gutshot | J♥ 9♣ | Q♦ 10♠ 7♠ | doubleGutshot | 8 | 31.5% |
| Flush draw + overcard | A♥ 7♥ | Q♥ 8♥ 3♣ | combo/overcard | 12 | 45.0% |
| Combo flush + straight | J♦ 10♦ | 9♦ 8♣ 2♦ | combo | 15 | 54.1% |
| Pair improving | A♥ 9♣ | 9♦ 5♠ 2♥ | pairImproving | 5 | 20.4% |
| Two overcards | A♥ K♣ | 9♦ 7♠ 2♥ | overcards | 6 | 24.1% |
| Backdoor flush | A♥ K♦ | 9♥ 5♥ 2♣ | backdoor | 0 | 4.2% |
| Flush draw on the turn | A♠ 7♠ | K♠ 4♠ 9♦ 2♣ | flushDraw (turn) | 9 | 19.6% |

`classify()` must return the expected category for each of these boards, and `analyse()`
must reproduce the outs and true % (rounded to one decimal).

## Explanation copy — generated, not hardcoded

The prototype's ten hand-written `outsCopy` strings are placeholders. With random hands,
generate the sheet copy from `classify()` output per category, slotting in specifics:
the count, the suit/rank names, the actual out-cards, and the overlap warning for combos.
Keep each string as terse as the hand-written originals. The sheet's structure (steps
01/02/03, the head-maths card, the "worth memorising" table) is fixed per the design spec.

- **Step 03 (drift correction)** only renders when the shortcut is actually wrong:
  above 8 outs teach "×4 minus (outs−8)"; else if drift > 0.9pt, warn about dirty outs.

## Layout — responsive from day 1

- **Desktop:** the 1280×860 design is the *layout unit*, not a fixed canvas. The frame
  fills the viewport: it is laid out at `viewport / --ui-scale` and transform-scaled back
  up (`--ui-scale = clamp(1, min(vw/1280, vh/860), 1.6)`, computed in `App.tsx`), so the
  bands, the rail mechanic and the sheets keep their proportions while a large monitor
  gets a large UI instead of a small island in the corner. The felt takes the leftover
  height on top of that via `--felt-scale`. Everything else is per the handoff README.
- **Portrait phone:** single vertical column — compact header → scaled felt + cards →
  hand read → you/actual result → **rail pinned in the thumb zone** near the bottom. The
  explanation is a bottom sheet (already the right mobile gesture). No landscape lock.
- Structure components so layout is CSS-driven and swappable per breakpoint, not forked.

## Persistence — localStorage

```
totals:      { hands, streak, bestStreak, errors: number[], bands: {green,amber,red} }
perCategory: { [categoryId]: { n, errors: number[], bands: {green,amber,red} } }
session:     seenBoards: Set<string>   // ephemeral, for no-repeat; not persisted
```

- Restore totals + perCategory on load; write on each commit.
- A **Reset stats** control clears persisted data.
- Avg error = running mean of `errors`. Streak increments on green only, resets otherwise.

## Design tokens — Nocturne

Take every colour/type/space/radius/shadow from the Nocturne tokens
(`../design_handoff_runout/design/_ds/nocturne-*/styles.css`). Do not hardcode hexes the
tokens already carry. Copy the `:root` custom properties into the app's global CSS.

Four functional colours sit **outside** the mono token set (keep chroma low):
```
#6fbf8e  band green / on the money      #cfa25f  band amber / close
#c2686f  band red / off                 #a5474e  heart & diamond pips (♠♣ use #292b31)
```

Type sizes in play: 11 12 13 14 15 19 22 25 27 28 29 37 40 44 px. Headings never exceed
weight 500 — hierarchy is size and space. Phosphor icons if any are ever needed (none now;
glyphs are ♠ ♥ ♦ ♣ ? × → —).

## Explicitly out of scope for v1 (seams only)

- **Preflop drill mode** (v2, owner-named) — keep the mode/street abstraction open.
- Adaptive difficulty, "which draw is this?" graded step, session-summary/stats view —
  per-category data is persisted so these are cheap later, but do **not** build them now.
- Villain range / equity (a different product).
