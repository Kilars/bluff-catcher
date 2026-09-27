# bluff-catcher — Facing-open (3-bet) trainer plan

The third drill, sitting next to the Preflop RFI drill. Someone opens, it folds to hero on the
button, and hero chooses **Fold / Call / 3-bet**. Read `PLAN-preflop.md` first. This plan
reuses its conventions: `lib/` stays pure and tested, RNG is injectable, and `tsc --noEmit`
plus the tests stay green at every phase.

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

  | Bucket       | Openers              | Chart it uses              |
  |--------------|----------------------|----------------------------|
  | **vs Early** | UTG, UTG+1           | PokerCoaching BTN vs UTG+1 |
  | **vs Late**  | UTG+2, LJ, HJ, CO    | PokerCoaching BTN vs LJ    |

- **Pure charts, no mixing.** Every hand has exactly one right answer. The source charts are
  already pure, so we don't round anything ourselves (see "Source" below).
- **One depth for now, labelled 50bb+.** No 20bb tier yet. See "Depth caveat": the chart is
  solved at 100bb, and the bottom of that span is where it's least accurate.
- **Solver baseline**, no "vs fish" variant. The merged-vs-weak adjustments stay in
  `strategy-notes.md` §7 for now.
- **Answer loop:** same as RFI. Commit, get a verdict, wait for input.
  - Keys: **F = Fold, J = Call, K = 3-bet**, the three home-row fingers in order of
    aggression. Buttons are clickable too.
  - Heads-up: J means "open" in the RFI drill and "call" here. The modes never share a screen,
    so nothing conflicts, but the briefing should say it once.
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
  - That cut is optimal: none of the other 4 contiguous 2-way splits comes out better.
- **Average error per opener**, i.e. combos graded differently from that seat's real chart.
  Two weightings:
  - *Uniform*: each opener counts the same.
  - *Real*: how often each seat is the one that opens into the BTN. An earlier seat gets
    first shot, so UTG opens most often (~20%) and CO least often (~13.5%). The estimate
    uses each seat's RFI width from `ranges.ts` (deep), times the chance that every earlier
    seat folded.

  | Setup | Charts | Uniform | Real | ≈ % of dealt hands |
  |---|---|---|---|---|
  | 6 exact charts | 6 | 0 | 0 | 0% |
  | **2 buckets (UTG+1 chart / LJ chart)** | **2** | **29** | **26** | **~2%** |
  | 2 buckets (UTG+1 chart / HJ chart) | 2 | 29 | 27 | ~2% |
  | 3 buckets (UTG+1 / LJ / CO) | 3 | 10 | 10 | ~0.8% |
  | 1 chart (LJ) | 1 | 55 | — | ~4% |

- **Why LJ represents Late:** LJ and HJ tie on uniform error, and LJ wins once seats are
  weighted by how often they actually open. It's also the middle of its bucket.
- **Where the 2-bucket error lands.** It isn't only bluffs. Against the later openers the
  Late chart plays **tight**; against UTG+2 it is slightly loose on bluffs:

  | Real opener | Combos off | What differs |
  |---|---:|---|
  | UTG | 16 | A3s, A2s bluff (real: fold); J9s call (real: fold); 76s call (real: bluff) |
  | UTG+2 | 16 | A8s–A6s bluff (real: fold); A9s call (real: bluff) |
  | HJ | 28 | Folds K9s, Q9s, T8s, 97s (real: call) and 86s, 75s (real: bluff); flats AJs (real: value 3-bet) |
  | CO | 116 | As vs HJ, plus folds K8s, Q8s, J8s, 64s, 43s, QJo, KTo, A9o (real: bluff), and 3-bets A5s, A4s, KJo, ATo (real: call) |

  - The biggest single error is vs CO. It's mostly missing marginal suited calls and bluffs,
    which is the cheap direction. The 4 hands it 3-bets that CO flats cost more.
  - **Upgrade path:** giving CO its own chart cuts the error from 26 to 10 combos. It's a
    data-only change (see F0: buckets are a table, not code).

### What the two shapes teach

| | vs Early (UTG+1 chart) | vs Late (LJ chart) |
|---|---|---|
| Continue | 15.2% | 18.9% |
| 3-bet value | QQ+, AK | QQ+, AK, **AQ** |
| 3-bet bluff | A5s–A2s, AQo, AJo, KQo | A8s–A2s, 65s, 54s, ATo, KJo |
| Call | 22–JJ, AQs–ATs, KQs–KTs, QJs, QTs, JTs, J9s, T9s, 98s, 87s, 76s | 22–JJ, AJs–A9s, KQs–KTs, QJs, QTs, JTs, J9s, T9s, 98s, 87s, 76s, AJo, KQo |

- **JJ and TT are calls against every opener**, in all 6 source charts, at 100bb.
- **Offsuit broadways flip from 3-bet to call** between buckets. vs Early, AQo/AJo/KQo 3-bet
  as bluffs: they block the top of a tight range and play badly as a flat. vs Late, AQo
  becomes value and AJo/KQo are good enough to flat.
- **Bluffs move down the suited aces** (A5s–A2s → A8s–A2s) and pick up small suited
  connectors vs Late.

---

## Depth caveat

- The pack is solved at **100bb with antes** and says it applies to **~50bb and deeper**.
  We label it 50bb+.
- It's accurate at the top of that span and loose at the bottom. Your own notes
  (`strategy-notes.md` §7, "What changes 100bb → 50bb") say that as stacks drop towards
  50bb:
  - JJ/TT move towards 3-bet.
  - A5s–A2s move towards 3-bet.
  - 54s/43s-type flats drop out.
  The chart shows none of that. The briefing and the range sheet say so in one line.
- This is the opposite extrapolation to the RFI trainer. Its 60bb+ chart is solved at 40bb
  and stretched *upwards*, where RFI barely changes. Here we stretch *downwards*, where
  3-bet/flat decisions do move.
- It's also a different pack from the RFI charts: 100bb with a 2.5bb open, vs the 40bb pack
  with ~2.2–2.5bb opens. The villain ranges this chart assumes are therefore not exactly the
  ranges the RFI drill teaches for the same seat. It's close enough for a trainer. Don't
  cross-check the two drills combo for combo.
- If the 20bb tier ever ships, it replaces the bottom of this span rather than sitting under
  it.

---

## Source

**PokerCoaching free preflop chart pack**, `full-preflop-charts.pdf`, page 6,
"Facing RFI: Button". It's the same vendor as the RFI charts.

- 100bb with antes, applies ~50bb+. Sizes: 2.5bb open, 3× 3-bet in position.
- Already **pure**: every cell is one colour, and value and bluff 3-bets are coloured apart.
  The pack does the rounding, which is what the owner asked for (no hand-rolled
  simplification).
- All 6 BTN charts are extracted into `research/pokercoaching-btn-vs-rfi.json` by sampling
  cell colours.
  - **Every chart's value / bluff / call / fold combo totals match the counts printed under
    it**, e.g. BTN vs UTG = 34 / 48 / 108 / 1136.
  - A second, independent extraction found zero differences in all 6 × 169 cells.
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
- `OPENERS = ['UTG','UTG1','UTG2','LJ','HJ','CO']` as a subset of `Position` from
  `ranges.ts`.
- `BUCKET_OF: Record<Opener, 'early' | 'late'>`. A table, so a 3rd bucket is a data change.
- Two explicit charts (`EARLY`, `LATE`) as hand-class sets per action, transcribed from the
  JSON (UTG+1 and LJ). `facingAction(opener, handClass)` returns the action and, for a 3-bet,
  its kind.
- Keep all 6 source charts in a test fixture (from the JSON), not in the app, so tests can
  report the bucket error.

**Acceptance:** `facing.test.ts`:
- Pins each bucket's value / bluff / call combo counts: 34 / 52 / 116 and 50 / 60 / 140.
- Spot-checks:
  - vs Early: AQo = 3-bet bluff, JJ = call, A9s = fold.
  - vs Late: AQo = 3-bet value, A8s = 3-bet bluff, KQo = call, AJs = call.
- Bucket-error test: asserts the uniform average (29.3 combos) and the per-opener rows of
  the error table above, so a chart edit that drifts gets caught.

### Phase F1 — Dealer  *(Opus)*

- `dealFacingSpot({ rng, pool })` → `{ opener, bucket, cards, handClass, correct, kind? }`.
- **Opener pick:** first a bucket at **50/50**, then an opener uniformly within it. Both
  charts get equal practice. A uniform pick over 6 seats would give Late 4/6 of the deals.
- **Hand pool:** a new `FacingPool` with its own signature. The RFI `Pool` takes
  `(pos, hc, depth)`, and `edgeSkewPool`'s boundary comes from `getRangeSet`, so neither fits
  as-is.
  - **Neighbours of a class** (defined exactly, so the weights are testable):
    - the 4 orthogonal cells in the 13×13 grid, **plus**
    - its **suitedness twin**: same two ranks, other half of the grid (AJs ↔ AJo). Pairs
      have no twin.

    The twin rule matters: AJs and AJo sit in mirrored cells and never touch in the grid,
    yet "AJo 3-bets, AJs calls" is exactly the kind of boundary the drill is for.
  - **Border** = at least one neighbour has a different action in that bucket's chart.
    Weight **4×**.
  - **Trash** = folds in *all 6* source charts, and no neighbour continues in any of them.
    Weight **0.25×**.
  - **Mid** = everything else. Weight **1×**.
  - No weight is ever 0, so every class stays reachable.

**Acceptance:** seeded tests:
- `correct` always matches `facingAction`.
- Over N deals, per-class frequency divided by its combo count lands within ±15% of
  4× / 1× / 0.25× relative to mid.
- Every one of the 169 classes appears at least once.
- The early/late split is 50% ± 2%.

### Phase F2 — Mode + table  *(Opus: shell, Haiku: table)*

Adding a third mode is real work, because the app treats mode as two-way today.

- **Mode type and saved setting:**
  - `AppMode` becomes `'odds' | 'preflop' | 'facing'`.
  - `loadMode()` in `useAppPrefs.ts` accepts `'facing'`. Today it only accepts `odds` and
    `preflop`, so a saved `facing` would reset to `odds`.
  - No key change or migration: old values stay valid.
- **Replace every two-way mode check** with a switch or a per-mode lookup. They're in
  `App.tsx` (the stats, label and reset lines around 163–283), `Header.tsx`,
  `PhoneStatsPill.tsx` and `PhoneStatsSheet.tsx`. As written, each of them would treat
  `facing` as `preflop`. Add a test that renders each mode's header and stats pill.
- Menu entries in `Menu.tsx` and `PhoneMenuSheet.tsx`: "Facing open".
- `modes/FacingTrainer.tsx` + `hooks/useFacingDrill.ts`, modelled on `usePreflopDrill`, with
  three actions.
- **Table: new raise state.** `PreflopTable`'s `buildSeats()` and the phone ladder's
  `SlotState` only know folded / to act / blinds.
  - Add an `opener` seat state with a **2.5bb raise chip**, reusing the blind-chip styling.
  - Seats between the opener and hero render folded, and hero sits on BTN.
  - The bucket is on the plaque ("vs Early", "vs Late") so hero can link seat to chart.
- Three buttons + F / J / K. Phone: a three-button `PhoneDecisionPanel` variant in the
  thumb zone.

**Acceptance:**
- Legal spot on every deal, with the opener's raise chip visible on desktop and phone.
- All three keys and buttons commit.
- Reload restores `facing` mode.
- Header and stats show the facing stats in facing mode, and odds/RFI are unchanged in
  theirs. The existing mode tests still pass.

### Phase F3 — Verdict, stats, range view  *(Haiku)*

- Verdict with the 3-bet kind: "Correct — call" / "Wrong — this is a 3-bet (bluff)".
- **Stats:** `usePreflopStats` hard-codes its storage key (`usePreflopStats.ts:19`).
  - Make the key a parameter that defaults to the current value, so RFI stats are untouched.
  - Facing uses `bluff-catcher:facing:v1`: hands, streak, accuracy.
- **`RangeGrid` 4-colour mode.** Today it computes one boolean (`isOpen`) and has open/fold
  classes only.
  - Add a `cellAction(hc)` prop, value / bluff / call / fold CSS classes from tokens
    (matching the source's red / blue / green / white), and a legend.
  - The RFI usage keeps the 2-colour path.
- **Range sheet** shows the **bucket's** chart, titled e.g. "BTN vs Late (UTG+2, LJ, HJ,
  CO)", with hero's cell marked. It also has a one-line footnote on the error:
  - vs Late: "vs HJ/CO the exact chart is a bit wider: more suited calls and bluffs."
  - vs Early: "UTG is a touch tighter than this."

  This way a player 3-betting K8s vs a real CO open knows why they were graded wrong.

**Acceptance:**
- Grid colouring matches `facingAction` for all 169 cells in both buckets.
- The RFI grid renders exactly as before.
- Facing stats persist and reset without touching RFI stats.
- Phone and desktop both work.

### Phase F4 — Briefing, polish, verify  *(Opus)*

- **Briefing:** `briefed.ts` is keyed by `Depth`. Reusing `'deep'` would mean a player
  already briefed on RFI never sees this one.
  - Widen the key to a string id, e.g. `'facing'`, keeping the existing depth ids valid.
  - Content: the two buckets and which seats go where, the three rules from "What the two
    shapes teach", the depth caveat, and J = call.
- `/polish` pass, then `/verify` the whole loop at desktop and 390×844.

**Acceptance:**
- First visit to facing mode opens the briefing once, and RFI briefings are unaffected.
- The loop (deal → commit → verdict → range sheet → next) is usable one-thumbed at 390×844
  with no clipping.
- Odds and RFI modes are unchanged.
- `tsc`, lint and tests are green.

---

## Deliberately out of scope

- **Other hero seats.** CO, HJ, SB and BB each need their own chart, BB especially (it
  defends ~40%+).
- **20bb tier.** Here a 3-bet means a jam and calling mostly disappears. Next candidate after
  this ships. It will need a source that covers 20bb (PTO or a 25bb pack).
- **Exploit variants** (merged 3-bets vs weak openers).
- **Facing a 3-bet after hero opens.** The same PDF has these charts (pp. 9–14). It's a
  natural fourth drill.

---

## Implementation notes (F2–F4, as built)

- **Advance keys** match RFI exactly: after a commit only Space / Enter advance and R opens
  the range; other keys do nothing. I opens the briefing at any time, Escape closes a sheet.
- **Briefing** opens once per browser on *both* layouts (`needsBriefing('facing')`), unlike RFI
  desktop, which still briefs on every mount. `PreflopInfoSheet` takes a `content` prop (plus an
  optional `keysNote` under the key card, used for "J means call here"); RFI copy is unchanged.
- **Range sheet** uses the existing `RangeSheet` / `PhoneRangeView` with a `pages` prop: every
  bucket chart of the drill (BB defend: every opener), stepped with the same arrows, tabs,
  ←/→ keys and swipe as the RFI seats, opening on hero's chart (the only one with the hand
  marked). No depth strip, RFI boundary sentence or combo summary.
- **Table**: `PreflopTable` gained optional `openerTag` (the bucket, as a third line on the
  opener's plaque), `stackLabel`, `centreTitle` and `centreLine`; `PhoneSeatLadder` gained
  `contextLine`. All default to the RFI rendering.
- **Phone top bar**: the facing chip reads "vs open" (`FACING_CHIP_LABEL`) rather than
  "vs open · 50bb+", which pushed the stats pill off a 390px bar. 50bb+ moved to the ladder line.
- The verdict is followed by one detail line, e.g. "A8s vs HJ: 3-bet (bluff) on the vs Late chart".
