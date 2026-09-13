# Plan — a real phone break

Status: **proposed**, awaiting owner sign-off on §3 (three open decisions).
Owner decisions needed before Phase 2 starts.

## The essentials

- Phone today is the desktop design shrunk by a CSS transform to **0.4566** and
  then hand-corrected. It is not a phone design.
- The break should be at **600px**, not 820px, and decided in **JS**
  (`useLayoutMode()`) stamping `data-layout` on `:root` — not in 11 scattered
  media queries.
- **Logic in shared hooks, presentation forks.** Extract `useOddsDrill` /
  `usePreflopDrill` with zero behaviour change *first*, so the 573 existing
  tests stay green and the two trees cannot drift on behaviour.
- Two designs change fundamentally: the odds trainer **loses the felt** (board
  cards then fit at native 66×94), and the preflop trainer **loses the 9-seat
  felt** for a 44px seat ladder.
- The 169-cell range grid gets **24px cells with no labels** plus a drag-scrub
  readout. This is the riskiest call in the plan — see §3.1.
- This contradicts a settled decision in `DECISIONS.md`. §2 is the amendment.

---

## 1. Why — the audit

### 1.1 The transform is the whole problem

`App.tsx:145` sets, for any viewport ≤ 820px:

```
--felt-scale = min(1, (innerWidth * 0.96) / 820)
```

On a 390px phone that is **0.4566**. Everything inside the 820×380 felt is
multiplied by it. Measured consequences:

| Drawn at | Renders at | Element |
|---|---|---|
| 412px (felt + hero overhang) | **188px** | the whole table block, 25% of usable height |
| 82 × 116 | **37 × 53** | hero cards |
| 66 × 94 | **30 × 43** | board cards |
| 15px | **6.9px** | `PreflopTable` seat plaque text |
| 21px | **9.6px** | `PreflopTable` `.actionContext` |

`PreflopTable.module.css:258+` then bumps eight font sizes back up purely to
fight the transform. That is the tell: the phone rules are not a layout, they
are *denials* of the desktop layout.

### 1.2 The scale of the override tax

**460 lines** inside `@media (max-width: 820px)` / `(min-width: 821px)` blocks
across **11 files**:

| File | Lines |
|---|---|
| `modes/PreflopTrainer.module.css` | 103 |
| `components/ExplainSheet.module.css` | 87 |
| `components/Dock.module.css` | 81 |
| `components/PreflopTable.module.css` | 58 |
| `components/Header.module.css` | 44 |
| `components/RangeSheet.module.css` | 21 |
| `components/Table.module.css` | 22 |
| `components/RangeGrid.module.css` | 15 |
| `components/Menu.module.css` | 13 |
| `components/GuessRail.module.css` | 9 |
| `App.module.css` | 7 |

### 1.3 820 is the wrong number

820 is the **felt's asset width**. A design asset is governing a layout
decision. Consequences:

- A 768px iPad in portrait gets the *phone* layout, when it wants desktop
  chrome with a smaller felt — which `--felt-scale` already delivers.
- Phone landscape (844×390) is **wider** than 820, so it gets the *desktop*
  tree with 390px of height for a layout that wants 860.

### 1.4 Defects that only exist on phone

- **21 `:hover` rules across 7 modules, none guarded** by
  `@media (hover: hover)`. Hover is the *only* affordance for `Menu` items,
  `RangeSheet` nav and `RangeGrid` cells. On touch there is no affordance at all.
- **Touch targets under 44px**: hamburger 32×32, `btnInfo` 36px, `resetButton`
  is a bare 11px text run, sheet `closeBtn`.
- **`touch-action` appears in only 12 declarations**; iOS double-tap zoom is
  live on most buttons.
- **`ExplainSheet` uses `top: 8vh !important`** — `vh` does not exclude the
  iOS URL bar, so the sheet jumps ~90px when it collapses.
- **`PreflopInfoSheet` is `useState(true)`** (`PreflopTrainer.tsx:74`) and
  `App.tsx` passes `key={depth}`. On phone the sheet is full-screen, so every
  launch *and* every depth change is gated behind dismissing a wall.
- **Keyboard hints are rendered on a device with no keyboard**: F / J / R / I
  badges, and `PreflopTrainer.tsx:270` renders a literal "Space" hint.
- **The rail commits on `pointerdown`** with no undo (`GuessRail.tsx:47`), and
  it carries `touch-action: none`. A stray tap burns the hand. See §3.3.

---

## 2. The decision that has to change first

`docs/DECISIONS.md`, under *Layout — responsive from day 1*, currently says:

> Structure components so layout is CSS-driven and swappable per breakpoint,
> **not forked**.

This plan forks. That line predates the `--felt-scale` hack, and the hack is
the evidence against it: the felt's geometry is **coordinate-driven**, not
reflowable. `PreflopTable.tsx:118` is `SEAT_SLOTS` — nine hand-tuned points
sampled off an ellipse in 820×380 felt-space. No media query turns nine
ellipse coordinates into a 44px row.

`DECISIONS.md` says not to re-litigate its contents without the owner, so this
is raised, not assumed. **Proposed replacement wording:**

> **Layout — two trees, one behaviour.** Below 600px the app renders a
> phone-native component tree; at 600px and above it renders the desktop tree
> with the `--ui-scale` / `--felt-scale` system. The split is decided once in
> `useLayoutMode()` and exposed as `data-layout` on `:root`; no component reads
> a viewport width. **All drill logic, state and persistence live in shared
> hooks** (`useOddsDrill`, `usePreflopDrill`, `useStats`, `usePreflopStats`) and
> in `lib/` — a layout tree may contain presentation only. Forking presentation
> is expected; forking behaviour is a bug.

Nothing else in `DECISIONS.md` changes. The odds engine, the classifier
contract, the taxonomy, the fixtures and the token set are all untouched by
this work.

---

## 3. Open decisions — owner input needed

### 3.1 Do the range-grid cells lose their labels? (highest stakes)

The arithmetic on a 390px screen, sheet inner width 366px:

```
header track 18 + (13 gaps x 2px) = 44px overhead
(366 - 44) / 13 = 24.8  ->  24px cells, grid 356 x 356
```

A 24px cell *can* hold a 10px label, but 169 of them at 10px is noise, and
today's 6px is below the legibility floor. Options evaluated:

| Option | Cell | Canvas | Screens to read | Whole shape visible? |
|---|---|---|---|---|
| **A. 13×13, labels dropped, rank headers only** | 24px | 356×356 | 1 | **yes** |
| B. Legible 40px cells, pinch/pan | 40px | 586×586 | ~2.6 | never |
| C. Grouped lists (pairs / suited / offsuit) | 44px rows | 7,436px | ~8.8 | no |
| D. Percentage-threshold view only | — | ~80px | 1 | no |

**Recommendation: A, plus C′ as a companion.** The grid's job on a phone is the
*shape* of the range — which is the entire lesson of the 20bb tier, where BTN
narrows sharply while UTG barely moves. Shape survives label loss completely;
B destroys it by never showing the whole matrix, and C never had it.

Reading one cell is handled by a **drag-scrub readout**: press anywhere on the
grid and a fixed 44px bar above it names the cell under the finger
(`K9s · open · HJ`). This is why 24px is safe — at 55% of the 44px tap minimum
the cells must *not* be discrete tap targets, and a continuous scrub gesture
has no Fitts cost.

C′ is a derived boundary sentence — `HJ opens A2s+ suited` — computable from
the existing `getRangeSet` by scanning each hi-rank row for its lowest included
lo-rank. New pure helper in `lib/preflop/`, no new data.

**The risk:** if the scrub readout does not land, the grid becomes a heatmap you
cannot query. Worth 10 minutes with the real thing before Phase 4 is built.

### 3.2 What happens to phone landscape (844×390)?

Neither phone design fits 390px of height; the preflop layout alone needs 554px
of fixed height. The desktop tree at 390px height is worse.

| Option | Cost | Result |
|---|---|---|
| **Short-edge detection** (`min(w,h) < 600` → phone) + scrolling read zone | low | phone tree, read zone scrolls, action row pinned. Ugly but usable |
| Landscape sub-variant (36px bar, read left / action right) | medium | a third layout in all but name |
| Width-only detection | none | 844×390 lands on the desktop tree — broken |
| Rotate-me prompt | low | contradicts `DECISIONS.md` ("No landscape lock") |

**Recommendation: short-edge detection now, sub-variant deferred.** Landscape
is not the drill's posture; it should be usable, not designed for.

### 3.3 Does the guess commit on lift, or on a separate button?

The measurable problem with the current tap-to-commit rail on a 390px screen:

```
full-bleed 390px / 100 points   = 3.90 px per point
44px thumb contact patch        = 11.3 points (+-5.6)
GREEN_BAND (OddsTrainer.tsx:30) = 5 points
```

**The thumb is wider than the band you are graded against.** You cannot express
an answer as precise as the answer being scored. And `handlePointerDown`
commits immediately, so a stray tap burns the hand with no undo.

| Option | Precision | Speed | Misfire risk |
|---|---|---|---|
| **Absolute grab → relative refine (1pt / 6px) → explicit 56px Commit button** | single point | 2 gestures | none |
| Commit on lift + 400ms undo toast | ±5.6 points | 1 gesture | recoverable |
| Vertical rail (763px = 7.63 px/point) | single point | 1 gesture | none, but rotates the axis the error band needs |

**Recommendation: the first**, with the second as the fallback if it costs the
drill its snap. Measure: if median time-to-commit passes ~4s over 20 hands,
switch. The vertical rail is genuinely the better *motor* task but it rotates
the 0–100 axis away from the one thing that must stay horizontal — the
post-commit "you here, actual there, gap this wide" reveal against a
0/25/50/75/100 ruler.

---

## 4. Architecture

### 4.1 Breakpoints

| Token | Width | Real devices | Tree |
|---|---|---|---|
| `phone` | `< 600px` | 360, 390, 393, 430 | **phone** |
| `compact` | `600–1023px` | 744, 768, 834 portrait | desktop, `--ui-scale: 1` |
| `desktop` | `≥ 1024px` | 1024, 1280+ | desktop, scaling as today |

600 is the real cliff: below it two columns of 13px text cannot sit side by
side. The `compact` band needs no new design — it is the desktop tree with
`--felt-scale` doing the job it was built for.

### 4.2 One decision point

```ts
// src/hooks/useLayoutMode.ts
export type LayoutMode = 'phone' | 'compact' | 'desktop';
export function useLayoutMode(): LayoutMode;
```

- Built on **`matchMedia`**, not `resize` — `resize` fires on every iOS URL-bar
  scroll. Short-edge rule per §3.2: `(max-width: 599px), (max-height: 599px)`.
- Stamps `document.documentElement.dataset.layout` as a side effect. **All CSS
  keys on `:root[data-layout="phone"] .foo`. No component reads a width.**
- An inline script in `index.html`, before the module tag, sets `data-layout` on
  first paint — otherwise frame one renders desktop chrome on a 390px screen.
- `--felt-scale` and `--ui-scale` become **desktop-tree-only**. The phone tree
  has no scale transform anywhere.

### 4.3 The anti-drift rule

Three guards, because two trees is the real cost of this plan:

1. **Shared hooks own all behaviour.** A phone component containing a deal, a
   commit, a stats write or a persistence key is a bug.
2. **A CI grep fails the build** on any new `@media (max-width:` in `src/`.
   Widths live in one `breakpoints.ts` and one token block.
3. **`renderAt(mode)` test helper** stubs `matchMedia` and sets `data-layout`,
   so both trees are exercised in the same test file. jsdom defaults to
   1024px wide, so without this every test silently tests desktop only.

### 4.4 Shared extractions

| New | Holds | Replaces |
|---|---|---|
| `hooks/useOddsDrill.ts` | spot, guess, hover, commit, next, band scoring | `OddsTrainer` internals |
| `hooks/usePreflopDrill.ts` | spot, committed, sheets, double-record guard | `PreflopTrainer` internals |
| `lib/band.ts` | `BAND_COLOR`, `BAND_LABEL`, `bandOf` | duplicated in `Dock.tsx` + `OddsTrainer.tsx` |
| `lib/preflop/grid.ts` | `RANK_LABELS`, `cellClass(row, col)` | inline in `RangeGrid.tsx` |
| `lib/preflop/boundary.ts` | derived "opens A2s+ suited" sentence | new (§3.1 C′) |

`lib/preflop/*`, `useStats` and `usePreflopStats` are already pure and shared —
the split lands on an existing seam.

---

## 5. The designs

### 5.1 Odds trainer — a flashcard and a dial

**Delete the felt and the arithmetic inverts.** There are always exactly 5
board slots (3 + 2 blanks on the flop, 4 + 1 on the turn):

```
5 x 66px cards + 4 x 8.4px gaps = 363.6px   fits 366px (390 - 2x12 gutters)
```

Board cards render at their **exact desktop size, unscaled**, and hero cards get
*bigger* than desktop. The felt was the only thing forcing the shrink.

Two zones. A **read zone that is pixel-identical in both states** — the cards
must not move when you commit, because comparing the answer *to the cards* is
the learning act — and a swap zone below it.

```
                        pre-commit          post-commit
safe-area-top                47                  47
top bar                      36                  36     hamburger, +-avg, hands, streak
--- READ ZONE (identical) ----------------------------
street chip                  24                  24     11px, .1em tracking
board row                    94                  94     66x94 native, gap 8.4
gap                          32                  32
hero row                    136                 136     96x136, rank 40px
gap                          32                  32
--- SWAP ZONE (409px, both fit) ----------------------
label / draw name            20                 108     draw name 19px + note 13px + [?] 44px tap
readout / result             112                  74     38% at 44px  |  ACTUAL 44px, YOU 27px
estimate bar                 72                  72     full-bleed, doubles as the error band
scale ruler                  24                  24     0 25 50 75 100
commit / next button         56                  56     full-width, primary
safe-area-bottom             34                  34
```

Type comes only from the `DECISIONS.md` scale (10 11 12 13 19 27 29 40 44).
Spacing stays on the 2.8px `--space-*` grid. No new tokens.

**The reveal inverts the type hierarchy:** `ACTUAL` takes 44px and `YOU` takes
27px. Your guess is already drawn on the bar; the true number is the thing you
memorise.

Dropped: the felt ellipse and `.accentRing`, villain backs and label (never
reveals — no range is in scope), the 226px dock, its 274px left column and
vertical divider, the fixed `.topRow { height: 74px }` (pre- and post-commit
content differ ~2× in size, so a fixed slab either clips or leaves a hole),
the 22px question (the same sentence every hand — furniture by hand three),
`cursor: crosshair`, the hover ghost and `onPointerLeave`.

Kept 1:1: the blank Turn/River placeholders — the most useful thing on the felt,
"how many cards to come" made visual. And the rail's keyboard handler: free a11y,
zero cost.

### 5.2 Preflop trainer — a flashcard, not a poker table

The 9-seat felt spends 188px of height and ~69,000px² to deliver five facts —
position, folded-before, to-act-behind, button location, blinds — at 6.9
effective px. Worst pixels-per-fact ratio on the screen. And **position is
ordinal, not spatial**: what the learner needs is "how many act behind me,"
which is a count on a line, not an ellipse.

**Replace it with a 44px seat ladder** — nine slots in action order across one
row: folded seats dimmed, hero's lit and labelled, seats behind outlined, `D`
on the button slot, SB/BB tagged. 44px instead of 188px, every fact at
full-size type, reading left-to-right the way the action actually moves. The
reclaimed 144px goes to the cards.

```
top bar                      48    hamburger, brand, depth chip, accuracy
seat ladder                  44    x x x (*)HJ o o o(D) sb bb
context line                 20    "3 folded - 3 behind", 15px
hero cards                  170    120 x 170, rank 44px / suit 40px
hand class                   52    kicker 11px + "A5s" 28px
feedback slot               140    FIXED in both states, so nothing below moves
                                   pre:  "Open or fold?" 19px
                                   post: verdict 22px + boundary 15px + [See range] 40px
flex spacer                 209    <- slack; the SE (647 usable) still fits, no scrolling
thumb row                    64    [ Fold ] [ Open ]  gap 12  |  post: [ Next hand -> ]
safe-area-bottom             34
```

Card size is the existing 82×116 hero card × 1.45 → **120×170**, whose rank and
suit land on 44px and 40px — both already in the type scale. Nothing below 11px
appears on the screen.

**On the thumb buttons: right zone, wrong height, one real hazard.** With 209px
of slack, 52px leaves value on the table — go **64px with a 12px gutter**.
The hazard is that post-commit "Next hand" lands under the finger that just
pressed "Open": give it a **300ms input lock** and the **full width**, so it is
a different *shape*, not just a different label. "See range" moves up into the
feedback slot as a 40px chip — a study action, not a thumb reflex.

The feedback slot is **height-fixed at 140px in both states** so nothing below
it moves between asking and answering.

Dropped: the nine seat plaques, chip stacks and the `0.5`/`1` amounts (constant
across every spot — zero per-spot information), the felt oval and `.accentRing`,
the sheet footer (`Close` + `navHint`, ~70px reclaimed for the grid), the
keyboard handler and every `.keyHint` badge, and the depth tab strip *inside the
trainer's sheet* — a sheet-local depth that silently does not change the drill
is a phone trap; the 3-way switch stays only in the standalone browser.

Redesigned: the dealer button becomes a `D` superscript on the ladder slot
(positional data, so it survives); `.actionContext` compresses to
`3 folded · 3 behind` on one line.

### 5.3 Chrome — the thumb zone belongs to the drill

```
44px + safe-area-inset-top, four fixed slots, never wrapping
[ RUNOUT ]  [ 60bb+ v ]                    [ streak + band dots ]  [ ... ]
```

- **44px + inset, never `height: auto` / `flex-wrap`.** Today's header wraps to
  two lines and squeezes stats to 11–12px.
- `brandSub` dies; its content becomes a **context chip** (`Odds` / `60bb+ ▾`),
  a 44px tap target opening the mode + depth sheet. One tap to switch depth
  versus today's hamburger → scroll → pick.
- **The hamburger is removed on phone**, replaced by `⋯` (44×44) opening a
  bottom sheet with the same items — reachable, instead of a 140px dropdown
  with 12px rows.
- **No bottom tab bar.** This is the explicit conflict and it resolves against
  navigation. The bottom ~100px is already the 64px Fold/Open row or the 72px
  estimate bar, plus a 34px home-indicator inset. A 56px tab bar would sit
  ~11px under a commit control — and the rail carries `touch-action: none`, so
  a stray tap *commits*. Mode switching happens maybe twice a session;
  committing happens every ~8 seconds. **Navigation lives top-right and reaches
  the thumb only as a transient sheet, when what is underneath is inert anyway.**

**Stats: a collapsed pill that expands.** Two glanceable numbers in the bar
(streak + band dots for odds, accuracy for preflop) — both change on commit,
which is the whole in-drill job. Tap opens a session sheet with hands, streak,
best streak, avg error, the full band tally, the per-category breakdown
(`perCategory` is already persisted) and **Reset** — which is where a
destructive control belongs, not 5.6px from the band dots.

**Overlays: full-screen, always.** `inset: 0`, `height: 100dvh`,
`border-radius: 0`, bottom safe-area padding. Delete `top: 8vh !important`.
28×4 drag handle, sticky 44px header, scrolling body with
`overscroll-behavior: contain`, **sticky footer** (the "Deal me another" button
is the exit path and must not scroll away). Drag-to-dismiss at >96px travel or
>0.5px/ms velocity, else spring back 180ms. Drop `backdrop-filter: blur(2px)`
on phone — a cheap win on mid Android.

**`ExplainSheet`'s two columns stack reordered, not as-is.** Stacking in DOM
order buries the answer under three steps: put `rightCol` (the head-maths card,
the number) **first**, then steps 01/02/03, then the memorise card.

**`PreflopInfoSheet`'s auto-open does not survive.** Once per depth, persisted
to `bluff-catcher:briefed:v1` as `Record<Depth, boolean>`; after that a one-line
inline note and the existing Info button. Apply on desktop too, for parity.

---

## 6. Phases

Each phase ends green: `npm run typecheck && npm run lint && npm test`.

| # | Phase | Deliverable | Gate |
|---|---|---|---|
| 0 | **Amend `DECISIONS.md`** | §2 wording | owner sign-off |
| 1 | **Extract, zero behaviour change** | `useOddsDrill`, `usePreflopDrill`, `lib/band.ts`, `lib/preflop/grid.ts` | all **573** tests pass **unmodified** |
| 2 | **Layout plumbing** | `useLayoutMode`, `breakpoints.ts`, `data-layout`, `index.html` inline script, `renderAt()` helper, CI grep | desktop renders byte-identical; 820px queries rekeyed to `[data-layout]` |
| 3 | **Phone chrome** | `PhoneTopBar`, context chip, `⋯` sheet, stats pill + session sheet, full-screen sheet frame, hover guards, 44px targets | phone chrome at 390 / 360 / 430 |
| 4 | **Phone odds trainer** | `PhoneStage`, `PhoneCommitBar` | §5.1 at 390×844; desktop untouched |
| 5 | **Phone preflop trainer** | `PhonePreflopTrainer`, `PhoneSeatLadder` | §5.2 at 390×844 |
| 6 | **Phone range view** | `PhoneRangeView`, scrub readout, `boundary.ts` | §5.3 / §3.1 |
| 7 | **Cleanup** | delete the 460 override lines; `--felt-scale` desktop-only | override CSS at 0 lines |
| 8 | *(deferred)* landscape sub-variant | §3.2 | — |

Phase 1 is the load-bearing one. It is a pure refactor: if the 573 tests pass
**without being edited**, the extraction is correct, and everything after it is
additive.

Phases 4, 5 and 6 are independent of each other and can land separately —
each is guarded by `useLayoutMode()` and cannot affect the desktop tree.

## 7. Test strategy

- **Hooks headless.** `useOddsDrill` / `usePreflopDrill` tested directly, so
  drill behaviour is covered once, not once per tree. This is what protects the
  ~32 DOM-driven `PreflopTrainer` tests: after Phase 1 they still render the
  desktop tree and still pass unchanged.
- **`renderAt('phone' | 'desktop')`** for every layout-sensitive test. jsdom is
  1024px wide by default, so tests silently cover desktop only without it.
- **Playwright projects** at 390×844, 430×932, 360×640, 744×1133, 844×390 and
  1280×860. 360×640 is the case that breaks this layout first: ~500px usable
  after chrome, versus ~750 on a 390×844.
- **Snapshot the token usage**, not the pixels — assert no font-size below 11px
  and no interactive box below 44×44 in the phone tree.

## 8. Risks

- **Two trees, double the surface.** Mitigated by the §4.3 rule, but the phone
  tree will not get equal manual attention. The CI grep and the shared-hooks
  rule are the only real guards.
- **Unlabelled grid cells are the bet of this plan** (§3.1). Check before
  Phase 6 is built, not after.
- **Identity loss.** Dropping the felt oval removes the app's strongest visual
  signature from the phone build. Mitigation — a radial felt-tint behind the
  card zone — is unproven, and the seat ladder has to carry real craft to avoid
  looking like a debug widget.
- **360×640 is unvalidated.** The 5-card board row needs 363.6px against 336px
  usable, so board card width wants a `clamp()`; on a 667-tall SE the odds swap
  zone compresses ~180px and the 44px `ACTUAL` must step down to 27px.
- **First-paint flash** if the `index.html` inline script is missed or ordered
  after the module tag.
