# bluff-catcher — Facing-open (3-bet) trainer plan

The third drill, sitting next to the Preflop RFI drill. Someone opens, it folds to hero on the
button, and hero chooses **Fold / Call / 3-bet**. Read `PLAN-preflop.md` first. This plan
reuses its conventions and most of its code: `lib/` stays pure and tested, RNG is injectable,
and `tsc --noEmit` plus the tests stay green at every phase.

Branch: `feat/facing-open-trainer`.

---

## What we are building (settled with owner, 2026-09-27)

- **Hero seat: BTN only.** It's the most common spot for flatting or 3-betting an open, and
  one seat means nobody left behind to squeeze you except the blinds, so every chart stays
  valid.
- **Opener:** any of the 6 seats that can open into the BTN (UTG, UTG+1, UTG+2, LJ, HJ, CO).
  The felt shows the real seat.
- **Two charts to learn, not six.** Openers fall into two buckets. Hero learns one chart per
  bucket and is graded against that bucket's chart:

  | Bucket     | Openers                  | Chart it uses          |
  |------------|--------------------------|------------------------|
  | **vs Early** | UTG, UTG+1             | PokerCoaching BTN vs UTG+1 |
  | **vs Late**  | UTG+2, LJ, HJ, CO      | PokerCoaching BTN vs HJ    |

- **Pure charts, no mixing.** Every hand has exactly one right answer. The source charts are
  already pure, so we don't round anything ourselves (see "Source" below).
- **One depth for now: 50bb+.** No 20bb tier yet. The deep RFI chart is labelled 60bb+ and
  this one is labelled 50bb+, because that's the depth the source says it applies from.
- **Solver baseline**, no "vs fish" variant. The merged-vs-weak adjustments stay in
  `strategy-notes.md` §7 for now.
- **Answer loop:** same as RFI. Commit, get a verdict, wait for input. Keys: **F = Fold,
  J = Call, K = 3-bet**, the three home-row fingers in order of aggression. Buttons are
  clickable too.
- **The verdict names the kind of 3-bet:** "Correct — 3-bet (bluff)" /
  "Wrong — this is a 3-bet for value". Both kinds grade as the same action. The label is
  there because *why* a hand 3-bets is the lesson, and it's free, since the source colours
  them apart.

---

## Why 2 buckets, and why this split

A full 9-max set is about 36 opener × hero pairs × depths, roughly 100 charts. Fixing hero on
BTN cuts that to 6. Here is how far apart those 6 charts actually are: combos where the
fold / call / 3-bet answer differs (out of 1326).

|        | UTG | UTG+1 | UTG+2 | LJ | HJ | CO |
|--------|----:|------:|------:|---:|---:|---:|
| UTG    |   0 |    16 |    80 | 92 |120 |184 |
| UTG+1  |  16 |     0 |    64 | 76 |104 |168 |
| UTG+2  |  80 |    64 |     0 | 16 | 44 |132 |
| LJ     |  92 |    76 |    16 |  0 | 28 |116 |
| HJ     | 120 |   104 |    44 | 28 |  0 | 88 |
| CO     | 184 |   168 |   132 |116 | 88 |  0 |

- **Three natural clusters:** {UTG, UTG+1}, then {UTG+2, LJ, HJ}, then CO on its own.
  - The first cut is after UTG+1, not after LJ. That's where UTG+2 opens up enough to
    bring in value AQs and the suited-ace bluffs A8s–A6s.
- **Average error per opener**, i.e. combos graded differently from that seat's real chart:

  | Setup | Charts | Avg combos off | ≈ % of dealt hands |
  |---|---|---|---|
  | 6 exact charts | 6 | 0 | 0% |
  | **2 buckets (UTG1 chart / HJ chart)** | **2** | **29** | **~2.2%** |
  | 3 buckets (UTG1 / LJ / CO) | 3 | 10 | ~0.8% |
  | 1 chart (LJ) | 1 | 55 | ~4.1% |

- **Why HJ represents Late:** LJ and HJ tie on raw error (160 combos across the bucket). HJ
  sits closer to CO (88 vs 116 combos apart), and CO opens are the ones BTN faces most, so
  HJ wins.
- **Where the 2-bucket error lands:** mostly CO opens (88 combos), and it's all in the
  **bluffs**:
  - It folds 8 hands that bluff-3-bet vs CO: K8s, Q8s, J8s, 64s, 43s, QJo, KTo, A9o.
  - It 3-bets 4 hands that flat vs CO: A5s, A4s, KJo, ATo.
  - It never folds a value hand or a call. The value and calling ranges are right against
    every opener in the bucket. Missing a few bluffs is the cheap way to be wrong.
- **Upgrade path:** to go to 3 buckets later, split CO out into its own chart. It's a
  data-only change (see P0: buckets are a table, not code).

### What the two shapes teach

| | vs Early (UTG+1 chart) | vs Late (HJ chart) |
|---|---|---|
| Continue | 15.2% | 20.7% |
| 3-bet value | QQ+, AK | QQ+, AK, **AQ**, AJs |
| 3-bet bluff | A5s–A2s, AQo, AJo, KQo | A8s–A2s, 86s, 75s, 65s, 54s, ATo, KJo |
| Call | 22–JJ, AQs–ATs, KQs–KTs, QJs, QTs, JTs, J9s, T9s, 98s, 87s, 76s | 22–JJ, ATs, A9s, KQs–K9s, QJs–Q9s, JTs, J9s, T9s, T8s, 98s, 97s, 87s, 76s, AJo, KQo |

- **JJ and TT are always calls.** At 100bb the solver flats them from BTN against every opener.
- **Offsuit broadways flip from 3-bet to call** between buckets. vs Early, AQo/AJo/KQo 3-bet
  as bluffs: they block the top of a tight range and play badly as a flat. vs Late, AQo
  becomes value and AJo/KQo are good enough to flat.
- **Bluffs move down the suited aces** (A5s–A2s → A8s–A2s) and pick up small suited
  connectors vs Late.

---

## Source

**PokerCoaching free preflop chart pack**, `full-preflop-charts.pdf`, page 6,
"Facing RFI: Button". It's the same vendor as the RFI charts.

- 100bb with antes. The pack says it applies to **~50bb and deeper**. Sizes: 2.5bb open,
  3× 3-bet in position.
- Already **pure**: every cell is one colour, and value and bluff 3-bets are coloured apart.
  The pack does the rounding, which is what the owner asked for (no hand-rolled
  simplification).
- All 6 BTN charts were extracted into `research/pokercoaching-btn-vs-rfi.json` by sampling
  cell colours. **Every chart's value / bluff / call / fold combo totals match the counts
  printed under it**, e.g. BTN vs UTG = 34 / 48 / 108 / 1136.
- Other options looked at:
  - **PTO / Simple Ranges.** Converts solver mixes to pure strategies while keeping the
    overall frequencies. It's the fallback if we ever need a spot the pack doesn't cover
    (e.g. 20bb).
  - **Raw GTO Wizard output.** Heavily mixed, so it would need our own rounding. Rejected.

---

## Phases

### Phase F0 — Charts + core lib  *(Opus)*

**Goal:** pure, tested `lib/preflop/facing.ts`.

- `FACING_ACTIONS = ['fold', 'call', '3bet']`, plus a `ThreeBetKind = 'value' | 'bluff'`
  carried on 3-bet cells for the verdict text.
- `OPENERS = ['UTG','UTG1','UTG2','LJ','HJ','CO']` reuses `Position` from `ranges.ts`.
- `BUCKET_OF: Record<Opener, 'early' | 'late'>`. A table, so a 3rd bucket is a data change.
- Two explicit charts (`EARLY`, `LATE`) as hand-class sets per action, transcribed from the
  JSON (UTG+1 and HJ). `facingAction(opener, handClass)` returns the action and, for a
  3-bet, its kind.
- Keep all 6 source charts in the test fixture (from the JSON), not in the app, so tests can
  report the bucket error.

**Acceptance:** `facing.test.ts` pins each bucket's value / bluff / call combo counts
(34/52/116 and 54/68/152). Spot-checks: vs Early AQo = 3-bet, JJ = call, A9s = fold; vs Late
AQo = 3-bet value, A8s = 3-bet bluff, KQo = call. The bucket-error test asserts the table
above (avg 29.3 combos), so a chart edit that drifts gets caught.

### Phase F1 — Dealer  *(Opus)*

- `dealFacingSpot({ rng, pool })` picks an opener, then samples a hand through the existing
  `Pool` interface.
  - **Opener weights:** uniform over the 6 to start. Seats in a bucket share a chart, so no
    need to model real open frequencies yet.
  - **Pool:** reuse `edgeSkewPool`'s idea. Upweight hands on a **border between two actions**
    (fold↔call, call↔3-bet) and downweight trash well outside the continuing range. Here the
    border is "next to a cell with a different action" in the 13×13 grid, which is simpler
    and more honest than a strength rank, because the call/3-bet boundary isn't linear
    (AJo 3-bets, AJs calls).
- Returns `{ opener, bucket, cards, handClass, correct: FacingAction, kind? }`.

**Acceptance:** seeded tests. `correct` always matches `facingAction`. Border hands show up
about 4× as often as a mid hand, trash about 0.25×, and every class appears at least once.

### Phase F2 — Mode + table  *(Haiku, Opus-reviewed)*

- New mode `'facing'` in the menu ("Facing open"). Same persisted-mode key, so no migration.
- `modes/FacingTrainer.tsx` + `hooks/useFacingDrill.ts`, modelled on `usePreflopDrill`.
- Table: reuse `PreflopTable` / `PhoneSeatLadder`, with the opener's seat showing a **2.5bb
  raise**, the seats between them and hero folded, blinds posted, and hero on BTN.
  - The bucket is on the plaque ("vs Early", "vs Late") so hero can link seat to chart.
- Three buttons + F / J / K. Phone: three buttons in the thumb zone.

**Acceptance:** legal spot every deal. All three keys and buttons commit. The RFI and odds
modes are unchanged.

### Phase F3 — Verdict, stats, range view  *(Haiku)*

- Verdict with the 3-bet kind: "Correct — call" / "Wrong — this is a 3-bet (bluff)".
- Own stats key `bluff-catcher:facing:v1`: hands, streak, accuracy. Same shape as
  `usePreflopStats`, so reuse the hook with a key parameter rather than forking it.
- `RangeGrid` gains a **4-colour mode**: value / bluff / call / fold, matching the source's
  red / blue / green / white, with hero's cell marked. The sheet shows the **bucket's** chart,
  titled "BTN vs Early (UTG, UTG+1)".

**Acceptance:** the grid colouring matches `facingAction` for all 169 cells. Stats persist
and reset. Phone and desktop both work.

### Phase F4 — Polish + verify  *(Opus)*

- A first-visit briefing (reuse `briefed.ts`): the two buckets, which seats go where, and the
  three rules from "What the two shapes teach".
- `/verify` the whole loop at desktop and 390×844.

---

## Deliberately out of scope

- **Other hero seats.** CO, HJ, SB and BB each need their own chart, BB especially (it
  defends ~40%+).
- **20bb tier.** Here a 3-bet means a jam and calling mostly disappears. Next candidate after
  this ships. It will need a source that covers 20bb (PTO or a 25bb pack).
- **Exploit variants** (merged 3-bets vs weak openers).
- **Facing a 3-bet after hero opens.** The same PDF has these charts (pp. 9–14). It's a
  natural fourth drill.
