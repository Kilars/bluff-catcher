# bluff-catcher — settled product decisions

The single source of truth for what we are building. Every implementation subagent
reads this first. Do **not** re-litigate anything here; if a decision needs changing,
raise it with the owner and update this file.

The design reference lives in `../design_handoff_runout/` — read its `README.md` for the
pixel spec, and `design/Runout.dc.html`'s `<script data-dc-script>` block for the
reference logic. That HTML runtime is **not** to be ported; recreate in React.

## What it is

An odds **drill** (not a game): deal a random poker spot (hero hole cards + flop, or
+ turn) → **the draw is named** ("A flush draw with an overcard") → the player taps a
0–100 rail to commit a single percentage guess for "chance you improve by the river" →
the true number + the full read reveal immediately, scored green/amber/red → a `?` sheet
teaches the **rule of 2 and 4** (outs × 4 on the flop, × 2 on the turn) plus the
"subtract outs above 8" correction.

Naming the draw up front is the default and can be switched off — see
"Naming the draw" below.

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
| `setDraw` | A pair drawing to a set | bare pocket pair, 2 outs |

Everything else (`air`, `made` — already a straight/flush/trips/two-pair+, etc.) is a
**reject**: re-deal. That includes a hand whose only feature is three to a suit — see
"Backdoors are out".

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

**Backdoors are out (owner decision).** There is no `backdoor` category, no
`mode:'backdoor'` branch in `analyse()`, and no "no shortcut" copy in the explanation
generator. A hand whose only feature is three to a suit has **zero one-card outs**, and
the question the drill asks — outs × 4 or × 2, ignoring runner-runner — has no answer for
it that teaches anything: it is a number to memorise, not a count to practise. So that
hand is `air` and gets re-dealt, exactly like any other non-keeper. (`A♥K♦` on `9♥5♥2♣`
was never a backdoor anyway — it is `overcards`, 6 outs, because both cards are over a
9-high board. It survives as the `overcardsWithThreeFlush` fixture.)

Three to a suit alongside a real draw is unchanged and was always the same thing: not
counted, not named, worth a mention in the note at most. The rail's question keeps its
"(ignore backdoors)" hint for exactly that case.

**Naming & category:** a hand's shown `name` is composed from its components (e.g.
"A flush draw with an overcard", "A flush draw and an open-ender"). For weighted selection
and per-category stats, each hand also has a single `primaryCategory` = its strongest
component by this precedence: `combo` (flush+straight) > `flushDraw` > `openEnder` >
`doubleGutshot` > `gutshot` > `pairImproving` > `overcards` > `setDraw`. A flush-draw-plus-
overcard buckets as `flushDraw` (primary) but reveals the full 12-out read and name.

`classify()` returns `{ primaryCategory, components, name, note, outs, outsList, hits }`
(or a reject marker). The `hits` it returns is the composite predicate `analyse()` consumes,
so the odds engine stays the single source of the true number — the classifier only decides
*which predicates* apply.

### Naming the draw — shown by default, hideable (owner decision)

The drill used to hide the read until the commit, on the theory that identifying the draw
is part of the task. In practice it made the question ambiguous: *which* outs are you
being asked to price? A two-suited straighty board has three plausible readings, and
guessing which one the app means is not the skill being trained.

So, by default, the drill **names the draw before the guess**:

- Shown up front: the composed **name** ("A flush draw with an overcard").
- Still withheld until the commit: the **note**, the `?` explanation, the out count and
  the true number. Those are the answer.
- The name is drawn muted and smaller than the revealed heading, so the "before" and the
  "after" states never read as the same thing.

**"Show the draw" is a preference**, persisted at `bluff-catcher:show-draw:v1` (absent or
unrecognised → on; only the literal `off` hides it). Turn it off and the old behaviour is
back — an em dash until you commit — which is the harder drill: identify it yourself,
then price it. That is the point of the toggle: it is the assist you switch off once you
no longer need it.

It lives in `useAppPrefs` beside mode and depth, is flipped from the hamburger menu
(desktop, "Drill" group) and the phone menu sheet ("Odds drill" group), and is the one
menu row that does **not** close the menu — the state you tapped to see is inside it.
Shown in odds mode only.

### Selection — weighted, no-repeat

- Pick a category by tunable weight (rare types don't vanish, common ones don't dominate):
  ```
  flushDraw 3, openEnder 3, gutshot 2, doubleGutshot 1,
  combo 1, pairImproving 2, overcards 2, setDraw 1
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

### Two correctness traps — keep the guards, assert in tests

1. **`hits` must name the rank it means.** A generic "any hole card pairs" predicate
   wrongly counted a bottom-pair kicker as an out on the 12-out spot (inflated to 15).
   Rank-specific predicates only.
2. **Zero one-card outs = mis-specified**, not a 0% drill (e.g. `Q9` on `J-7-2` is a
   double gutshot needing two cards). The engine logs an error on any spot with zero
   one-card outs — keep that guard and assert it. With backdoors gone this is
   unconditional: every spot the engine sees has at least one out.

### FIXTURES — the verified spots (test data only)

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
| Overcards over a 3-flush | A♥ K♦ | 9♥ 5♥ 2♣ | overcards | 6 | 24.1% |
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
- **Portrait phone (< 600px): a phone-native tree, not a scaled desktop.** The felt is
  not drawn at all. The odds drill is a fixed read zone (board cards at their native
  66×94, hero cards larger than desktop) above a swap zone that changes between asking
  and answering; the preflop drill replaces the nine-seat felt with a 44px seat ladder.
  The explanation is a full-screen sheet (already the right mobile gesture). No landscape
  lock: the phone tree is chosen on the viewport's *short* edge, so 844×390 gets it too.
- **Two trees, one behaviour.** Below 600px the app renders the phone tree; at 600px and
  above it renders the desktop tree with the `--ui-scale` / `--felt-scale` system
  (600–1023px is the desktop tree with `--felt-scale` doing the fitting). The split is
  decided once in `useLayoutMode()` and exposed as `data-layout` on `:root`; **no
  component reads a viewport width**, and no new `@media (max-width:` may be added under
  `src/` — CI enforces this. **All drill logic, state and persistence live in shared
  hooks** (`useOddsDrill`, `usePreflopDrill`, `useStats`, `usePreflopStats`) and in
  `lib/` — a layout tree contains presentation only. Forking presentation is expected;
  forking behaviour is a bug.

  *Supersedes the original "layout is CSS-driven and swappable per breakpoint, not
  forked". That line predated the `--felt-scale` hack, and the hack disproved it: the
  felt's geometry is coordinate-driven (`SEAT_SLOTS` is nine points sampled off an
  ellipse in 820×380 felt-space), and no media query reflows nine ellipse coordinates
  into a 44px row. Rationale and the full phone spec: `docs/PLAN-phone.md`.*

## Persistence — localStorage

```
totals:      { hands, streak, bestStreak, errors: number[], bands: {green,amber,red} }
perCategory: { [categoryId]: { n, errors: number[], bands: {green,amber,red} } }
session:     seenBoards: Set<string>   // ephemeral, for no-repeat; not persisted
prefs:       mode:v1, preflop-depth:v1, show-draw:v1   // one key each, versioned
```

`perCategory` is keyed by whatever category was current when the hand was played, so a
long-standing install can hold a retired key (`backdoor`). Readers must fall back to the
key itself rather than dropping the row.

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

## Modes are grouped by the decision, not by seat (2026-10-04)

The menu lists five modes in two sections: **Postflop** (Odds) and **Preflop**
(Open, 3-bet, 4-bet, Blinds). A preflop mode is the raise hero answers. A chart's
`Drill` (btn, bb, btn4, open4, seat) only records which source family it came
from, and `facingModeOf` puts every chart in exactly one mode. The Seat vs open
SB spots go to Blinds and the rest go to 3-bet. A mode deals its drills first,
then a chart, so a family with few charts still gets half the hands. Retired
mode ids and stats keys are read forward and never deleted. See
docs/PLAN-menu.md.

## The range sheet browses every seat pair (2026-10-06)

The range sheet (menu and trainers) has a decision strip: **Drill** (a
trainer's graded charts, trainer only), **Open**, **vs open** and **vs 3-bet**.
The two facing views page through every hero × raiser pair the sources have
(`lib/preflop/pairCharts.ts`): cash 100bb (6-max, 15 pairs each), tournament
40bb (9-max, 36 each) and the BTN-only 50bb+ pack. No range is entered by
hand: every page is the pair's own source chart, and a chart the source reuses
for other pairs says so in its footnote (cash answers a 3-bet with one chart
per opener whoever 3-bets; 40bb splits by 3-bettor). The drills still deal
only their curated spots. Browsing is not drilling.

## Later decisions deal only hands that reach them (2026-10-06)

The RFI drill deals all 169 hands. A facing drill deals hero's open range from
that seat (`dealtRange` in `facing.ts`). Facing a 3-bet, hero opened, so it
deals only the open range. Facing an open, hero hasn't acted, but the drill is
"which of the hands I play 3-bet or call", so it deals the open range plus the
few hands the chart continues with outside it (cash 65s, 40bb K5s and BTN 22),
so no continue is ever left undealt. The BB has no open range and defends
wider than any open, so it deals every hand. The 50bb+ BTN pack has no open
charts and uses the RFI drill's 60bb+ BTN chart (the same vendor). Range
charts colour hands outside the dealt range as "not in range", not as folds.

## The range browser's menu: format, spot, stack, seat, versus (2026-10-07)

The browser's strips now read top to bottom as **Format** (Tournament · Cash),
**Spot** (Drill, from a trainer only · Open · 3-bet · 4-bet), **Stack**
(tournament only, and only where there's a choice: 60bb+/20bb/10bb on Open,
40bb/50bb+ on 3-bet), then the views' own **your position** and **versus**
strips. 3-bet is the old "vs open" (hero faces an open, so Blinds spots live
there too) and 4-bet the old "vs 3-bet". This replaces the decision strip, the
facing views' source strip, and the Open view's own tier strip: the views
take the tier from the browser (`depthExternal`).

Assumptions, each easy to reverse:
- Drill keeps the trainer's own seat and chart tabs and hides Stack: they
  are the drill's navigation, not the browser's axes.
- Format stays on Drill showing the drill's format. Picking the other format
  leaves the drill for its own decision; going back to Drill resets it.
- Each format keeps its stack picks, so Cash → Tournament or 4-bet → 3-bet
  returns to the tier or 50bb+ picked before.
- The 50bb+ pack keeps a one-seat (BTN) position strip so that row doesn't
  vanish (`seatStrip`). *Superseded 2026-10-08: the rows stay put.*
- Changing spot or stack still reopens the chart list on its first page (or
  the dealt pair), as before; seat and raiser are not carried across.
  *Superseded 2026-10-08: they carry across.*

## The range browser's rows stay put (2026-10-08)

The browser's menu is now five rows that keep their shape within a format:
**Format**, **Spot**, **Stack** (tournament: 10bb · 20bb · 40bb · 50bb+ ·
60bb+), **You** and **vs** (the format's whole table, twice, in the same
columns). A tab that doesn't apply to what's picked above it is greyed, not
removed; the rules are one pure module (`lib/preflop/browserAxes.ts`). The
browser owns the seat and raiser, and the views take them (`menuExternal`).
This is phase 1 of docs/PLAN-slice-menu.md; the slice gesture comes next.

Assumptions, each easy to reverse:
- A pick keeps every lower pick that still applies and moves the rest to the
  nearest one that does (the opener just before you, the 3-bettor just
  after). Seat and raiser carry across spots, stacks and formats;
  the early 9-max seats come back from cash as the LJ.
- Each spot keeps its own tournament stack (Open's tier, 3-bet's 50bb+).
- Drill keeps only Spot: its own seat and chart tabs replace the rows below.
- Nine-seat rows label UTG+1/UTG+2 as UTG1/UTG2 so they fit a 360px phone.

## Slice the range browser's rows (2026-10-09)

One stroke down the browser's rows, with a mouse or a finger, picks Spot,
Stack, You and vs in one go (`SliceRows`, phases 2–3 of
docs/PLAN-slice-menu.md). A tap still works, and keyboard use is unchanged.

Assumptions, each easy to reverse:
- A row picks where the stroke crosses its centre line, or where the stroke
  moves mostly sideways within it; not every tab it touches, since a
  diagonal leaves a row over the neighbour of the tab it meant.
- Picks apply live, mid-stroke, with no cancel; a wrong one is fixed by a tap.
- Format and Drill stay taps: both change which rows exist.
- A stroke starts after 8px of movement; less is a tap. The rows take every
  touch (`touch-action: none`), so a scroll can't start on them.
- The trail is a 220ms tapered canvas stroke in the accent colour; a pick
  pops its tab and buzzes a phone that supports it. Reduced motion turns
  both off.

## HH bug sweep assumptions (2026-10-07)

The hand-history bug sweep changed only what was wrong by its own definition.
Where a fix needed a definition choice, this is the choice:

- **Flop buckets follow strategy-notes §2.** A connected T-high flop (T-9-7) is
  `middling-theirs`, and so is a T-or-lower pair whose other card touches it
  (7-7-6); 9-9-5 and every gapped or high pair stay `paired`. Cases the notes
  don't name keep the old bucket (T-6-2r, 8-8-6, two-tone A-7-2). The type is
  the flop's, so K-7-2-2 reads as K-7-2r.
- **A shove can be `overbet-strong`.** `sizing` stays null on a shove, but the
  label reads the shove's pot fraction, so an all-in for more than the pot with
  `strong` fires it. The fraction is the part a live opponent can call: a $45
  jam into $37 against $34 behind is a 0.93-pot bet, not an overbet.
- **`meta.levels` is null for cash**, which has no blind levels. A mixed window
  spans its tournament hands. MTT is unchanged.
- **Hand times are the GG client's clock**, unshifted. They run 2h ahead of the
  file name here (CEST), and `meta.timezone` says so instead of "export-local".

Round 2 of the sweep, same day:

- **One all-in rule.** A bet is all-in when it leaves under a tenth of the
  resulting pot behind, counting the deepest live opponent's stack as well as
  the bettor's, so a bet that puts every opponent all-in is one too. Labels,
  `bigSpots[]` and the action line all read it, and all size a bet at the part
  an opponent can call.
- **A fold with no chips left is no decision.** GG prints a fold for a player
  all-in from the blind or ante post and treats them as folded, so the fold is
  kept (no flop seen, no showdown) but is never counted, coached or printed.
- **`no-decision` is a role.** A big-blind walk or an all-in from the post gave
  Hero no preflop choice: it is not a fold, and it is out of the VPIP, PFR and
  gap denominators. `hands` still counts it.
- **`faced3Bets[].sizing` is capped at Hero's stack**, like every other price.
- **A cold 4-bet before Hero answered takes the hand out of `foldTo3Bet`.** The
  entry stays in `faced3Bets[]` with `cold4Bet: true`.
- **The preflop aggressor is the last raiser not all-in.** A short stack's
  all-in re-raise leaves the raiser it raised as the aggressor; a pot whose
  only raisers are all-in has none, so no c-bet and no donk-bet.
- **A villain raise counts as a barrel.** Calling a raise of Hero's flop bet
  and folding to the turn bet is `fold-to-turn-barrel`, and so is a fold after
  Hero's own flop check-raise was called.
- **`fold-to-raise` is a label** (family Facing aggression, priority 3, the
  barrel folds' defensive floor): Hero bet or raised a postflop street, was
  raised, and folded on it. It never shares a decision with the barrel folds.
- **`check-draw` skips a check Hero went on to check-raise**, as the PFA check
  labels already did.
- **Board quads make a pair a kicker.** A pair, overpair or top pair beside
  board quads is `marginal-made`; quads with a hole card stay `strong`.
- **`shared.depth` is never `'cash'`.** It is the variant, not a facet the
  instances agree on.
- **Label instances in `--json` carry the price**: `facedSizing`,
  `requiredEquity`, `mdf`, `playersToFlop` and `line`, all blind.
  `requiredEquity` is exact multiway; `facedSizing` and `mdf` are not.
- **`playersToFlop` counts preflop all-ins**: every dealt player without a
  preflop fold.
- **`--mode pots` and `--mode coach` carry `meta.variant`.**

Kept as is:

- A higher straight over a board straight stays `marginal-made`, the documented
  under-call.
- Gutshot plus two overcards is a `draw`: the ≥8-outs rule stands.
- Preflop chart depth reads Hero's own stack, not the effective one. Cash reads
  the single 100bb cash chart at any depth.
- W$SD counts any showdown where Hero collected chips, chops and run-it-twice
  splits included. That is the tracker convention.
- `actionLine` keeps the PLAN-coach §1.6 behaviour.
- `classify()` counts board-only straight outs. That is the Odds drill's
  definition, so it is left alone.

Not built, and why:

- New lists (blind defence, cold 4-bets, chart verdicts on `coldCalls` and
  `faced3Bets`): out of the sweep's scope, which fixed what exists.
- Limp-raise tracking: no label or stat asks for it.
- Straddle grammar: no straddle hand in the archive.
- Sit-out detection: the history prints no marker for it.
- EV-cashout handling: no Hero cashout in the archive.
- Widening `middling-theirs` to disconnected low flops: moves c-bet splits and
  needs the user's nod.
- A PFA check-raise label, a caller turn check-raise label and raises over
  leads: one to three archive instances each.
- Ranking MTT `bigSpots` by stack share, so short-stack jams surface: the user
  plays cash.
- `meta.archive.games` listing cash games in an MTT window: cosmetic, the
  archive meta is archive-wide by design.
- Board-only straight outs in `handClass` draws (L6): none in the labelled set.
- A short all-in big blind understating the next `toCall`, and an all-in ante
  in the SB seat shifting positions: synthetic only, no archive hand.

## Explicitly out of scope for v1 (seams only)

- **Preflop drill mode** (v2, owner-named) — keep the mode/street abstraction open.
- Adaptive difficulty, "which draw is this?" graded step, session-summary/stats view —
  per-category data is persisted so these are cheap later, but do **not** build them now.
- Villain range / equity (a different product).
