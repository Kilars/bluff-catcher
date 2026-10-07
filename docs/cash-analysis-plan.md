# Plan: cash-game (Rush & Cash) analysis alongside tournaments

## The one insight

"Expand the script for cash" sounds like a second game. It is not. `HeroHand`
and everything downstream of it already run on **big-blind-normalised** numbers
(`stackBB`, `netBB`, `grossBB`), which are currency- and format-neutral. The
only place tournament-ness is baked in is the **parser's format layer** — the
header grammar and the money format. Fix that one layer and cash falls out of
the existing pipeline almost for free.

Verified against 6 real GGPoker Rush & Cash files (`$0.25/$0.5` and `$0.01/$0.02`,
6-max), pulled from the `backup` repo commit `09ff184 "rush cash history"`.

## Decisions (from the grill)

| Question | Decision | Why |
|---|---|---|
| Modularity seam | One pipeline, one CLI. `variant:'mtt'\|'cash'` on `Hand`, detected at the header. Only the parser's format layer + the report summary branch. | `HeroHand`→judge is already variant-blind. |
| Money representation | **Integer minor units** everywhere: cents for cash, chips for tournament. Cash `$0.5→50`, `$117.77→11777`. | Keeps all existing integer math and the exact-equality `potMatches` reconciliation intact. Floats would shatter it. |
| Ranges | ~~**Reuse existing `deep` charts.**~~ **Superseded 2026-10-06:** cash reads `CASH_RFI` (chart key `'cash'`, seats `LJ/HJ/CO/BTN/SB`), with the tolerance band computed on that chart. A 7+-handed early seat reads `LJ`. | The ~2pt premise was false once `CASH_RFI` existed: the 9-max ante chart is 7–10pts wider at every seat (BTN 50.8% vs 41.8%), and flagged 21 of 25 cash folds the cash chart folds. Stack is Hero's own (effective stack is an open decision for the user). |
| Rake | **No-op.** | "Total pot" is pre-rake (= sum of bets, verified to the cent); rake comes out of `collected`, so `won`/`net`/win-rate are already correct; pot-odds run on the real middle. |
| Advice / rubric | Unchanged. | Postflop rubric is variant-neutral chipEV; no ICM in it. |
| Separation | **Both:** a `--variant cash\|mtt` runtime filter *and* an on-disk sorter script (`hands/cash/`, `hands/mtt/`). | Auto-detect coexists in one archive; filter for review, sorter for physically separate archives. |

## Cash format, verified

```
Poker Hand #RC4834985843: Hold'em No Limit ($0.25/$0.5) - 2026/09/27 16:44:53
Table 'RushAndCash12223471' 6-max Seat #1 is the button
Seat 1: Hero ($117.77 in chips)
a54a66d7: posts small blind $0.25
ba747ca4: posts big blind $0.5
...
7d7f02fa: raises $0.6 to $1.1
Uncalled bet ($0.6) returned to 7d7f02fa
7d7f02fa collected $1.25 from pot
Total pot $1.25 | Rake $0 | Jackpot $0 | Bingo $0 | Fortune $0 | Tax $0
```

Deltas vs the tournament format:
- **Header:** `#RC…` id, `Hold'em No Limit ($sb/$bb) - timestamp`. No `Tournament #`,
  no `Level`, no ante group.
- **Money:** `$`-prefixed decimals with variable places (`$2`, `$0.5`, `$0.01`, `$117.77`).
- **Table / seat / action / uncalled / collected / total-pot lines:** *same shapes*,
  just `$`-prefixed amounts.
- **Rush & Cash quirk:** every hand has a different `Table 'RushAndCashNNN'` id —
  fast-fold reseats each hand. There is no stable table/session object; the only
  grouping is the existing `--from/--to` date window.

## Work

### 1. Parser (`src/lib/hh/parse.ts`) — the bulk

- Add a `variant` detector on line 1: `Tournament #` ⇒ `mtt`, `Hold'em No Limit ($` ⇒ `cash`.
- Add a cash `HEADER` regex; keep the tournament one. Branch only here.
- Replace `num()`'s single meaning with a per-variant money parser:
  - mtt: strip commas → int (unchanged).
  - cash: strip `$` and commas → `Math.round(parseFloat * 100)` → **cents**.
- Loosen the shared line regexes (`SEAT`, `UNCALLED`, `COLLECTED`, `TOTAL_POT`,
  and the `parseActionBody` bodies) to accept an optional `$` and a decimal, so
  one grammar serves both once the amount is handed to the variant money parser.
- Cash header fills `variant:'cash'`, `level:0`, `ante:0`, `tournamentId:''`,
  `gameName:"Hold'em No Limit ($0.25/$0.5)"` (the stake string).
- Drop the `'cash games are not supported yet'` error path.

### 2. Types (`Hand`, `HeroHand`)

- Add `variant: 'mtt' | 'cash'` to `Hand`; thread onto `HeroHand`.
- Everything else on these types is already variant-neutral. No other field changes.

### 3. Downstream — unchanged, and prove it

`hero.ts`, `enrich.ts`, `labels.ts`, `priority.ts`, `rubric.ts`, `judge.ts` and
the judges: **no changes**. Add a cash hand to the existing test suites to prove
the pipeline produces sane output on real cash data (positions, roles, SPR,
labels).

### 4. `rfi.ts` — reuse charts, guard the depth note

*Superseded 2026-10-06 — see the Ranges row above.* Cash hands read the `'cash'`
chart whatever the stack (including the SB, which the cash chart has), and the
28–45bb between-charts caveat is tournament-only. `coldCalls[]`, `faced3Bets[]`
and `bigSpots[]` report `depth: 'cash'` for cash hands (`chartKeyForHand`).

- ~~No chart changes. 6-max seats already map (`LJ/HJ/CO/BTN`); blinds return null.~~
- ~~Cash stacks can exceed 100bb (saw 235bb) → `depthFor` → `deep`. Fine.~~

### 5. Report (`report.ts` / `stats.ts`) — one summary branch

- Cash has no "tournaments"/"levels". Branch the summary header on `variant` (or
  on mixed archives, show both). For cash show stakes + hand count + date window.
- Everything in the coach payload (families, briefs, verdicts) is unchanged.

### 6. CLI (`scripts/leaks.ts`)

- Add `--variant cash|mtt` to `VALUED`; filter `hands` by `hand.variant` after parse.
  No flag = both (current behaviour).

### 7. Sorter script (`scripts/split-hands.ts`)

- Read files, classify each hand block by header, write to `hands/cash/` and
  `hands/mtt/`. Reuses the same variant detector as the parser (single source).

### 8. Fixtures & data

- Add one real RC hand as a parse fixture (`fixtures/rc-…/`), including a raked
  multi-street hand, and assert `potMatches` in cents.
- Extract the RC zip into `hands/cash/` (gitignored) so a default run sees it.

## Sequencing

1. Variant detector + cash header + cents money parser + fixture (red→green on parse).
2. Thread `variant` onto types; run the existing hero/label/enrich suites against
   a cash fixture.
3. `--variant` filter; report summary branch.
4. Sorter script.
5. End-to-end `--mode coach --variant cash` on the real RC files with a live judge.

## Review findings (3 independent reviewers, against the real RC files)

Confirmed gaps the first draft missed — all present in `/tmp/rc/` data:

- **Run-it-twice.** Hand `RC4834989265` prints `*** FIRST FLOP ***` / `*** SECOND
  TURN ***` etc. and **two `collected` lines to the same winner**. Current street
  detection uses exact `*** FLOP ***`, so these never fire: board/streets come out
  wrong and `won` is doubled. Must detect and either handle or skip (with a reason),
  not silently corrupt. Add a RIT fixture. *Done (2026-10-06): parsed, not skipped.
  The first run is `board`, every run is in `Hand.runs`, and `won` sums both
  collects. Skipping hid the user's biggest all-ins from `bigSpots`.*
- **`Cash Drop to Pot : total $5`.** A promotional dead-money line (2 hands) that is
  not player-prefixed, so it is skipped and its money never enters the pot →
  `computedPot` short by the drop → `potMatches` false → hand dropped. Must add the
  drop into the pot. Add a cash-drop fixture.
- **EV Cashout** (`Chooses to EV Cashout` / `Pays Cashout Risk ($X)`) — verified
  **benign**: skipped by `parseActionBody`, reconciliation unaffected. No action,
  but note it in the fixture set.
- **`stats.ts` reference bands are 8-max MTT norms** (`BANDS`, `stats.ts:57-175`).
  This is under-scoped in §5: it is not just a summary *header* branch — the VPIP/
  PFR/3-bet/steal yardsticks themselves are the wrong game for 6-max cash, so the
  `leaks` mode would mis-grade every cash preflop stat. Needs 6-max cash bands.
  (The LLM `coach` mode does not use BANDS, so it is unaffected.)
- **Summary fields leak tournament framing for cash**: `report.ts:117` prints
  `levels 0–0 · 1 tournament(s)`; `renderJson` ships `levels`/`tournaments`;
  `stats.ts:401` computes `tournaments` = 1 from empty `tournamentId`. The §5 branch
  must cover these exact sites.
- **Mixed-archive `netChips`** (`stats.ts:403`) sums MTT chips and cash cents into one
  meaningless integer. `netBB` is unit-safe; `netChips` is not. Guard or suppress on
  mixed archives.

Resolved — the range call:

- A reviewer argued the 6-max first-to-act seat (labelled `LJ` by `positionNames(6)`)
  is over-flagged against the 23.5% chart. **Rejected:** RFI width tracks *players-
  behind*, and 6-max UTG has 5 seats behind — the same as 9-max LJ — so the LJ chart
  is the correct equivalence. The only residual is the MTT chart's *ante inflation*
  (~2–4pts wider than no-ante cash), most of which the 3% tolerance band absorbs.
  **Decision: keep the LJ mapping, reuse as planned.** No first-seat special-case.

## Risks / watch

- **Float dust:** any place that reintroduces float dollars breaks `potMatches`.
  Cents must be the boundary; nothing downstream should see dollars.
- **Very deep stacks:** 200bb+ cash stacks read the `cash` (100bb) chart. Postflop
  SPR uses the *effective* stack (Hero's, capped by the deepest opponent still in),
  so Hero covering a short villain no longer reads `deep`; a deep-vs-deep pot still
  skews `deep` more often than in MTT. Expected, not a bug.
- **Mixed-archive stats:** VPIP/PFR aggregates across cash+MTT are meaningless;
  the `--variant` filter is the intended remedy, so default mixed summaries should
  say the split rather than blend silently.
</content>
</invoke>
