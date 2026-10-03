# bluff-catcher — BTN vs 3-bet (4-bet) trainer plan

> **Superseded data layout (2026-10-03):** the hand-copied `*Ranges.ts` files and the
> `research/*-pto.json` excerpts are gone. Charts are read through `range(spot)` from a
> generated dataset; see `docs/PLAN-range-generator.md`.

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
- **Pure charts.** One right answer per hand.
- **Value / bluff split in cash** (owner request, 2026-10-02), coloured like the 3-bet charts:
  the bluff cell is half blue. The source has no label, but it does say what hero does facing
  a 5-bet jam (`Call 5BetBTNvs<seat>`): 4-bets that call the jam are **value** (AA–TT, AK, AQs),
  4-bets that fold to it are **bluffs** (A5s, AQo, AJo, KQo). At 40bb the 4-bet is all-in, so
  there is no 5-bet to fold to and those charts stay plain (a `4` corner mark).
- **Only reachable hands are dealt.** Hero only reaches this spot with a hand they opened, so
  the dealer samples from the source's BTN open range for the format. Hands outside it are
  never dealt (the range sheet still shows them as fold).

---

## Source

`jensbaagaard/poker-practice`, `data/openSourcePokerData/`, commit `449993f`. This is the
same repo, commit and caveats as `research/cash-100-pto.json` and `research/bb-defend-pto.json`.

- Keys: `4BetBTNvs<SB|BB>` (raise) and `Call 3BetBTNvs<SB|BB>` (call), 169 hands, 0/1 only.
  Fold = neither. `OpenBTN` from the same file is the reachable range.
- Vendored in `research/btn-4bet-pto.json` (these five keys per format, plus
  `Call 5BetBTNvs<SB|BB>` for cash, with a `_source` block). Charts live as TS sets in `lib/preflop/btn4BetRanges.ts`. A test re-reads the JSON
  and checks them cell for cell, and checks that every continue hand is inside `OpenBTN`.
- **Sizing (source README, sizing profiles):**

| | Open | 3-bet (OOP) | 4-bet (IP) | Stack / ante |
|---|---|---|---|---|
| Cash 100bb | 2.5bb | 5× = 12.5bb | 2× = 25bb | 100bb, no ante |
| MTT 40bb | 2.3bb | 4× = 9.2bb (cap 10) | **all-in** | 40bb, 1bb BB ante |

- **Combo counts** (of the open range; fold = the rest of it):

| Chart | Open | 4-bet | Call | Fold |
|---|---|---|---|---|
| Cash vs SB | 554 | 90 (value 50 / bluff 40) | 68 | 396 |
| Cash vs BB | 554 | 90 (value 50 / bluff 40) | 68 | 396 |
| 40bb vs SB | 664 | 90 | 194 | 380 |
| 40bb vs BB | 664 | 70 | 274 | 320 |

- Cash vs SB and vs BB are **identical** in the source. Each still gets its own page (the felt
  shows the real 3-bettor), and the footnote says so.
- 40bb: the 4-bet is a jam, so the solver **flats AA/KK** (and QQ/AKs vs BB) and jams
  JJ/TT, AQ, KQo, AK and a few pairs (88, 33). The mixed solve (`MTT_40_GTO`) confirms it, so this is not a rounding error.
  The briefing calls it out.

---

## Design

- `facing.ts`: `Drill` gains `'btn4'`. `FacingAction` gains `'4bet'`. A third chart shape,
  `FourBetChart { fourBet: {value, bluff} | Set, call }`, so the 4-bet answer is typed as itself rather than
  re-using `'3bet'`. `chartAction` / `facingComboCounts` handle it. Four buckets
  `btn4-<format>-<SB|BB>` built from one table, like `BB_SPOTS`. `BucketMeta.heroOpenBb` is
  hero's own open, and `raise` names the K-key action.
- **Seat types:** the 3-bettor can be the BB, which is not a `Seat`. `TableSeat = Seat | 'BB'`
  moves from `PreflopTable` into `ranges.ts` (re-exported). `FacingSpot.opener` and
  `BucketMeta.openers/chartSeat` widen to it. `positionLabel` accepts it. In this drill,
  "opener" means *the raiser hero faces*, which is documented on the type.
- `facingDeal.ts`: a bucket can carry a reachable set (`BUCKET_REACHABLE`). The sampler draws only from it.
  The trash tier is measured against the bucket's own chart, as in BB defend.
- `grid.ts`: `CellAction` gains `'fourBetValue'`, `'fourBetBluff'` and `'fourBet'`, coloured like
  their 3-bet twins (value red, half-blue bluff, plain red with a `4` mark) in both grids.
- **Table:** `buildSeats` takes `heroOpened`, the ladder and `PreflopTable` take `heroOpenBb`. When hero has opened, the raiser is a
  seat *after* hero, and the other blind is folded with its dead blind chip (`posted` widens to
  `'sb' | 'bb'`). Hero's raise chip sits beside hero's cards, and the D steps aside as it does
  when the BTN opens in the facing drill.
- `useFacingDrill`: K commits the bucket's `raise`, and verdict copy says "4-bet".
  `FacingTrainer` / `PhoneFacingTrainer` read button labels and the prompt from the drill view.
- App: mode `btn4bet`, stats `bluff-catcher:btn4bet(-cash):v1`, briefings `btn4bet(-cash)`,
  chip "vs 3b" / "3b cash", context "BTN vs 3-bet · 40bb" / "· Cash 100bb".

---

## Review round (3 reviewers, after build)

Logic and types, UI on desktop and phone (rendered at 1280×860 and 390×844), and data fidelity
against upstream. No bugs. Data, sizes and the cash split were verified against `449993f`
(the blinds 3-bet with the OOP multiplier; upstream's 3-bet-pot solves confirm 12.5bb). Fixed:

- 40bb briefing said the jams "hate playing out of position", but hero is in position. The jam
  list also left out AK, JJ and TT. Both rewritten from the charts.
- Phone prompt didn't say the 40bb 4-bet is all-in. It now shows the 4-bet size, as desktop does.
- The 3-bettor's plaque said "raises". It now says "3-bets to …".
- Stale tier docstring in `facingDeal.ts`. Added a test that pins the btn4 tiers.

Left as is: `ThreeBetKind` also types 4-bet kinds, and a folded blind on the phone ladder
keeps its blind tint. That matches BB defend.

---

## Follow-up: Open vs 3-bet (cash only)

A second mode on the same machinery (owner request, 2026-10-03), `open4bet` / drill `open4`:
hero opens 2.5bb from **LJ, HJ or CO**, any seat behind 3-bets, the rest fold, and hero
folds, calls or 4-bets, with the same value/bluff split (`Call 5Bet<opener>vs<seat>`).

- `Cash_100_PTO` answers a 3-bet the same way whoever made it, so there is **one chart per
  opener** (`open4BetRanges.ts`, vendored in `research/open-4bet-pto.json`; the test checks it
  against every 3-bettor). Value / bluff / call combos: LJ 34/18/40 of 220 opened, HJ 40/12/46
  of 282, CO 40/24/46 of 354.
- Sizes come from the 3-bettor (`BucketMeta.sizesBy`, read through `spotSizes`): a seat in
  position 3-bets to 7.5bb and hero's out-of-position 4-bet is 19bb. A blind 3-bets to 12.5bb
  and hero 4-bets to 25bb.
- `BucketMeta.hero` replaces the per-drill `DRILL_HERO`, since this drill's hero seat varies.
- **Cash only.** At 40bb every (opener, 3-bettor) pair has its own noisy chart (35 of them),
  the 4-bet is all-in, and there is no split. The mode plays cash whatever the format switch
  says. It has one stats key, `bluff-catcher:open4bet:v1`.

---

## Out of scope

- Opener vs 3-bet at 40bb (see the follow-up above for why it is cash only).
- Facing a 4-bet (5-bet / call) after hero 3-bets.
- Cold 4-bets and squeezes.
- `lib/hh` support for BTN-vs-3-bet decisions (`faced3Bets[]` already lists the real hands).
