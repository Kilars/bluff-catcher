# Plan — slice the range browser's menu

Status: **shipped** (phase 1 2026-10-08, phases 2–3 2026-10-09). Follows the menu rework in DECISIONS.md
("The range browser's menu: format, spot, stack, seat, versus").

## The essentials

- One stroke down through the strips picks a tab in every row it crosses:
  **Spot → (Stack) → Your seat → Versus**. A tap still picks one tab, so the slice
  only adds to what's there.
- **Format stays a tap.** It decides which rows and columns exist, so it's
  picked before a slice, never during one.
- **Every row stays on screen for the format.** A tab that doesn't apply is greyed
  and disabled, not removed. Within a format the layout never moves, so the
  finger's target doesn't move under it.
- **Seat and versus share columns.** Both rows list the format's table in
  action order (cash 6, tournament 9), so a slice reads geometrically: an open
  comes from the left (down-left stroke), a 3-bet from the right (down-right).
- Phase 1 (always-on rows, browser owns all five axes) is worth shipping even
  if the slice is dropped. Phase 2 is the gesture. Phase 3 is the trail
  animation.

## 1. What changes for the user

Today, after the Format row, there are three taps, and rows appear, disappear
and change width between them (Open has no versus row; 3-bet's seat row is
built from the chart pages; Stack exists only for tournaments, with different
tabs per spot).

After:

```
Format   [ Tournament | Cash ]                       ← tap only
Spot     [ Open | 3-bet | 4-bet ]           (Drill first, from a trainer)
Stack    [ 10bb  20bb  40bb  50bb+  60bb+ ]           tournament only
Seat     [ UTG UTG1 UTG2 LJ HJ CO BTN SB BB ]
Versus   [ UTG UTG1 UTG2 LJ HJ CO BTN SB BB ]
```

Greyed out, by what's already picked (the rules in §3):

- Open: Stack offers 10/20/60bb+; Seat offers the RFI seats; the whole Versus
  row is grey.
- 3-bet: Stack offers 40bb/50bb+; Versus offers the seats that act **before**
  hero (the openers).
- 4-bet: Stack offers 40bb; Versus offers the seats that act **after** hero (the
  3-bettors).
- 50bb+: Seat offers BTN only.

Cash has no Stack row and a 6-column table (LJ HJ CO BTN SB BB). That's the
"tournament seats disappear in cash" case: it's a format change, made by tap,
so nothing moves mid-gesture.

## 2. The gesture

- **Where:** pointer events on one wrapper around the Spot…Versus rows,
  `touch-action: none` on it only. Pointer capture on down. The grid's scrub and
  the view's horizontal page swipe are separate siblings; the wrapper stops
  propagation of the touch events, so a slice never pages the seats.
  PhoneSheet's drag-to-dismiss starts only on the handle and header, so it
  doesn't conflict.
- **Hit-test:** row rects and tab rects are measured on pointerdown
  (`getBoundingClientRect`, as the grid scrub does). Each move gives the row
  under the finger and the tab under the finger. Nothing is assumed about pitch.
- **What a row picks:** the tab where the stroke **crosses the row's centre
  line** (built: "the last tab touched" picked the wrong seat on every
  diagonal, which leaves a row over the neighbour of the tab it crossed). The
  press point picks too, and so does a mostly sideways move inside a row, so
  you can drift along a row to correct. A disabled tab is passed over.
- **Commit:** live. Each pick applies as soon as it's made (the chart below
  redraws mid-stroke), and the next row's enabled set is recomputed from it.
  Going back up a row re-picks it. There's no cancel: a wrong pick is fixed by
  a tap.
- **Tap vs slice:** a stroke that stays in one row and moves less than 8px is a
  tap, and the button's own click handles it. The gesture code only acts once
  a stroke has crossed into a second row. Before that, horizontal drags within
  one row behave as today (they pick the last tab, the same as a tap at the end).
- **Keyboard / a11y:** unchanged. Every row stays a `role="tablist"` of
  buttons. Disabled tabs get `aria-disabled` and stay focusable-but-inert
  (no `disabled` attribute, so screen readers still announce them).
- **Desktop:** the same handlers work with a mouse drag. There's no
  desktop-only code.

## 3. Rules — one pure module

`src/lib/preflop/browserAxes.ts` (no React), the single source for what's
enabled and what a pick falls back to:

```ts
interface Axes { format; spot; stack; hero; villain }
rows(format, drill?): RowSpec[]               // fixed per format: ids + labels
enabled(axes, row): Set<id>                   // greyed = not in it
pick(axes, row, id): Axes                     // sets one axis, repairs the ones below
```

`pick` repairs top-down. When a pick leaves a lower axis invalid, that axis
moves to the nearest enabled column to where it was (built that way: the
picks themselves carry across spots, so there's no per-spot memory beyond
the stack). Order:
Spot → Stack → Seat → Versus. It's built from what exists today:
`DEPTHS`/`CHART_META[...].seats` for Open, `pairSetsFor`/`pairChartPages` for
3-bet/4-bet (a versus is enabled iff `pairPageId(set, node, hero, villain)` has a
page). Each spot keeps its own tournament stack (`Axes.stacks`).

Tests here carry the logic. The component tests only check wiring.

## 4. State moves up

Seat and versus are currently the views' internal state (`pageIdx`,
`pickedPos` in RangeSheet and PhoneRangeView, grouped by `pageGroups`). A slice
has to set them, so:

- ChartBrowser owns all five axes and renders all five rows itself (phone and
  desktop share them; styles in `ChartBrowser.module.css`). Built inline as
  `row()`; extract a `BrowserMenu` when phase 2 adds the pointer handling.
- The views get a **controlled** mode: `page` (index) for pair charts,
  `position` for Open, and a `menuExternal` flag that hides their own seat,
  chart and position strips. Trainers keep the uncontrolled mode untouched.
- Swipe-to-page on the phone view calls back (`onStep`) in controlled mode,
  and the browser steps Versus, then Seat.
- Drill keeps its own tabs (DECISIONS: they're the drill's navigation). In the
  Drill spot the rows below Spot give way to them (built: greying them only
  doubled the seat rows), and a slice that starts on Drill picks Drill only.

## 5. The trail (Phase 3)

- A `<canvas>` overlay over the menu wrapper, `pointer-events: none`. It keeps
  the last ~120ms of points and draws a tapered stroke (wide at the head,
  0 at the tail) in `--color-accent`, fading out over 180ms after release.
  rAF only while drawing.
- Each pick flashes its tab: a 160ms scale 1→1.06→1 and a brief accent glow
  (CSS class toggled on pick, `animationend` clears it).
- `navigator.vibrate(8)` on each pick where it exists (Android; iOS ignores it).
- `prefers-reduced-motion`: no trail, no scale, and picks still highlight.
- No dependency. It's about 80 lines.

## 6. Phases

1. **Always-on rows (no gesture).** `browserAxes.ts` with tests, `BrowserMenu`,
   controlled views, aligned seat/versus columns, greying. This ships alone
   and is useful alone: nothing jumps when switching spot.
2. **Slice.** Pointer handling in `BrowserMenu`, tested with synthetic pointer
   events and stubbed rects (as the grid scrub tests do), plus a puppeteer
   screenshot pass on phone and desktop (see the Chrome screenshot workaround
   in memory).
3. **Trail and flash.**

Each phase is one commit to main. DECISIONS.md gets an entry with the
assumptions below.

## 7. Assumptions (easy to reverse)

- Format isn't sliceable. It reshapes the rows.
- Stack is in the slice path for tournaments, as one depth-ordered row
  (10 · 20 · 40 · 50+ · 60+), not per-spot tabs. The notes ("BTN only",
  tier names) move into the tabs' `title`.
- Picks commit live, with no cancel.
- 9 columns on a 360px phone: 9 × 34px + 8 × 3px gaps = 330px, which fits the
  332px measure. Labels use the existing short forms (`UTG1`, not `UTG+1`).
  The rows are 36px tall, under the 44px minimum, which is acceptable because
  the slice and the drift-within-row rule don't need a precise first touch.

---

## Review

Reviewed after drafting, against the code (`ChartBrowser.tsx`,
`PhoneRangeView.tsx`, `RangeSheet.tsx`, `pairCharts.ts`, `PhoneSheet.tsx`).

**Is it realistic?** Yes. Nothing here needs new infrastructure. The grid
scrub already does measured hit-testing with pointer capture, and the dismiss
gesture is confined to the sheet's header. The real cost is Phase 1's state
lift, not the gesture. Estimate: Phase 1 is the bulk; Phase 2 is roughly 150
lines plus tests; Phase 3 is small.

**Is it good?** Mostly, with three honest caveats:

1. **Speed gain is modest; accuracy is the risk.** Three taps take about 1.5s.
   A slice takes about 0.5s only when it lands. Steering a diagonal through
   34px columns on three rows is harder than three taps, especially at 9-max.
   The *last enabled tab in the row* rule turns the slice into
   "drag, adjust, drop down" (like a marking menu), which is forgiving. The
   aligned columns make the common strokes short (CO vs HJ is one column
   left). Expect it to feel great for the user's own repeat lookups and
   clumsy for first-timers. Taps remain, so nothing is lost.
2. **Discoverability.** Nobody will guess it. Mitigation: the trail also draws
   on a plain tap-drag inside one row, so the effect hints at itself. No
   coach-marks.
3. **Live commit redraws the chart up to four times per stroke.** That's
   cheap (169 cells, memoised pages), but the chart flickering under the
   finger may distract. If it does, buffer the picks and commit on release.
   The rows' greying still updates live. The decision is deferred to Phase 2's
   screenshot pass.

**Changes made in review:**

- Moved Format out of the slice (it reshapes columns; the user suggested this
  too).
- Added the tap threshold. Without it, every tap that wobbled into the next
  row would be read as a slice.
- Kept disabled tabs focusable with `aria-disabled`, not `disabled`, so the
  greyed axes are still announced.
- Made the rules a pure module first. Greying, fallbacks and the slice all
  read one `enabled()`, so the gesture can't pick a combination the tap path
  would reject.

**Open risk, not resolved:** the hero dot and the dealt-pair start page
(`startPage`, `spotHere`) move from the views into the browser with the state
lift. That logic has tests in `ChartBrowser.test.tsx` and should keep them
green unchanged. If it doesn't, that's the regression to look at first.
