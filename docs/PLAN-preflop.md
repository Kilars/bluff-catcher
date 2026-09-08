# bluff-catcher — Preflop RFI Trainer plan

A second training mode alongside the existing Runout odds trainer. Read `PLAN.md` and
`DECISIONS.md` for the app's conventions first — this doc inherits them (pure/tested `lib/`,
injectable RNG, `tsc --noEmit` + tests green each phase, take values from tokens).

Branch: `feat/preflop-rfi-trainer`.

---

## What we are building (settled with owner, 2026-09-05)

A **preflop raise-first-in (RFI) trainer**, 9-max, across three tournament stack tiers.

- **Scope:** hero is dealt in one of the **7 non-blind seats** — UTG, UTG+1, UTG+2, LJ, HJ,
  CO, BTN. Action folds to hero. Blinds (SB/BB) are never the hero seat. Decision is a pure
  binary **Open / Fold** (no limps, no mixed frequencies).
- **Stack depth** (settled with owner, 2026-09-08): three tiers, no more. See
  "Stack depth tiers" below. The original 60bb chart is now labelled **40bb+**, unchanged.
- **Ranges:** hardcoded standard charts (owner reviews/tweaks the explicit combos in code).
- **Spot display:** two real cards on the felt + a position label + folded seats in front;
  blinds shown posted behind. Reuses the app's felt identity.
- **Sampling:** uniform base with two soft adjustments — a **gentle ~2× skew** toward
  range-edge hands, **and a downweight on obvious trash** (the hopeless junk folds like 72o
  that teach nothing). Every combo can still appear; the trash just shows up rarely and the
  edges a bit more. The point is internalising the *shape*, not memorising the exact flip
  combo. Implemented behind a **pluggable pool strategy** so the distribution can be swapped
  later without touching the UI.
- **Answer loop:** commit Open/Fold → minimal **verdict** ("Correct — fold" / "Wrong — this
  is an open"). **Always wait for input** to advance (no auto-advance). Keys: **F = Fold,
  J = Open**; buttons also clickable.
- **Explainer:** a **Range** button opens a sheet showing the **full 13×13 grid** for that
  position — open cells vs fold cells, hero's hand marked.
- **Stats:** own localStorage key, separate from the odds trainer. Header swaps to
  **Hands / Streak / Accuracy %** when in preflop mode.
- **Navigation:** hamburger (top-left of header) → menu with **Odds trainer** / **Preflop
  RFI**. Whole-view swap. Last-used mode persisted; Odds trainer is the first-ever default.

---

## Stack depth tiers (settled with owner, 2026-09-08)

RFI hand selection barely moves between 40bb and 100bb — a 60bb chart and a 100bb chart
differ by a couple of combos, which is noise to a learner. Shipping both would teach that a
distinction matters when it doesn't. So the original chart is **relabelled 40bb+** and covers
everything from 40bb up; 80bb and 100bb are deliberately *not* separate tiers.

What actually changes in a tournament is the way **down**:

| Tier    | Label | Action     | What it teaches |
|---------|-------|------------|-----------------|
| `deep`  | 40bb+ | Open/Fold  | Baseline RFI shape by position. Full playability — set-mining and suited connectors are worth it. |
| `mid`   | 20bb  | Open/Fold  | Same width, different shape. Implied odds are gone: weak connectors/gappers out, suited aces + suited kings + offsuit broadways in. EP tightens, LP widens on fold equity. |
| `short` | 10bb  | **Jam**/Fold | Raise-folding no longer exists. Raw showdown equity + fold equity: every pair and every suited ace jams from every seat; BTN jams >50%. |

Implemented widths (% of 1326 combos):

| Pos        | deep 40bb+ | mid 20bb | short 10bb |
|------------|------------|----------|------------|
| UTG        |     13.6%  |   12.5%  |     15.2%  |
| UTG+1      |     14.6%  |   13.6%  |     16.7%  |
| UTG+2 (LJ) |     17.8%  |   17.3%  |     20.1%  |
| HJ         |     21.3%  |   21.6%  |     24.3%  |
| CO         |     26.7%  |   27.9%  |     32.1%  |
| BTN        |     45.4%  |   44.8%  |     50.2%  |

Notes on the implementation:

- `Depth = 'deep' | 'mid' | 'short'` lives in `lib/preflop/ranges.ts` alongside `DEPTH_META`,
  which carries every user-facing string for a tier (label, stack figure on the plaques,
  action verb, verdict noun, prompt). The UI never hardcodes "Open" or "60 bb" again.
- `isOpen` / `getRangeSet` / `rangeComboCount` take `depth` as an **optional trailing**
  argument defaulting to `'deep'`. Every pre-tier test therefore still pins the deep chart
  unchanged — which is the proof the rename moved no combos.
- `PreflopSpot.correct` stays `'open' | 'fold'` at all three tiers. `'open'` means "put chips
  in"; the UI renders it as "jam" at 10bb via `DEPTH_META[depth].actionLabel`. The data layer
  does not need two words for one binary decision.
- Depth is chosen from the header menu, persisted to `bluff-catcher:preflop-depth:v1`, and
  App remounts `PreflopTrainer` on a change (`key={depth}`) so the spot re-deals and the
  briefing re-opens for the new tier.
- The **J key** commits the aggressive action at every tier — only its label changes.
- Stats stay a single pool across tiers. Splitting accuracy per depth is deliberately out of
  scope: the point is the big picture, not a per-tier scoreboard.

## Hand model

The 169 canonical hand classes (13 pairs, 78 suited, 78 offsuit), notated `AA`, `AKs`,
`AKo`. A dealt spot has two concrete cards (e.g. `As Kh`) which classify to one class.

Each position's range is stored as an **explicit set of hand classes** (not a prefix of a
single ranking — real charts aren't linear, e.g. `A5s` in but `KTo` out). Correctness =
membership test against that set.

For skew weighting only, a canonical **169-hand strength ranking** defines "distance from
the edge": the boundary is the band straddling the weakest included / strongest excluded
class for that position; classes within a small rank window get the ~2× weight. Approximate,
but fine for a gentle nudge.

---

## Proposed range chart (targets — owner reviews explicit combos in Phase P0)

| Pos        | ~%   | Shape (top-line) |
|------------|------|------------------|
| UTG        | ~15% | 55+; ATs+, KTs+, QTs+, JTs, T9s, 98s; AJo+, KQo |
| UTG+1      | ~16% | 44+; A9s+ (+A5s–A4s), KTs+, QTs+, J9s+, T9s, 98s; AJo+, KQo |
| UTG+2 (LJ) | ~19% | 33+; A8s+ (+A5s–A2s), K9s+, QTs+, J9s+, T9s, 98s, 87s; ATo+, KJo+ |
| HJ         | ~22% | 22+; A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+; ATo+, KTo+, QJo |
| CO         | ~28% | 22+; A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+; A9o+, KTo+, QTo+, JTo |
| BTN        | ~45% | 22+; A2s+, K5s+, Q6s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s; A7o+, K9o+, Q9o+, J9o+, T9o |

Wheel suited aces (`A5s–A2s`) get included progressively from LJ onward per standard charts.

---

## Phases

### Phase P0 — Range data + core lib  *(Opus-owned — the correctness core)*

**Goal:** pure, tested `lib/preflop/`.

- `lib/preflop/hands.ts` — the 169 hand-class model: enumerate classes, parse two concrete
  `Card`s → class, notation helpers, the canonical strength ranking.
- `lib/preflop/ranges.ts` — the 7 explicit RFI range sets (the chart above) + `isOpen(pos,
  handClass)` membership test. Positions enum: `UTG, UTG1, UTG2, LJ, HJ, CO, BTN`.
- `lib/preflop/deal.ts` — `dealPreflopSpot(opts)`:
  - Pick a position (uniform over the 7).
  - Sample a hand via a **`Pool` strategy** interface. Default `edgeSkewPool` weights each of
    the 1326 combos = base 1×, with **~2×** for classes near the position's range boundary and
    a **downweight (~0.25×)** for obvious-trash classes (weakest tier of the strength ranking,
    well below any position's opening range and not near its edge). Never zero — every class
    stays reachable. Injectable RNG (seeded for tests). Ship a plain `uniformPool` too,
    selected behind a constant so swapping is a one-line change.
  - Return `{ position, cards: [Card, Card], handClass, correct: 'open' | 'fold' }`.

**Acceptance:** `hands.test.ts` round-trips every concrete pair → correct class; ranking is
total and stable. `ranges.test.ts` asserts each position's combo count ≈ target % (±1.5%)
and spot-checks named boundary hands (e.g. CO opens `K7s`, folds `K6s`). `deal.test.ts`
(seeded) only returns valid spots, `correct` always matches `isOpen`, and over N deals
edge classes appear ~2× a mid hand, trash classes are suppressed (~0.25×), and every class
still appears at least once. All green.

### Phase P1 — Mode-switch shell  *(Opus)*

**Goal:** two coexisting modes with a menu, without disturbing the odds trainer.

- Lift a `mode: 'odds' | 'preflop'` state to the app root; persist last-used to localStorage
  (`bluff-catcher:mode:v1`); default `odds` on first load.
- Extract the current `App` body into `modes/OddsTrainer.tsx` (pure move, no behaviour
  change); new root renders `<Header>` + the active mode.
- `components/Menu.tsx` — hamburger button (top-left of `Header`) + dropdown/sheet listing
  the two modes; a11y (focus trap, Esc, aria).
- `Header` gains a mode-aware content slot (odds stats vs preflop stats).

**Acceptance:** odds trainer works exactly as before under `mode='odds'`; menu switches
views; reload restores last mode; `tsc`/tests green; no regression in existing tests.

### Phase P2 — Preflop table + input  *(Haiku, Opus-reviewed)*

**Goal:** the preflop spot screen.

- `modes/PreflopTrainer.tsx` — owns spot state (`dealPreflopSpot`), commit, next.
- `components/PreflopTable.tsx` — felt reusing the existing look: hero's two cards, a clear
  **position label**, folded seats in front of hero, blinds posted behind. No board.
- Open / Fold buttons + keyboard (**F** fold, **J** open). Commit locks input until advance.

**Acceptance:** dealing shows a legal spot with the right position; F/J and buttons commit;
matches the felt's visual language; desktop first (phone in P5).

### Phase P3 — Verdict + stats  *(Haiku)*

**Goal:** close the loop and persist.

- On commit: compute correct/incorrect vs `spot.correct`; show minimal verdict + the correct
  action; wait for input (tap / any key / dedicated Next) to deal again.
- `hooks/usePreflopStats.ts` over localStorage (`bluff-catcher:preflop:v1`): hands, current
  streak, bestStreak, correct count → accuracy %. `record(correct)`, `reset()`.
- Header (preflop slot) shows **Hands / Streak / Accuracy %** + Reset.

**Acceptance:** verdict is correct for boundary hands; reload preserves hands/streak/accuracy;
reset clears; streak breaks on a miss.

### Phase P4 — Range explainer  *(Haiku)*

**Goal:** the full-range study view.

- `components/RangeGrid.tsx` — the 13×13 matrix (pairs on the diagonal, suited upper-right,
  offsuit lower-left, standard orientation). Open cells vs fold cells styled from tokens;
  hero's current hand cell marked.
- A **Range** button (available after commit, and/or always) opens it in a sheet reusing
  `ExplainSheet`'s chrome/animation. Shows the position title + the grid.

**Acceptance:** grid orientation/labels correct for all 169 cells; open/fold colouring
matches `isOpen`; hero cell highlighted; opens/closes like the existing sheet.

### Phase P5 — Responsive + polish + verify  *(Haiku, then Opus /polish + /verify)*

- Portrait-phone layout for the preflop screen (buttons in the thumb zone; grid fits width).
- `/polish` pass; `/verify` the full loop (deal → commit → verdict → range grid → next) on
  desktop and at 390×844, plus the mode switch. Confirm odds trainer still unaffected.

**Acceptance:** whole preflop loop usable one-thumbed; menu + both modes clean; no clipping;
odds trainer unchanged.

---

## Notes for subagents

- `lib/preflop/` stays pure and UI-free; all randomness injectable.
- Do not modify odds-trainer behaviour; the P1 extraction is a pure move.
- Take colours/spacing/type from `styles/tokens.css`; reuse felt/sheet styling, don't fork it.
- Every phase leaves `tsc --noEmit` and `npm run test` green.
