# Plan: give the aggressor's flop c-bet real coverage

## Why — and what this plan does NOT do

A strong user pointed at a blind spot: **"the coach can't tell me I c-bet too much."**
Being honest: **this plan does not answer that.** "Too much" is a *frequency* claim, and
the label layer cannot own frequency. The frequency answer already exists in the stats
layer (Phase 3a documents where). What this plan closes is the adjacent, genuinely-missing
gap: **the label layer has no concept of a flop c-bet**, so it can never flag *this* c-bet
as a questionable spot.

Verified:
1. **The rate already exists.** `stats.ts` computes `cbetFlop = cbets / cbetOpps`
   (stats.ts:337-341), bands it (stats.ts:110-117), splits it by texture
   (`splitByBoard('cbetFlop', …)`, stats.ts:402).
2. **The coach can't see it.** `--mode coach` builds `familyBriefs` (packet.ts:77) from
   labels only; `renderCoachJson` (report.ts:300) takes no `Summary`. The rate never
   reaches the judge.
3. **The label layer has no c-bet.** Only `overbet-strong` fires on a PFA flop bet
   (labels.ts:155).

Structural rules the label layer imposes: **anti-counting** (labels.ts header: *"nothing
here counts"* — grouping replaces rates) and **no villain range** (labels.ts:129-137).

**Blind spots this plan will not fake:** *thin value* (a marginal made hand that should
check — `handClass` collapses it; a label over-fires) and *"right hands, too many"*
(distributional, not per-decision — grouping *rewards* consistency, so a correct air-bluff
repeated often is indistinguishable from good play). Both belong to the stats layer.

## Scope after review — what's in, what's deferred, and why

The first two review rounds killed the ambitious half of this plan. It is **deliberately
small**: two labels, no data-layer change, no judge-payload change.

**Deferred (NOT in scope): a caller-aware board read + `cbet-air-caller-board`.** The idea
was to flag air c-bets into a board the *caller's* range favours. It was going to derive
"is the caller a wide blind-defender or a tight cold-caller" from `HeroHand.role`. **That
is impossible:** `role` is *Hero's own* preflop role, set to `blind-defend`/`cold-call`
only when Hero *called* (hero.ts:258-260); but a c-bet gates on `d.pfa`
(`lastPreflopRaiser === hero`, hero.ts:356), so Hero's role is always a raiser role and
carries zero information about the caller. The caller's seat width *is* recoverable, but
only by **new** logic walking preflop `allActions` + `BLINDS` to identify who called Hero
and whether that seat is a blind — real hero/parser-layer work this plan does not scope.
And even built, the surviving predicate (air, heads-up, wide caller, one texture) fires an
estimated **~0–1 spots** on the real cash sample — below the value bar for a new data-layer
read that would also ship a new field into the judge payload. Revisit only if the spot
proves recurrent; see Open questions.

Dropping it removes the entire `Enriched`/`boardFavoursPfa`/judge-payload back-compat
surface the second review flagged as P0. Neither in-scope label touches `enrich.ts`, the
judge payload, or any serialized key set — both are pure `labels.ts` predicates over
existing fields, threaded into `labelsFor` exactly like `betFlop`/`villainBetFlop` today
(labels.ts:100-104, 261-271).

## Phase 1 — `cbet-multiway-air` (new family, cheapest real win)

A **new family `PFR c-bet selection`** with one label:
- **`cbet-multiway-air`** — `d.pfa && d.street==='flop' && d.kind==='bet' && !d.facedBet &&
  hand==='air' && playersToFlop > 2`. An air c-bet into 3+ players, where fold equity
  requires every villain to fold. `!d.facedBet` states the contract (excludes the
  caller-donked-then-Hero-raised case, which is not a c-bet).

`playersToFlop` exists on the decision stream (computed labels.ts:225) but is **not** a
`labelsFor` parameter — it must be threaded in (one new param, like `betFlop`).

A one-label family cannot fire a `throughlineHolds` (needs ≥2 distinct labels,
priority.ts:205) — that is fine: `familyRelevance` still surfaces it on its single label.
It earns nothing at n=1 (`sharedFacets` empty, `evidence` floors at 0.5) — the built-in
overfit brake. Deliberately no bare `cbet-air`: an air c-bet heads-up on a dry board is
standard, and grouping would surface textbook play as a leak.

## Phase 2 — `barrel-abandon` (in `PFR flop passivity`)

- **`barrel-abandon`** — `d.pfa && d.street==='river' && d.kind==='check' && hand==='air'
  && betFlop && betTurn`. The `RC4835204203` pattern: two barrels then a river give-up
  with air. Needs one new per-street set `betTurn` (exact copy of the existing `betFlop`,
  labels.ts:239). `hand==='air'` excludes the showdown-value check, so it cannot co-fire
  with `river-check-value` (which needs `strong`/`marginal-made`, labels.ts:180-187).

Home: `PFR flop passivity`. **Honest note:** this stretches that family's stated
hypothesis (*"surrenders the initiative earned preflop — checking flops and draws that want
a bet"*, rubric.ts:156) — a river give-up after two barrels is a give-up of *held*
initiative, not a preflop-earned one. Either widen the hypothesis to *"surrenders
initiative across the hand — declining to fire, or abandoning a barrel line"* or accept it
as the least-wrong home and say so. It is **not** the same thesis as `pfa-check-turn`; do
not claim a clean fit.

## Phase 3 — The frequency seam (documentation only)

- **3a (in scope): document the boundary** in `docs/leak-coaching.md` — aggregate/
  per-texture c-bet *frequency* is a stats-layer concern (already in the leaks report); the
  label layer covers *selection*, not rate. Zero code. This is the honest answer to the
  originating "too much" question.

(A bounded denominator on the group — "4 of 11 c-bettable flops" — was considered and
**rejected**: it is a rate with the serial number filed off, violating anti-counting while
looking compliant. Piping the real `cbetFlop` stat into the judge is an Open question,
never to ship without a hard `assertBlind`-style check that the judge does not coach the
rate.)

## Predicate contracts

| Label | Contract | Threading needed | Family |
|---|---|---|---|
| `cbet-multiway-air` | `d.pfa && flop && bet && !d.facedBet && hand==='air' && playersToFlop>2` | `playersToFlop` → `labelsFor` | PFR c-bet selection (new) |
| `barrel-abandon` | `d.pfa && river && check && hand==='air' && betFlop && betTurn` | `betTurn` set (copy of `betFlop`) | PFR flop passivity |

## Full file set — each label is ONE atomic commit

`LABELS`, `BASE_PRIORITY`, `RUBRIC`, `HYPOTHESIS` are total records; `priority.test.ts`
pins FAMILIES-partitions-LABELS and `doc.test.ts:172-177` pins LABELS ↔
`docs/leak-coaching.md` bullets (regex `[a-z-]+` — both names conform). Each label commit:
1. `labels.ts` — predicate + `LABELS` + threaded param (`playersToFlop` / new `betTurn` set).
2. `rubric.ts` — `RUBRIC` entry; for the new family, the `HYPOTHESIS` entry.
3. `priority.ts` — `BASE_PRIORITY` (conservative); for `cbet-multiway-air`, the new
   `Family` union member + `FAMILIES` entry.
4. `docs/leak-coaching.md` — the label bullet.
5. `labels.test.ts` — synthetic `CASES`: positive + the gate-negatives (for
   `cbet-multiway-air`: heads-up air c-bet does NOT fire; a made hand does NOT fire. For
   `barrel-abandon`: a lone river bet-then-check without `betTurn` does NOT fire; a
   non-air check does NOT fire).
6. `priority.test.ts` — the partition assertion is self-adjusting (compares `FAMILIES`
   flat against `LABELS`); only the human-readable name string needs the count bump
   (15→17 labels, 5→6 families). For the new one-label family, no `throughlineHolds` test
   is needed (it cannot fire one); the partition test covers membership.

No `enrich.ts`, no judge-payload, no `Enriched` field, no `decisionDetail`/`HandFacts` key
change — both labels are internal to `labels.ts` derivation and thread only booleans/counts
into `labelsFor`. So there is no serialized-shape back-compat to manage.

## Baseline — fence the red typecheck first

Same fence as `label-coverage-plan.md`: `npm run typecheck` is red on pre-existing
coach-judge WIP — as of the label-coverage work, **9 errors** in `packet.ts`
(`Removal[]`→`string[]`), `judge.test.ts` and `priority.test.ts` (`Severity`/`ref`) — while
vitest is green. `priority.ts`/`priority.test.ts`/`labels.ts` are in this plan's footprint,
so new red would be indistinguishable. **Re-verify the exact error set at implementation
start** (the count may have drifted), record it, and diff per phase; do not expect green `tsc`.

## Test strategy

Synthetic `CASES` in `labels.test.ts` are the proof (exact label set per decision; positive
+ the gate-negatives above). Both labels are fully constructible synthetically (multiway
air c-bet; two-barrel-then-river-check-with-air) — no committed real fixture is required for
either. Freeze existing `CASES` `want` arrays as regression gates; run the results-blindness
sweep (doc.test.ts:69-83) per phase. A CLI run on gitignored `hands/cash` is
non-authoritative colour only — no decision gate depends on it.

## Guardrails (must hold)

- **Anti-counting:** no label quotes or implies a rate.
- **Results-blindness:** predicates read blind fields (`hand`, `playersToFlop`, action
  sequence); board cut at the decision street. `playersToFlop`/`betTurn` are not money keys,
  so the blindness sweeps do not false-positive.
- **No villain range:** neither label infers a villain holding.
- **Candidate-not-verdict:** each rubric leads with an `unless` (air multiway with backdoor
  equity exists; a river give-up on a bricked board can be correct). Never coach a frequency.
- **Naming discipline (firstInOpp trap):** each name asserts only its boolean —
  `cbet-multiway-air` = PFA + flop bet + air + 3+ players; `barrel-abandon` = two barrels
  (`betFlop && betTurn`) then a river check with air.

## Definition of done / rollback

Each label is one additive commit, independently revertable. No judge-payload or
serialized-key change, so no cross-consumer back-compat. `barrel-abandon`'s family-hypothesis
wording decision (widen vs. note) is part of its commit.

## Open questions

- **`cbet-multiway-air` `playersToFlop` cutoff:** `> 2` (3-way+) as written. Confirm 3-way
  is already meaningfully multiway for fold-equity purposes, or reserve for 4-way+.
- **Caller-aware board read / `cbet-air-caller-board`:** deferred (see Scope). Revisit only
  with (a) a real caller-seat-width derivation from preflop `allActions` + `BLINDS`, and
  (b) evidence the spot recurs on real sessions.
- **Piping the `cbetFlop` stat to the judge:** only behind a hard anti-rate-coaching check.
  Not planned.
