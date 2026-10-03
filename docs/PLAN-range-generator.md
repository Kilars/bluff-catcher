# PLAN: range lookup (`range(spot)`)

Status: **planned, not started.** Written 2026-10-03 from three investigations
(a code inventory, web research, and a fit experiment on our own charts) and a
grilling session with the owner.

## Question asked

Can one generic function, built on percentages plus range advantage, nut
advantage and stack depth, replace the many scraped chart sets and give more
spot depth? It does not need to be perfect.

## Verdict

**A formula generator is feasible for opening ranges, but it is not a good idea
for this app. For facing ranges it is not feasible.** A **lookup** over the full
source dataset delivers what was actually wanted: cleaner code and arbitrary
spots such as a CO 3-bet vs a HJ open. It does so with no fitting error.

### Why not a formula (evidence, combo-weighted agreement over 1326 combos)

| Spot kind | Best held-out result | Problem |
|---|---|---|
| RFI (26 charts) | 97.9% with a 16-feature logistic model plus a per-chart width; 91% with top-W% by equity | 3–6 hands wrong per chart, all on the boundary. The dealer deals boundary hands about 4× as often (`edgeSkewPool`), so the wrong answers are over-represented in drills |
| Facing / 3-bet / 4-bet / BB defend (27) | 84–96% overall, which is 19–57% wrong on the continuing hands | Traps (AA/KK flat at 40bb, AK/AQs flat vs 4-bets), blocker/playability bluffs, BB defend's suited-trash axis. No single ordering exists; even separate value/call/bluff scores miss |
| Depth interpolation | The 20bb chart is not between deep and 10bb | BTN goes 674 → 574 → 674 combos and the pair weight is not monotonic. Any blend did worse than the nearest deeper chart (98.4%) |

- Research (GTO Wizard, "Range Morphology"): ranges are linear only when there is
  one way to continue.
- I found no public project that fits compact models to preflop charts.
- "Range/nut advantage" are postflop concepts. Preflop they reduce to features
  (playability, blockers, depth × suitedness), and the solver output already
  includes their effect.
- Exact push/fold Nash (≤15bb) is the one place where computing ranges is truly
  correct. It is noted as a possible future piece and is out of scope.
- The experiment scripts (`dump.ts`, `equity.mjs`, `rfi.py`, `facing.py`,
  `interp.py`) stayed in the session scratchpad and are not committed.

### Why the lookup works

`jensbaagaard/poker-practice` @ `449993f`, `data/openSourcePokerData/` ships
`Cash_100_PTO` and `MTT_{5,10,20,40,100}_PTO`.

- Each file has about 270 keys on a regular grid: `Open<H>`, `3Bet<H>vs<V>`,
  `Call<H>vs<V>`, `4Bet…`, `Call 3Bet…`, `5Bet…`, `Call 4Bet…`, `Call 5Bet…`, with
  H/V ∈ EP1 EP2 EP3 LJ HJ CO BTN SB BB (9-handed grid).
- We vendor only a handful of keys today.

**Caveat: cash PTO is templated.** Number of distinct charts per action family:

| File | 3Bet | Call (vs open) | 4Bet | Call 3Bet | Call 4Bet |
|---|---|---|---|---|---|
| Cash_100_PTO | 9 of 36 | 9 of 36 | 5 of 36 | 6 of 37 | 13 of 36 |
| MTT_40_PTO | 36 of 36 | 36 of 36 | 31 of 36 | 37 of 37 | 21 of 36 |
| MTT_20_PTO | 33 of 36 | 36 of 36 | (jam) | 27 of 37 | 22 of 36 |
| Cash_100_GTO (mixed) | 36 of 36 | | | | |

In cash, CO vs HJ = CO vs LJ = BTN vs HJ (one 110-combo chart).

## Decisions (owner, 2026-10-03)

- **D1, direction:** lookup over the dataset. No formula generator, no Nash in this scope.
- **D2, cash source:** `Cash_100_PTO`, templates accepted. The source does the rounding; we never do.
- **D3, migration:** move the facing drills (BTN, BB defend, BTN vs 3-bet,
  Open vs 3-bet) onto `range(spot)` and delete the hand-copied sets. MTT RFI in
  `ranges.ts` stays as it is (9-max PokerCoaching source, UTG–UTG+2 seats).
- **D4, value/bluff:** `range(spot)` returns fold / call / raise. A value/bluff
  split is applied only where a source provides one:
  - PokerCoaching for MTT BTN vs open.
  - The existing accepted 4-bet rule (value = calls a 5-bet jam), computed from the same file's `Call 5Bet` key.
  - No derived 3-bet split (rejected before: it labelled 65s as value).
- **D5, data form:**
  - `npm run vendor-ranges` fetches the pinned upstream commit, keeps only the
    used nodes, dedupes identical charts and writes a small checked-in TS
    module, with one 169-char string per distinct chart.
  - No network access at build time.
  - This replaces the rule "app never imports the JSON / hand lists checked against JSON".
- **D6, depths vendored:** Cash 100 and MTT 40 only. Adding a depth later means one script flag.
- **D7, multiple sources:** the dataset carries a `source` per chart. The MTT
  BTN-vs-open drill ("50bb+") resolves to the PokerCoaching charts with their
  kinds, so its answers do not change.
- **D8, new spots:** a curated list. Each new spot is one descriptor line and
  appears under the existing modes with an auto-generated briefing.
  Hand-written briefings remain an optional per-spot override.

## Assumptions (made without owner input; flag if wrong)

- **A1, behaviour-neutral migration.** Every migrated drill must give identical
  answers. `golden.test.ts`, the bucket combo counts in `facing.test.ts` and the
  dealer tier tests stay green without edits. Any diff is a bug in the
  vendoring, not a re-baseline.
- **A2, buckets stay.** The BTN MTT EARLY/LATE buckets and the cash
  "vs LJ+HJ" shared chart remain drill-level groupings. A bucket becomes a list
  of spot descriptors plus the one spot it grades against.
- **A3, trash tier from data.** "Folds in every source chart for this drill" is
  computed from the lookup in place of the hand-listed sources in `facingSources.ts`.
- **A4, seat names.** Upstream EP1/EP2/EP3 map to our UTG/UTG1/UTG2. Cash drills
  keep using the 6-max seats only (LJ and later), as they do now.
- **A5, types.** `range(spot)` returns the existing `FacingChart` union
  (`PlainChart` / `KindedChart` / `FourBetChart`), so `chartAction` /
  `bucketChartAction` and the UI need no type changes. Returns `null` for an
  unknown spot.
- **A6, provenance.** The personal-use status is unchanged. The generated module
  carries the repo, commit and date header, and "revisit before the repo goes
  public" still applies, now to a bigger slice of the data.
- **A7, first new spots.** After the migration, the first new curated spots are:
  - Cash: CO vs HJ / LJ 3-bet and SB vs BTN 3-bet.
  - MTT 40: one more BB-vs-SB style spot.
  - Picked to test the descriptor path, not for coverage.
- **A8, hand-history pipeline.** `src/lib/hh/` (`faced3bets`, `flats`) imports only
  RFI today. Grading faced 3-bets and cold-calls against `range(spot)` is a natural
  follow-up but is out of scope here.

## Phases

1. **Vendor script and module.**
   - `scripts/vendor-ranges.ts`, which generates `src/lib/preflop/rangeData.ts`
     (Cash 100 and MTT 40 PTO nodes, plus the PokerCoaching BTN-vs-open charts).
   - Test: every chart the current `*Ranges.ts` files define is equal, cell for
     cell, to the generated module.
   - At the end of this phase, both systems exist side by side.
2. **`range(spot)` plus `Spot` type.** `src/lib/preflop/range.ts`:
   - `Spot = { format, depth, node, hero, villain? }`.
   - Resolves the source, applies D4's value/bluff split, returns `FacingChart | null`.
   - Unit tests for the key mapping, null on unknown spots, and the 4-bet value rule.
3. **Migrate the drills.** Rewire `facing.ts` (`BUCKET_CHART`, `BUCKET_REACHABLE`,
   `FACING_SOURCES`) and `facingDeal.ts` tiers onto spots. Delete `cashRanges.ts`
   (except `CASH_RFI` → keep or move into `ranges.ts`), `bbDefendRanges.ts`,
   `btn4BetRanges.ts`, `open4BetRanges.ts`, `facingSources.ts` and their cross-check
   tests. Gate: A1 (the golden tests are untouched and green).
4. **Curated spots plus auto-briefing.**
   - A descriptor list and a generic briefing built from chart facts: widths,
     combo counts, edge hands.
   - Add A7's spots.
   - Desktop and phone screenshot check (see the memory note on the headless
     Chrome workaround).

Each phase ships as its own commit on a dedicated branch, and phases 1–3 change
no user-visible behaviour.
