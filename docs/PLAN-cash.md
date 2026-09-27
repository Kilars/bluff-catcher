# bluff-catcher — Cash format plan

A **cash version** of both preflop drills: the RFI drill (open / fold) and the facing-open
drill (fold / call / 3-bet). Same app, same modes, same loop. The only new thing is a
**format** switch: *Tournament* (everything that exists today) or *Cash* (6-max, 100bb, no
ante). Read `PLAN-preflop.md` and `PLAN-3bet.md` first; this plan keeps their conventions
(`lib/` pure and tested, injectable RNG, `tsc --noEmit` + tests green every phase, values
from tokens).

Branch: `claude/brave-davinci-pn683z`, stacked on the facing-open branch
(`claude/bold-thompson-fgsf0y`).

---

## What we are building

- **Format switch: Tournament | Cash.** One persisted setting, `bluff-catcher:format:v1`,
  default `mtt`, so nobody's app changes until they flip it. It applies to the RFI and
  facing drills. The odds drill has no format and ignores it.
- **Cash = 6-max, 100bb, no ante, rake-adjusted by the source (rake unstated).** One stack depth, so the depth picker hides
  in cash.
- **Cash RFI:** hero in **LJ, HJ, CO, BTN or SB**. Open / Fold, same keys (F / J).
  - SB is new. In cash SB-vs-BB is a raise-or-fold spot the player meets every orbit, and
    the source has it. SB hero means only the BB is behind.
- **Cash facing-open:** hero on **BTN**, opener **LJ, HJ or CO**. Fold / Call / 3-bet, same
  keys (F / J / K).
  - **Two charts**: the source uses one chart for vs LJ and vs HJ, so the buckets are
    *vs LJ/HJ* and *vs CO* and bucketing adds no error on top of the source. (The source
    itself is a simplification — see "Source".)
  - **No value/bluff label.** The source does not split 3-bets by kind (see "Source").
    The verdict says "3-bet", the grid uses one 3-bet colour.
- **Stats and briefings are per format.** Cash RFI and cash facing get their own stats keys
  and their own first-visit briefing; tournament stats are untouched.
- **Owner decisions (2026-09-27):** SB is an RFI hero seat; a real 6-max felt; a short
  briefing per cash drill; vendor the source JSON for personal use.
- **Out of scope:** hand-history parsing for cash (`lib/hh` keeps the 9-max `Position` and
  must never see `SB`), SB/BB as facing hero, facing a 3-bet, 9-max cash, exploit variants.

---

## What the cash charts teach

| Seat | Cash 6-max 100bb, no ante | 9-max MTT w/ ante, 60bb+ (today) |
|---|---|---|
| LJ (6-max UTG) | 16.6% (220 combos) | 23.5% |
| HJ | 21.3% (282) | 28.7% |
| CO | 26.7% (354) | 36.5% |
| BTN | 41.8% (554) | 50.8% |
| SB | 43.3% (574), raise or fold | — (not drilled) |

- Same seats, tighter ranges: LJ has five players behind in both formats. The gap is the
  ante (less dead money) plus rake, not position.
- GGPoker calls the first 6-max seat UTG; the source calls it LJ. The app labels it LJ and
  says "LJ (UTG)" once in the briefing and the range sheet.

**Facing an open on the BTN:**

| | vs LJ / HJ | vs CO |
|---|---|---|
| 3-bet | 110 combos (8.3%) | 178 (13.4%) |
| Call | 40 (3.0%) | 40 (3.0%) |
| Continue | 11.3% | 16.4% |

- **Cash BTN is almost 3-bet or fold.** The mixed solve flats only 1.7–2.7%. The simplified
  chart's flats are 66–99, A9s, A8s, QTs, JTs; the copy calls them that, not "the solver's
  flatting range".
- **vs CO adds only 3-bets**: 54s, 76s, 87s, A7s, A6s, A3s, A2s, K9s, AJo, ATo, KJo go from
  fold to 3-bet.
- JJ and TT 3-bet in cash (they flat in the MTT chart).

---

## Source

**`jensbaagaard/poker-practice`, `data/openSourcePokerData/Cash_100_PTO.json`** (MIT repo;
its README says the range data is free to use).

- **PTO** = one action per hand (0 or 1 only), 6-max, 100bb, 2.5bb opens (SB 3bb). It is the
  pure companion of the same repo's mixed `Cash_100_GTO` solve.
- **Checked against the mixed solve:** opens are within ~1 point (16.6/21.3/26.7/41.8/43.3
  vs 16.3/21.2/27.7/42.1/43.4); BTN vs CO 3-bet 13.4 vs 13.8. vs HJ is the outlier: PTO
  3-bets 8.3% vs 10.5% mixed. The PTO facing charts reuse one 110-combo 3-bet template
  across several seats, so per-hand they disagree with the mixed solve on ~75–85 combos.
  The rounding is the source's, not ours — same rule as `PLAN-3bet.md`.
- **Provenance (owner accepted, personal use):** the ranges were scraped from a commercial
  trainer app's JS; the repo's MIT licence covers its code, not those ranges, so the licence
  is unclear. Vendoring is for personal use; revisit before the repo goes public.
- **No value/bluff split.** Deriving one ("3-bets that continue vs a 4-bet are value") was
  tried and labels 65s as value, which teaches the wrong thing. So cash 3-bets carry no
  kind.
- The chart sites (PokerCoaching, RangeConverter, GTO Wizard) are unreachable from the build
  environment, so this is the source that can be verified in code.

**Vendoring:** copy only the keys we use (`OpenLJ/HJ/CO/BTN/SB`, `3BetBTNvsLJ/HJ/CO`,
`CallBTNvsLJ/HJ/CO`) into `research/cash-100-pto.json` with a header note (repo, commit,
date). The app never imports it: the charts are transcribed as explicit hand lists in
`lib/`, like every other chart, and a test checks the transcription against the JSON.

---

## Design (revised after the five-angle review)

### Prefs: format + depth, resolved to one chart key

- Persisted: `format` (`bluff-catcher:format:v1`, default `mtt`) beside the existing `depth`.
  A stored depth is kept while in cash and comes back on return to MTT.
- Resolved: `ChartKey = Depth | 'cash'` (`chartKeyFor(format, depth)`). One key indexes
  `CHART_META` (labels, prompt, stack label, seat list), the range sets, the briefing id and
  the stats key. `CHART_META` extends today's `DepthMeta`; `DEPTH_META` stays as the MTT
  subset so untouched callers keep compiling. `PreflopSpot.depth` becomes a `ChartKey`.
- `DEPTHS` stays the three MTT tiers (menus, `loadDepth`, `lib/hh`).

### Seats

- `Position` stays the 7 non-blind 9-max seats; `lib/hh` relies on that.
- `Seat = Position | 'SB'`; `CHART_META[key].seats` is the seat list (cash: LJ HJ CO BTN SB).
- One `SEAT_META: Record<Seat, { short, long }>` in lib replaces the five label maps
  (`PreflopTable` ×2, `RangeSheet` ×2, `boundary.ts`).

### RFI charts and dealer

- `cashRanges.ts`: `CASH_RFI: Record<CashSeat, Set>`, explicit lists; `getRangeSet(seat, key)`
  and `isOpen(seat, hc, key)` accept a `ChartKey` (MTT callers unchanged).
- Boundary / edge-skew cache keyed by `ReadonlySet` (WeakMap), not `depth:pos`.
- **Deal determinism:** a golden test captures today's MTT deals for fixed seeds *before*
  any refactor. The cash branch adds no `rng()` calls on the MTT path.

### Facing charts and dealer

- `Bucket` widens to `'early' | 'late' | 'cashEarly' | 'cashCo'` in the one
  `BUCKET_META` / `BUCKET_CHART` registry. `BucketMeta` gains `format`, `kinds` and its
  source charts (for the dealer's "trash" tier, per format).
- Opener → bucket via `bucketFor(format, opener)`; cash openers are LJ, HJ, CO.
- `kinds: false` → no kind anywhere: `facingComboCounts` counts a `threeBet` total, the drill
  hook stops defaulting to `'value'`, and a new plain `'3bet'` `CellAction` draws with no
  V/B mark. The legend is built from the chart.

### Table (real 6-max felt)

- Ring per format: `RING.mtt` (9) and `RING.cash` = LJ HJ CO BTN SB BB. `buildSeats`,
  `seatSlotIndex`, `buildContextLine`, `buildLadderSlots` take the ring. Blinds marked by
  label, button by label.
- Cash slot table on the same ellipse: hero (410,322) + (103,272) (103,108) (410,36)
  (717,108) (717,272), chips one step toward the centre.
- Hero on SB: no second SB seat; hero's 0.5 chip beside hero's cards; context line "only the
  BB behind".

### UI

- Format: a Tournament | Cash segmented control at the top of the desktop `Menu` and
  `PhoneMenuSheet`, shown in RFI and facing modes. Depth group hidden in cash; Cash option
  note "6-max · 100bb · no ante". Phone sheet title "Mode & format".
- Labels: desktop subtitle/centre line "Cash · 100bb"; phone chip just "Cash" (tested no
  wider than "vs open"). Facing's hardcoded "50bb+" (`FacingTrainer`, `PhoneFacingTrainer`,
  `facingMeta.ts`) comes from bucket/format meta.
- Range browser (App `position="UTG"`): opens on the format's first seat; the depth strip
  gains Cash, which swaps in the cash seats.
- Stats: four instances (mtt/cash × rfi/facing), picked by format. (Changing one hook's key
  would copy MTT numbers into the cash key — `usePreflopStats` only reads on mount.)
- Briefings: ids `'cash'` (RFI) and `'facing-cash'`; short, same layout as the facing
  briefing.
- Trainers keyed on the chart key, so a format switch re-deals.

---

## Phases

Gate every phase: `npm run typecheck`, `npm run lint`, `npm test`.

- **C0a — data (additive):** vendor JSON, `cashRanges.ts`, cash facing charts, transcription
  tests (every non-zero JSON cell in exactly one set, no overlaps, 169-class validity,
  counts 220/282/354/554/574, 110/40, 178/40).
- **C0b — golden deals, then RFI refactor:** golden fixtures for `dealPreflopSpot` and
  `dealFacingSpot` first; then `ChartKey`, `Seat`, `SEAT_META`, WeakMap boundary, cash RFI
  dealing.
- **C0c — facing refactor:** widened `Bucket`, `kinds`, per-format trash, cash facing
  dealing (50% ± 2% split).
- **C1 — format pref + menus + labels.**
- **C2 — 6-max felt + ladder + SB hero.** DOM tests per cash hero seat; 9-max tests
  untouched.
- **C3 — cash RFI wiring** (drill, stats, briefing, range browser).
- **C4 — cash facing wiring** (verdict/grid without kinds, legend).
- **C5 — integration tests + run the app** at desktop and 390×844.

---

## Risks

- **Type widening** (`Seat`, `ChartKey`, `Bucket`) touches many files; the golden deal tests
  and untouched 9-max tests are the guard.
- **Provenance** (see "Source").
- **Rake unknown** in the source; real micro-stakes rake is high, which would tighten flats
  further.
