# bluff-catcher — BTN vs 3-bet (4-bet) trainer plan

A fifth drill. Hero **opens the button**, a blind **3-bets**, the other blind folds, and hero
chooses **Fold / Call / 4-bet**. Read `PLAN-3bet.md` and `PLAN-bb-defend.md` first: this plan
reuses their conventions (`lib/` pure and tested, injectable RNG, typecheck and tests green,
values from tokens) and nearly all of their code. It is the third `Drill` of the facing
machinery, not a new trainer.

Branch: `btn-4bet`.

---

## What we are building

- **New mode `btn4bet`, menu label "BTN vs 3-bet".** Its own stats, briefing and range sheet.
  The two existing facing drills are untouched.
- **Hero seat: BTN, already opened.** The 3-bettor is **SB or BB** (picked 50/50); the other
  blind folded and its posted blind stays in the pot.
- **Both formats**, following the existing format switch. No depth picker, as in the other
  facing drills.
- **Same answer loop and keys:** F = Fold, J = Call, K = 4-bet, Space / Enter next,
  R range sheet, I briefing, Escape closes.
- **Pure charts.** One right answer per hand. The source does not split 4-bets into value and
  bluff, so the chart has a single 4-bet colour.
- **Only reachable hands are dealt.** Hero only reaches this spot with a hand they opened, so
  the dealer samples from the source's BTN open range for the format. Hands outside it are
  never dealt (the range sheet still shows them as fold).

---

## Source

`jensbaagaard/poker-practice`, `data/openSourcePokerData/`, commit `449993f`. This is the
same repo, commit and caveats as `research/cash-100-pto.json` and `research/bb-defend-pto.json`.

- Keys: `4BetBTNvs<SB|BB>` (raise) and `Call 3BetBTNvs<SB|BB>` (call), 169 hands, 0/1 only.
  Fold = neither. `OpenBTN` from the same file is the reachable range.
- Vendored in `research/btn-4bet-pto.json` (these five keys per format, with a `_source`
  block). Charts live as TS sets in `lib/preflop/btn4BetRanges.ts`. A test re-reads the JSON
  and checks them cell for cell, and checks that every continue hand is inside `OpenBTN`.
- **Sizing (source README, sizing profiles):**

| | Open | 3-bet (OOP) | 4-bet (IP) | Stack / ante |
|---|---|---|---|---|
| Cash 100bb | 2.5bb | 5× = 12.5bb | 2× = 25bb | 100bb, no ante |
| MTT 40bb | 2.3bb | 4× = 9.2bb (cap 10) | **all-in** | 40bb, 1bb BB ante |

- **Combo counts** (of the open range; fold = the rest of it):

| Chart | Open | 4-bet | Call | Fold |
|---|---|---|---|---|
| Cash vs SB | 554 | 90 | 68 | 396 |
| Cash vs BB | 554 | 90 | 68 | 396 |
| 40bb vs SB | 664 | 90 | 194 | 380 |
| 40bb vs BB | 664 | 70 | 274 | 320 |

- Cash vs SB and vs BB are **identical** in the source. Each still gets its own page (the felt
  shows the real 3-bettor), and the footnote says so.
- 40bb: the 4-bet is a jam, so the solver **flats AA/KK** (and QQ vs BB) and jams small
  pairs and AQ/KQ. The mixed solve (`MTT_40_GTO`) confirms it, so this is not a rounding error.
  The briefing calls it out.

---

## Design

- `facing.ts`: `Drill` gains `'btn4'`. `FacingAction` gains `'4bet'`. A third chart shape,
  `FourBetChart { fourBet, call }`, so the 4-bet answer is typed as itself rather than
  re-using `'3bet'`. `chartAction` / `facingComboCounts` handle it. Four buckets
  `btn4-<format>-<SB|BB>` built from one table, like `BB_SPOTS`. `BucketMeta.heroOpenBb` is
  hero's own open, and `raiseAction` names the K-key action.
- **Seat types:** the 3-bettor can be the BB, which is not a `Seat`. `TableSeat = Seat | 'BB'`
  moves from `PreflopTable` into `ranges.ts` (re-exported). `FacingSpot.opener` and
  `BucketMeta.openers/chartSeat` widen to it. `positionLabel` accepts it. In this drill,
  "opener" means *the raiser hero faces*, which is documented on the type.
- `facingDeal.ts`: a bucket can carry a `reachable` set. The sampler draws only from it.
  The trash tier is measured against the bucket's own chart, as in BB defend.
- `grid.ts`: `CellAction` gains `'fourBet'` (label "4-bet", legend "4-bet (4)"), coloured like
  the plain 3-bet in both grids.
- **Table:** `buildSeats` / ladder take `heroRaiseBb`. When hero has opened, the raiser is a
  seat *after* hero, and the other blind is folded with its dead blind chip (`posted` widens to
  `'sb' | 'bb'`). Hero's raise chip sits beside hero's cards, and the D steps aside as it does
  when the BTN opens in the facing drill.
- `useFacingDrill`: K commits the bucket's `raiseAction`, and verdict copy says "4-bet".
  `FacingTrainer` / `PhoneFacingTrainer` read button labels and the prompt from the drill view.
- App: mode `btn4bet`, stats `bluff-catcher:btn4bet(-cash):v1`, briefings `btn4bet(-cash)`,
  chip "vs 3-bet" / "3B cash", context "BTN vs 3-bet · 40bb" / "· Cash 100bb".

---

## Out of scope

- Facing a 3-bet from other seats (CO/HJ/LJ opens). The source has these keys (`4Bet<seat>vs…`
  only for vs BTN, not vs blinds), so a follow-up has the data for only part of it.
- Facing a 4-bet (5-bet / call) after hero 3-bets.
- Cold 4-bets and squeezes.
- `lib/hh` support for BTN-vs-3-bet decisions (`faced3Bets[]` already lists the real hands).
