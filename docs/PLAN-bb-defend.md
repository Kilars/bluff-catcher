# bluff-catcher — BB defend trainer plan

A fourth drill, separate from the BTN facing-open drill. Someone opens, it folds to hero in the
**big blind**, and hero chooses **Fold / Call / 3-bet**. Read `PLAN-3bet.md` and `PLAN-cash.md`
first: this plan reuses their conventions (`lib/` pure and tested, injectable RNG, `tsc --noEmit`
+ tests green every phase, values from tokens) and most of their code.

Branch: `claude/jolly-faraday-rdlzho`.

---

## What we are building

- **New mode `bbdefend`, menu label "BB defend".** Its own mode, stats, briefing and range
  sheet. The BTN facing drill is untouched.
- **Hero seat: BB only.** Opener is any seat that can open into the BB:
  - Tournament (9-max): UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN, **SB**.
  - Cash (6-max): LJ, HJ, CO, BTN, **SB**.
  - SB vs BB is included: it's the most common BB spot at a real table and the source has it.
    The felt shows SB raising (raise chip), not a posted blind.
- **Both formats**, following the existing format switch (`bluff-catcher:format:v1`). The depth
  picker stays hidden in this mode, like the BTN facing drill.
- **Same answer loop and keys as the BTN facing drill:** F = Fold, J = Call, K = 3-bet, Space /
  Enter next, R range sheet, I briefing, Escape closes.
- **Pure charts, no mixing.** One right answer per hand. The source is already pure.
- **No value/bluff label.** The source does not split 3-bets by kind, so the chart is a
  `PlainChart` (one 3-bet colour), exactly like the cash BTN charts.
- **Solver baseline**, no exploit variant.

---

## Source

**`jensbaagaard/poker-practice`, `data/openSourcePokerData/`** — the same repo the cash drills
already vendor (`research/cash-100-pto.json`, owner decision in `PLAN-cash.md`).

- Keys: `3BetBBvs<seat>` and `CallBBvs<seat>`, 169 hands each, values 0/1 only (PTO = pure).
  Fold = neither. Seat names: `EP1 EP2 EP3 LJ HJ CO BTN SB` (9-max) → our `UTG UTG1 UTG2 LJ HJ
  CO BTN SB`.
- **Cash:** `Cash_100_PTO.json` (6-max, 100bb, 2.5bb opens, SB 3bb). Add the BB keys for
  LJ/HJ/CO/BTN/SB to the existing vendored subset.
- **Tournament:** `MTT_40_PTO.json` (owner pick, 2026-09-27; the pack also has 100 / 20bb).
  Labelled "40bb" — honest, though the RFI drill labels its 40bb solve "60bb+" and the BTN
  drill labels its 100bb solve "50bb+".
- Both vendored in `research/bb-defend-pto.json` (BB keys only, with a `_source` block).
- **Validation in B0:** for every chart, assert the two sets are disjoint, the combo totals are
  pinned in tests, and defend % rises monotonically-ish from UTG → BTN (sanity, not a hard rule
  — SB is its own shape). Record the combo counts in this doc once extracted.
- **Transcription:** charts live as TS sets (like `cashRanges.ts`), generated once from the JSON
  by a small checked-in script, and a test re-reads the JSON and asserts the TS sets match
  cell for cell. The JSON is the source of truth; nobody hand-edits the sets.

---

## Buckets: none — one chart per opener (decided from the data)

The plan was to bucket openers like the BTN drill (≤ ~26 combos of error). The data rules it out:

| | Nearest neighbour gap | Widest gap |
|---|---|---|
| Tournament 40bb (8 openers) | 74 combos (UTG ↔ UTG+1) | 570 (UTG ↔ BTN) |
| Cash 100bb (5 openers) | 52 combos (LJ ↔ HJ) | 482 (LJ ↔ SB) |

- Even the closest pair is 3× over the error budget, so every opener gets its **exact chart**
  (13 charts). Openers are picked uniformly: SB gets 1/8 of tournament deals, 1/5 of cash.
- Defend % (3-bet / call combos):

| Opener | 40bb MTT | Cash 100bb |
|---|---|---|
| UTG | 44.2% (76 / 510) | — |
| UTG+1 | 48.1% (86 / 552) | — |
| UTG+2 | 52.9% (98 / 604) | — |
| LJ | 56.6% (90 / 660) | 21.9% (86 / 204) |
| HJ | 60.2% (128 / 670) | 25.8% (86 / 256) |
| CO | 66.5% (166 / 716) | 30.6% (118 / 288) |
| BTN | 78.3% (218 / 820) | 40.0% (188 / 342) |
| SB | 72.5% (208 / 754) | 52.3% (236 / 458) |

- **Sizes and ante (source metadata):** MTT 40bb opens 2.3bb, SB 3.5bb, 1bb BB ante, 3-bet
  OOP 4×. Cash opens 2.5bb, SB 3bb, no ante. The SB never limps in the 40bb file
  (`LimpSB` empty, pinned by a test), so vs SB is always facing a raise. No jam keys exist.
- The 40bb charts are patchy (lone offsuit folds among calls), so ~90% of their grid is
  "border" and the dealer's skew there is close to uniform. Harmless; noted in the test.

---

## Review round (5 reviewers, before build)

Findings that changed the build:

- **Buckets leaked into the BTN drill:** `bucketsFor(format)` filtered by format only. Fixed
  with a `drill: 'btn' | 'bb'` field on `BucketMeta`; `bucketsFor(format, drill = 'btn')`.
  Golden deals unchanged.
- **Hero can't be BB as typed:** BB isn't a `Seat`. Added `TableSeat = Seat | 'BB'` for the
  table and ladder only.
- **SB rendered after hero / couldn't open:** `buildSeats` always drew SB as a posted blind.
  Blinds before hero are now the opener or a folded seat with a dead 0.5bb chip.
- **BTN raise chip hid under the dealer button:** the D steps aside on desktop; on phone the
  raise size outranks the D.
- **Trash tier empty for BB:** BB buckets measure trash against their own chart.
- **Stats key mixing:** two fixed `usePreflopStats` instances in App, as the file warns.
- **Two-way mode checks** in Header, Menu, PhoneMenuSheet, PhoneStatsPill, PhoneStatsSheet
  replaced; menu items come from `MODES` + `MODE_LABEL`.
- **Cut:** the `FacingSpec` layer (a `drill` field + a small view table in `FacingTrainer`
  covers it), the bucket search, the generator script (lists are checked in, and a test
  checks them against the JSON cell for cell, like `cashRanges.ts`).

---

## As built

- `research/bb-defend-pto.json` — vendored BB keys, `_source` block with commit.
- `lib/preflop/bbDefendRanges.ts` (+ test) — 13 `PlainChart`s.
- `lib/preflop/facing.ts` — `Drill`, `BbBucket` ids (`bb-mtt-CO`, `bb-cash-SB`, …),
  `raiseBb` per bucket, `bbBucketFor()`.
- `facingDeal.ts` — `drill` option; `FacingSpot.opener` widened to `Seat`.
- `PreflopTable` / ladder — hero in BB, SB as opener, folded SB's dead blind.
- `useFacingDrill` / `FacingTrainer` / `PhoneFacingTrainer` — `drill` prop.
- App: mode `bbdefend` ("BB defend"), stats `bluff-catcher:bbdefend(-cash):v1`, briefings
  `bbdefend(-cash)`, chip "BB 40bb" / "BB cash".

---

## Out of scope
- Other defend seats (SB, CO, HJ facing opens).
- Multiway (opener + caller) / squeezes.
- Facing a 3-bet, 20bb/10bb BB defend tiers (the pack has 20bb — natural follow-up).
- Hand-history (`lib/hh`) support for BB defend decisions.
