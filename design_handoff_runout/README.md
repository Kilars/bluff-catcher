# Handoff: Runout — poker odds trainer

## Overview

Runout is a drill that teaches a player to estimate, on the fly, the chance their hand
improves by the river. A hand is dealt (hole cards + flop, sometimes + turn). The player
taps a 0–100 rail to commit a percentage guess. The true number appears immediately
beside their guess, scored in a green/amber/red band. A `?` opens an explanation that
teaches the *method* — count the outs, multiply by 4 (or 2 on the turn) — never formal
combinatorics.

Two screens, both in the prototype:

1. **The table** — cards, the one-tap guess rail, the result.
2. **The explanation** — how the number is arrived at, as a bottom sheet over the table.

Product decisions already settled with the designer/owner (do not re-litigate these):

- It is a **drill, not a game**. No chips, no betting, no villain action, no showdown.
- The guess is **chance of improving by the river**, not equity against a range.
- Spots are **curated**, never dealt at random from a full deck (see "Random hands" below —
  this is the main thing the handoff wants extended, and it has a real trap in it).
- **No exact combinatorics on screen.** This is a poker trainer, not a maths teacher.
  The teaching method is the rule of 2 and 4 plus the "subtract the outs above 8" correction.
- The **hand read is hidden until the player commits** — identifying the draw is part of
  the task. It reveals with the result.

## About the design files

Everything in `design/` is a **design reference written in HTML** — a working prototype of
the intended look and behaviour. It is **not production code to copy**.

`design/Runout.dc.html` is authored in a proprietary streaming-component format
(`<x-dc>` template + a `Component extends DCLogic` class, driven by `support.js`). Do not
try to port that runtime. Open the file in a browser to see and play the design; read its
`<script data-dc-script>` block for the logic. Then **recreate it in the target codebase's
own environment** using that codebase's established patterns and libraries.

If there is no codebase yet: React + TypeScript + Vite is the natural fit — the whole thing
is one stateful view plus a pure odds module, and the odds module deserves unit tests.

### The one part worth porting almost verbatim

The odds engine in the logic class (`fullDeck`, `hasFlush`, `hasStraight`, `pairsUp`,
`analyse`) is correct, tested against all ten spots, and framework-agnostic. Lift it into a
pure module (`lib/odds.ts`) with no UI imports, and unit-test it. Everything else is UI.

## Fidelity

**High fidelity.** Final colours, type, spacing, copy and interaction states. Recreate
pixel-accurately using the codebase's libraries. Exact values are in **Design tokens**.

Frame is a fixed **1280 × 860** desktop canvas. It is **not responsive** — a mobile layout
was scoped out and is listed under "Not yet designed".

---

## Screens / Views

### 1. Table (the drill)

**Purpose:** read the board, commit a percentage, see how close you were.

**Layout** — vertical flex, three bands, fixed 1280 × 860, `overflow: hidden`,
`user-select: none`:

| Band | Height | Notes |
| --- | --- | --- |
| Header | 54px, fixed | 1px bottom divider, 22.4px horizontal padding |
| Table | flex: 1 (≈580px) | centred, radial-gradient ground |
| Dock | 226px, fixed | 1px top divider, padding `22.4px 33.6px` |

#### Header

- **Left:** `RUNOUT` — heading font, 500, 15px, letter-spacing 0.14em. Beside it
  `ODDS TRAINER` — 11px, letter-spacing 0.1em, uppercase, `--color-neutral-600`. Gap 11.2px.
- **Right:** a 22.4px-gap row of stat pairs. Each is a 12px `--color-neutral-500` label with
  a 14px tabular-nums value: **Hands** (`--color-neutral-300`), **Streak**
  (`--color-accent-300`), **Avg error** (`--color-neutral-300`, rendered `±4.2` or `—`).
- **Band tally**, separated by a 16.8px left padding and a 1px divider: three 8px dots with
  counts — green `#6fbf8e`, amber `#cfa25f`, red `#c2686f`. Each count is tabular-nums,
  `--color-neutral-400`, `min-width: 14px`.

#### Table

- Ground: `radial-gradient(ellipse 70% 60% at 50% 40%, #1d1f2f 0%, #161826 78%)`.
- Felt: 820 × 380, `border-radius: 190px / 190px`,
  `background: radial-gradient(ellipse 80% 80% at 50% 28%, #2a2d40 0%, #1e2030 62%, #191b28 100%)`,
  `box-shadow: inset 0 0 0 1px var(--color-neutral-800), inset 0 0 60px rgba(0,0,0,0.5), 0 24px 60px rgba(0,0,0,0.5)`.
- Inner accent ring: absolutely positioned `inset: 14px`, `border-radius: 180px / 180px`,
  `box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 14%, transparent)`.
- **Villain**, top-centre at `top: 30px`: two 32 × 44 face-down cards, `--radius-sm`,
  `linear-gradient(160deg, var(--color-accent-800), var(--color-accent-900))`,
  `inset 0 0 0 1px var(--color-accent-700)`, 4px gap. Label `VILLAIN` beneath — 11px,
  0.08em, uppercase, `--color-neutral-600`.
- **Street line**, `top: 116px`: `FLOP · TWO CARDS TO COME` — 12px, 0.08em, uppercase,
  `--color-neutral-500`, separated by a `--color-neutral-700` middot. Reads
  `TURN · ONE CARD TO COME` on turn spots.
- **Board cards**: 66 × 94, `--radius-md`,
  `linear-gradient(170deg, var(--color-neutral-100), var(--color-neutral-200))`,
  `box-shadow: 0 6px 16px rgba(0,0,0,0.45)`. Rank 29px heading/500 above suit glyph 23px,
  centred, 2px gap. 8.4px gaps.
- **Blank cards** for streets still to come: same box, `border: 1px dashed
  var(--color-neutral-800)`, no fill, 5.6px extra left margin, label `TURN` / `RIVER`
  bottom-centred, 10px, 0.1em, uppercase, `--color-neutral-700`. Two on the flop, one on
  the turn.
- **Hero cards**: 82 × 116, overhanging the felt at `bottom: -32px`,
  `linear-gradient(170deg, var(--color-neutral-100), var(--color-neutral-300))`,
  `box-shadow: 0 10px 26px rgba(0,0,0,0.55), 0 0 0 1px color-mix(in srgb, var(--color-accent) 40%, transparent)`.
  Rank 37px, suit 29px.
- **Card face colours:** spades/clubs `#292b31`, hearts/diamonds `#a5474e`. Rank `T`
  renders as `10`. Suit glyphs are the Unicode characters ♠ ♥ ♦ ♣.

#### Dock — left column (274px, fixed, 22.4px right padding, 1px right divider)

- Kicker `YOU'RE DRAWING TO` — 11px, 0.1em, uppercase, `--color-neutral-600`.
- **Before the guess:** a single em-dash — heading 500, 25px, `--color-neutral-700`, in a
  42px-tall row (holds the layout still). The hand read is deliberately withheld.
- **After the guess:** the draw name (heading 500, 25px, line-height 1.15) beside a 30px
  round `?` button, then a 13px `--color-neutral-400` one-line note, line-height 1.5.
- `?` button: 30 × 30, `border-radius: 50%`, transparent fill, `1px solid var(--color-accent)`,
  accent glyph. Hover `background: color-mix(in srgb, var(--color-accent) 16%, transparent)`;
  active 28%. `transition: background 140ms ease`.

#### Dock — right column (flex, space-between)

Top row is 74px tall.

- **Before the guess:** one line — “What is the percentage chance you improve by the river?”
  heading 500, 22px, line-height 1.25, `--color-neutral-200`, `max-width: 620px`.
- **After the guess:** a 28px-gap row of three blocks:
  - `YOU SAID` (11px, 0.1em, uppercase, `--color-accent-500`) over the guess — heading 500,
    **44px**, `--color-accent-200`, tabular-nums, with a 16px `%` in `--color-neutral-500`.
  - `ACTUAL` (same kicker in `--color-neutral-600`) over the true number — same 44px, in
    `--color-text`.
  - Band pill + delta: pill is `padding: 3px 10px`, `border-radius: 999px`, 12px, 0.06em,
    uppercase, text and `inset 0 0 0 1px` both in the band colour, reading
    **ON THE MONEY** / **CLOSE** / **OFF**. Under it, `off by 4.9 points` — 13px,
    `--color-neutral-500`, tabular-nums.
  - Right-aligned buttons: **How it's counted** (ghost — 38px tall, `padding: 0 16.8px`,
    `--radius-md`, `1px solid var(--color-neutral-700)`, `--color-neutral-300`; hover
    border and text go accent) and **Next hand →** (38px, `padding: 0 22.4px`, `1px solid
    var(--color-accent)`, accent text, hover/active accent tint at 16%/28%).

#### The guess rail — the core mechanic

Not a slider. **No thumb.** One tap commits.

- A 26px label strip sits above it, then the 44px rail, then the 0/25/50/75/100 scale
  (11px, `--color-neutral-600`, tabular-nums, `justify-content: space-between`, 5.6px top padding).
- Rail: full width, 44px tall, `--radius-md`,
  `linear-gradient(180deg, #1e2030, #1b1d2b)`, `inset 0 0 0 1px var(--color-neutral-800)`,
  `cursor: crosshair`, `touch-action: none`, `overflow: hidden`.
- **Ticks:** full-height 1px lines at 25% and 75% in `--color-neutral-800`, at 50% in
  `--color-neutral-700`.
- **Hover ghost** (before commit only): a 1px `--color-neutral-500` line inset 6px top and
  bottom at the cursor, plus the live integer percentage above the rail — 13px,
  `--color-neutral-300`, tabular-nums, `translateX(-50%)`.
- **On commit:**
  - Accent fill from 0 to the guess:
    `linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 8%, transparent), color-mix(in srgb, var(--color-accent) 30%, transparent))`.
  - Guess mark: 3px full-height bar, `margin-left: -1px`, `var(--color-accent)`,
    `box-shadow: 0 0 14px color-mix(in srgb, var(--color-accent) 70%, transparent)`.
  - True mark: same geometry in `--color-neutral-100`, `box-shadow: 0 0 14px rgba(243,245,254,0.5)`.
  - Error gap: an 8px bar at `top: 18px` spanning between the two marks, filled with the
    band colour at `opacity: 0.5`.
  - Labels: `YOU` (11px, 0.08em, uppercase, `--color-accent-300`) bottom-aligned in the
    strip; `ACTUAL` (`--color-neutral-300`) top-aligned, so they never collide vertically.
    **When the two marks are within 9 points**, both labels are pushed outward from the
    pair's midpoint to a 9-point separation, clamped to 0–100 — otherwise a near-miss reads
    as one jammed blob.

### 2. Explanation (bottom sheet)

**Purpose:** teach the method that produces the number, in table-usable form.

- A backdrop covers the frame: `rgba(13,14,22,0.66)`, `backdrop-filter: blur(2px)`,
  click-to-dismiss.
- Sheet is pinned left/right/bottom with `top: 240px` (so ~186px of table stays visible).
  Ground `linear-gradient(180deg, #1e2030, #17192a)`, `border-radius: var(--radius-lg)
  var(--radius-lg) 0 0`, `box-shadow: 0 -1px 0 0 var(--color-neutral-700), 0 -30px 80px
  rgba(0,0,0,0.6)`, `padding: 22.4px 44.8px`, `overflow: auto`, 16.8px column gap.
- Entry animation `riseSheet`: `translateY(24px)` + `opacity: 0` → rest, **220ms
  cubic-bezier(0.2, 0.7, 0.2, 1)**, `both`.
- A `Full screen` variant sets `top: 0` and drops the radius. Content is ~604px tall and
  constant across all spots; it fits the 620px sheet with room to spare. **The footer must
  not use `margin-top: auto`** — in the full-screen variant that strands the buttons at the
  bottom edge with a 273px void above them.

**Header:** kicker `HOW IT'S COUNTED`, then an h1 — heading 500, 28px, line-height 1.1 —
reading `9 outs → 35%` (or `Roughly 4%, and no shortcut` for the backdoor spot). Under it a
14px `--color-neutral-400` line: `draw name · street · cards to come`. A 34px square `×`
button closes it (`--radius-md`, `1px solid var(--color-neutral-700)`, hover goes accent).

**Divider:** 1px, `linear-gradient(90deg, transparent, var(--color-divider) 48px,
var(--color-divider) calc(100% - 48px), transparent)` — the design system's fade-at-the-ends rule.

**Body:** two columns, 44.8px gap.

*Left column (flex: 1)* — numbered steps. Each is a 16.8px-gap row: a 26px-wide index
(`01`, heading 13px, `--color-accent-500`, 3px top padding) beside a stack of a 19px
heading/500 title and 14px/1.6 `--color-neutral-400` body with `text-wrap: pretty`.

- **01 — count the live cards.** Per-spot title and copy (exact strings in the prototype),
  followed by the outs rendered as **the actual cards**: 32 × 44, `--radius-sm`,
  `linear-gradient(170deg, var(--color-neutral-200), var(--color-neutral-300))`,
  `box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 45%, transparent)`, rank
  14px over suit 12px, wrapped in a 5.6px-gap flex-wrap row.
- **02 — the multiplier.** `Two cards to come, so multiply by 4` / `One card to come, so
  multiply by 2`. For the backdoor spot: `The rule of 4 does not apply`.
- **03 — where the shortcut drifts.** *Only rendered when the shortcut is actually wrong.*
  Above 8 outs it teaches the correction: “12 × 4 = 48, minus 4 = 44%. Within a point.”
  Otherwise, if the drift exceeds 0.9 points, it says to ignore the drift and warns about
  dirty outs instead.

*Right column (320px, fixed)*

- A two-part card, `--radius-md`, `inset 0 0 0 1px var(--color-neutral-800)`, `overflow: hidden`:
  - Top (`#1f2130`, 16.8px padding): kicker `ON THE FLY`, then the head-maths line —
    `9 × 4 = 36%` — heading 500, 27px, `--color-neutral-200`, tabular-nums; then a 12px
    `--color-neutral-500` note (`outs × 4, done in your head`).
  - 1px `--color-neutral-800` rule.
  - Bottom (`var(--color-accent-900)`, 16.8px padding): kicker `TRUE NUMBER` in
    `--color-accent-300`, the number at heading 500 **40px** `--color-accent-100`
    tabular-nums with a 16px `%`, and a 12px `--color-accent-400` note.
- **Worth memorising** card: `padding: 14px 16.8px`, `--radius-md`,
  `inset 0 0 0 1px var(--color-neutral-800)`. A 2-column grid (`gap: 5.6px 16.8px`) of six
  space-between rows, 13px, tabular-nums, label `--color-neutral-400` / value
  `--color-neutral-200`: 15 outs 54%, 8 · open-ender 31%, 12 outs 45%, 6 · overcards 24%,
  9 · flush draw 35%, 4 · gutshot 17%.

**Footer:** 11.2px top padding, 11.2px gap — **Back to the table** (accent outline) and
**Deal me another →** (neutral ghost).

---

## Interactions & behaviour

| Trigger | Result |
| --- | --- |
| Pointer move over the rail, before commit | ghost line + live % follow the cursor |
| Pointer leaves the rail | ghost clears |
| **Tap the rail, before commit** | commits that integer percentage, reveals actual + band + hand read, scores the hand |
| **Tap the rail, after commit** | deals the next hand (this is the fast-repetition loop — no button trip needed) |
| `←` `→` `↑` `↓` on the focused rail | move the ghost by 1 (10 with Shift) |
| `Enter` / `Space` on the focused rail | commit the ghost (defaults to 50 if untouched); after commit, deal next |
| `?` or **How it's counted** | opens the explanation sheet |
| Backdrop click, `×`, **Back to the table** | closes the sheet |
| **Next hand →** / **Deal me another →** | next spot, sheet closes, guess resets |

Focus ring everywhere: `outline: 2px solid var(--color-accent); outline-offset: 2px`.
All button hovers are accent tints at 16% (active 28%) over transparent — the design system
never fills a primary button.

**Scoring:** `delta = |guess − trueTotal|`. `delta ≤ green` (default 5) → green,
`≤ amber` (default 10) → amber, else red. Streak increments on green only and resets to 0
otherwise. Avg error is the running mean of all deltas. Band counters are cumulative.

## State management

Prototype state, all client-side and ephemeral (nothing persists — see "Not yet designed"):

```
i: number              // index into the spot list
guess: number | null   // null = not yet committed; drives every locked/unlocked branch
hover: number | null   // ghost position, cleared on commit and on pointer-leave
showExplain: boolean
errors: number[]       // every delta, for the running mean
streak: number
hands: number
bands: { green: number, amber: number, red: number }
```

Derived per render (never stored): `analyse(spot)` → outs, out cards, unseen count, streets,
total, and the rule-of-N figure. Cheap enough to recompute; memoise on `i` if you prefer.

Tweakable props: `greenBand` (default 5), `amberBand` (default 10),
`explainLayout` (`Bottom sheet` | `Full screen`).

No data fetching. The odds engine is pure and synchronous.

## The odds engine

```
unseen  = 52 − heroCards − boardCards        // 47 on the flop, 46 on the turn
streets = 5 − boardCards                     // 2 on the flop, 1 on the turn
outs    = unseen cards c where hits(known + c)
total   = streets === 2
            ? (1 − ((u−o)(u−o−1)) / (u(u−1))) × 100     // exactly "at least one out"
            : (o / u) × 100
quick   = outs × (streets === 2 ? 4 : 2)     // the shortcut being taught
```

`hits` is per-spot: `hasFlush`, `hasStraight`, a named-rank pair check, or a union of them.
The backdoor spot bypasses this entirely (zero outs) and multiplies two conditional draws.

Two traps that already bit this design during review — keep the tests:

1. **`hits` must name the rank it means.** A generic "any hole card pairs" predicate counted
   the 7 kicker pairing bottom pair as an out on the 12-out spot, inflating it to 15.
2. **Zero outs means the hand is mis-specified, not a 0% drill.** `Q9` on `J-7-2` is a
   *double* gutshot (needs two more cards), not a 4-out gutshot, and it silently rendered
   0.0%. The engine now logs an error on any non-backdoor spot with zero one-card outs —
   keep that guard, and assert it in tests.

**Verified numbers for the ten spots** (use these as your test fixtures):

| Spot | Hero | Board | Outs | True |
| --- | --- | --- | --- | --- |
| Flush draw | A♠ 7♠ | K♠ 4♠ 9♦ | 9 | 35.0% |
| Open-ender | 9♥ 8♣ | 7♦ 6♠ K♣ | 8 | 31.5% |
| Gutshot | Q♣ J♠ | 10♥ 8♦ 2♣ | 4 | 16.5% |
| Double gutshot | J♥ 9♣ | Q♦ 10♠ 7♠ | 8 | 31.5% |
| Flush draw + overcard | A♥ 7♥ | Q♥ 8♥ 3♣ | 12 | 45.0% |
| Combo flush + straight | J♦ 10♦ | 9♦ 8♣ 2♦ | 15 | 54.1% |
| Pair improving | A♥ 9♣ | 9♦ 5♠ 2♥ | 5 | 20.4% |
| Two overcards | A♥ K♣ | 9♦ 7♠ 2♥ | 6 | 24.1% |
| Backdoor flush | A♥ K♦ | 9♥ 5♥ 2♣ | 0 | 4.2% |
| Flush draw on the turn | A♠ 7♠ | K♠ 4♠ 9♦ 2♣ | 9 | 19.6% |

## Truly random hands — read before you build this

This is the requested expansion and it is the hardest part of the product, not a `shuffle()` call.

Random dealing breaks the drill in three ways:

1. **Most random flops give you nothing to draw to.** Air is the modal outcome. A trainer
   that asks "what's your chance of improving?" on `K-7-2` with `J-4` offsuit is asking a
   question with a boring, unteachable answer, and the player learns to type small numbers.
2. **The question needs a well-defined target.** "Improve" is only crisp when there is a
   draw to name. On air, "improve" silently means "pair up or better", which is a different
   skill and a different number.
3. **Naming the draw is now part of the task** (the hand read is hidden until commit), so
   every dealt hand must have a *nameable* read to reveal. That is the constraint the
   curated list was satisfying.

The way to do it properly — **classify, then filter**:

- Write a `classify(hero, board)` that returns a draw taxonomy entry: flush draw, open-ender,
  gutshot, double gutshot, combo, pair-improving, overcards, backdoor, made hand, air —
  along with the human-readable name and note the UI reveals.
- Deal genuinely at random, run `classify`, and **reject** anything outside the drill's
  target categories. Rejection sampling is cheap: deal until you get a keeper.
- Weight the categories so the ladder stays balanced — otherwise flush-draw-plus-nothing
  and gutshots will dominate by frequency and the 15-out combo will show up once an hour.
- Keep a **difficulty ladder**: start on the clean single draws, mix in the traps (double
  gutshot, the overlap in the combo, dirty outs) as the player's average error falls.
- Never repeat the exact same board within a session — random dealing will otherwise serve
  the same 9-out flush draw over and over and the player memorises "35" instead of counting.

`classify` also lets you generate the explanation copy rather than hand-writing it per spot,
which is what the ten hardcoded `outsCopy` strings are standing in for. Generate: the count,
the suit or rank names, and the overlap warning. Keep them as short as the hand-written ones.

One more correctness note for random hands: **dirty outs**. A card that fills your flush and
also fills a straight for a plausible villain range is worth less than one out. The current
design mentions this in prose only. If you compute against a villain range later, that is a
different product (equity, not improvement) and it needs its own question wording.

## Design tokens

All tokens come from the bound **Nocturne** design system —
`design/_ds/nocturne-.../styles.css` is the single source, with its guide in `readme.md`
alongside. Take values from `var(--*)`, do not hardcode.

```
--color-bg          #161826      --color-surface     #232532
--color-text        #e9e9ed      --color-accent      #9184d9
--color-divider     color-mix(in srgb, #e9e9ed 16%, transparent)

neutral 100→900  #f3f5fe #e4e7f5 #cfd3e5 #b2b6ca #9397ab #75798c #595d6c #3f424d #292b31
accent  100→900  #f5f4ff #e7e5fe #d2cefd #b5abfc #968ae0 #796cbf #5d5294 #423a6a #2b2741

--font-heading / --font-body   "Inter", system-ui, sans-serif   (heading weight 500)
--space-1..8    2.8 5.6 8.4 11.2 16.8 22.4 px      (density 0.70×)
--radius-sm/md/lg    4 / 8 / 14 px
--shadow-sm     0 0 0 1px #3f424d
--shadow-md     0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,0.55)
--shadow-lg     0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,0.65)
```

**Four values are deliberately outside the token set** — they are functional, not decorative,
and Nocturne is a mono palette with no semantic colours:

```
#6fbf8e  band: green / on the money
#cfa25f  band: amber / close
#c2686f  band: red / off
#a5474e  heart & diamond pips   (spades & clubs use #292b31)
```

They are low-chroma on purpose, to sit inside Nocturne's desaturated ramps. If your codebase
has semantic success/warning/danger tokens, map to those instead — but keep the chroma down.

Type sizes in play: 11 / 12 / 13 / 14 / 15 / 19 / 22 / 25 / 27 / 28 / 29 / 37 / 40 / 44 px.
Headings never go past weight 500 — hierarchy here is size and space, per the system's guide.

## Assets

None. No images, no icon font — the only glyphs are Unicode `♠ ♥ ♦ ♣`, `?`, `×`, `→`, `—`.
Nocturne specifies **Phosphor icons** if you add any. Inter loads from Google Fonts in the
prototype; self-host it in production.

## Not yet designed — scoped out, will need design input

- **Mobile / responsive.** The frame is fixed desktop. The bottom sheet exists partly because
  it is the right mobile gesture, but the phone layout of both screens has not been designed.
- **Persistence.** Nothing survives a reload — no session history, no long-term accuracy
  tracking, no per-category stats. Add it, but the *screens* for it don't exist yet.
- **A graded hand read.** The draw name is hidden until commit, so identifying it is a silent
  step the app never checks. The natural extension is a "which draw is this?" tap before the
  percentage. The owner turned this down for v1; treat it as an optional mode, not a default.
- **Onboarding, drill-mode picker, session summary, hand history.** Discussed and deferred.
- **Turn-street coverage.** Only one turn spot exists. If turn drilling becomes a mode, the
  question wording changes ("by the river" is still right, but the multiplier halves) and the
  ladder needs its own turn rungs.

## Files

```
design/Runout.dc.html      the design — open in a browser; logic in its <script data-dc-script>
design/support.js          proprietary runtime the file needs to render. Do not port.
design/_ds/nocturne-…/styles.css   design tokens — the single source for colour, type, space
design/_ds/nocturne-…/readme.md    the design system's own guide (direction, do's and don'ts)
design/_ds/nocturne-…/_ds_bundle.js  the system's component bundle
```

`Runout v1 (slider).dc.html` in the parent project is an earlier version with a
drag-thumb slider and full exact-combinatorics explanation. Both were **rejected**: the guess
must be one tap, and the explanation must teach the shortcut, not the formula. It is kept for
history only — do not build from it.
