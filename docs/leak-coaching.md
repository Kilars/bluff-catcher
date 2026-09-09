# Leak coaching reference

Grounding for an agent that turns `npm run leaks -- <hh> --json` into coaching.
Written to be read by a model, not a person: every threshold is a value, every
trigger is a condition over fields that exist in the JSON report, and every
finding names the evidence it must cite.

Field names below are exact. `stats[].key` values match `BANDS` in
`src/lib/hh/stats.ts`; `byRole[].role` values match `PreflopRole` in
`src/lib/hh/hero.ts`. If a name here does not resolve in the report, the report
changed and this file is stale — say so rather than guessing.

---

## 0. Input contract

```
meta        {game, date, hands, levels}
chipFlow    {netChips, netBB, showdownBB, nonShowdownBB, investedBB}
stats[]     {key, label, made, opportunities, pct, band, verdict, flag}
byRole[]    {role, hands, netBB}
worstPots[] {id, position, cards, board, stackBB, role, pfa, streetReached,
             showdown, netBB, decisions[]}
biggestCalls[] {id, street, costBB, equityNeeded, cards, board}
```

`decisions[]` = `{street, action, chips, potBefore, toCall, equityNeeded}`.
`equityNeeded` is a percentage and is `null` when the action was not a call.

`verdict` ∈ `low | ok | high | thin | none`. `flag` ∈ `bleed | missed | null`.

- **bleed** — chips leaving that should not. Nearly always calling.
- **missed** — chips not coming in that should. Nearly always declining to raise.

---

## 1. Hard rules

1. **Never coach a stat whose `verdict` is `thin`.** The sample is below its
   minimum. Reporting it as a leak is a factual error, not a judgement call.
2. **Never coach opening ranges.** Roles `open` and `iso-raise` are drilled in
   the app's preflop trainer. Report their net if asked; never flag frequency.
3. **Never assert an equity number you did not compute.** `equityNeeded` is
   given. Hand-vs-range equity is not in the report — say "needs 48%, which
   requires beating their range nearly half the time", not "you had 34%".
4. **Never infer a villain's holding from the report alone.** `board` and
   `cards` are Hero's view. Shown cards are not in the JSON.
5. **Never treat a won pot as correct play.** Judge `equityNeeded` against the
   decision, not `netBB` against the result. See `MINDSET-RESULTS`.
6. **On a sample under 200 hands, lead with `byRole` and `biggestCalls`,** not
   with percentages. Only `vpip`, `pfr` and `threeBet` settle early; postflop
   stats need thousands.
7. **Report at most 3 findings.** Ranked by rule 2 below. More is noise.

---

## 2. Ranking

Rank candidate findings by, in order:

1. Money. `byRole[].netBB` most negative, and `biggestCalls[].costBB` largest.
2. `flag` present and `verdict` ∈ {`low`, `high`} — a real band violation.
3. Confirmation across two signals (a flagged stat *and* a losing role).

A stat flagged with no money behind it ranks below a losing role with no
flagged stat. The money is the evidence; the stat is the explanation.

---

## 3. Stat bands

| key | band | `high` means | `low` means | minN |
|---|---|---|---|---|
| `vpip` | 20–28 | bleed | missed | 30 |
| `pfr` | 16–23 | — | missed | 30 |
| `gap` | 0–7 | bleed | — | 30 |
| `limp` | 0–2 | bleed | — | 15 |
| `threeBet` | 6–11 | — | missed | 15 |
| `foldTo3Bet` | 40–58 | missed | bleed | 10 |
| `coldCall` | 3–10 | bleed | — | 15 |
| `foldBBvsSteal` | 40–58 | missed | bleed | 10 |
| `cbetFlop` | 50–72 | — | missed | 10 |
| `cbetTurn` | 40–60 | — | missed | 8 |
| `foldToCbetFlop` | 40–58 | missed | bleed | 10 |
| `checkRaiseFlop` | 8–16 | — | missed | 10 |
| `aggFreq` | 35–52 | — | missed | 20 |
| `wwsf` | 43–50 | — | bleed | 20 |
| `wtsd` | 26–32 | bleed | missed | 20 |
| `wsd` | 48–56 | — | bleed | 10 |

Conventional low/mid-stakes MTT coaching ranges, not solver output. Tournament
values differ from cash: antes put dead money in before anyone acts, so steals
need to work less often and defending is cheaper relative to pot size.

**Stack depth changes meaning.** 22/19 at 50bb and 22/19 at 10bb are different
players. Read every finding against `worstPots[].stackBB`.

**Paired reads.** These say more together than alone:

| Pair | Condition | Reading |
|---|---|---|
| `wtsd` high + `wsd` low | both flagged | arriving at showdown with hands that lose there |
| `threeBet` low + `coldCall` high | both flagged | one leak: flatting where the choice is raise or fold |
| `vpip` high + `gap` high | both flagged | the extra hands are being called, not raised |
| `cbetFlop` ok + `cbetTurn` low | `cbetTurn.verdict = low` | one-and-done; giving up the pot on the turn |
| `chipFlow.nonShowdownBB` ≥ 0 + `showdownBB` ≪ 0 | — | the loss is entirely in called-down pots |

---

## 4. Findings

Each finding: `trigger` is checkable against the JSON. `cite` lists what must
appear in the output. Do not emit a finding without its citations.

---

### `LEAK-COLDCALL` — flatting instead of raising or folding

**trigger**
```
byRole[role='cold-call'].netBB < 0
  OR (stats[coldCall].flag = 'bleed' AND verdict != 'thin')
  OR (stats[threeBet].flag = 'missed' AND verdict != 'thin')
```
**cite** `byRole[role='cold-call']` (hands, netBB); `stats[threeBet].pct` and
`stats[coldCall].pct` when not thin.

**why it costs** Flatting builds a small pot, lets worse hands realise equity
cheaply, hands villain the initiative and the c-bet, and invites players behind
to squeeze. Cold-calling ranges are capped, so observant opponents widen their
barrels against them.

**fix** For each flat, ask whether the hand is good enough to 3-bet. If not, it
is usually a fold — the middle option is the leak. A 3-bet builds the pot when
ahead, folds out equity that would otherwise draw cheaply, claims the
initiative, and shrinks the field.

---

### `LEAK-CALLOFF` — calling off too wide for stacks

**trigger**
```
any biggestCalls[] with equityNeeded >= 40
```
Strengthen when that entry's hand has `stackBB >= 40` — deep and early, no ICM
pressure is forcing the flip.

**cite** the `id`, `costBB`, `equityNeeded`, and the hand's `stackBB`.

**why it costs** Required equity above ~45% means beating villain's *entire*
range close to half the time. Few hands do that against any range that put a
stack in.

**fix** Name villain's range before calling. If it can't be named, that is the
answer. Deep and early there is room to outplay rather than flip.

---

### `LEAK-TPWK` — top pair weak kicker, three streets

**trigger**
```
any worstPots[] where decisions[] contains action='call' on flop AND turn AND river
```
**cite** the `id`, the `board`, and the `equityNeeded` of the river call.

**why it costs** Reverse implied odds: small pots won when ahead, large pots
lost when behind to a better kicker. The hand cannot call three streets because
almost nothing worse can bet three streets.

**fix** A pot-control hand. One or two streets, not three. When the third
barrel comes, the weak kicker is the reason to fold.

---

### `LEAK-3BETCALL-OOP` — calling 3-bets out of position with speculative hands

**trigger**
```
any worstPots[] where role in ('open','iso-raise')
  AND decisions[] contains a call on preflop after the opening raise
  AND stackBB <= 30
```
**cite** the `id`, `stackBB`, and the resulting pot/stack figures from
`decisions[]`.

**why it costs** The resulting SPR is too low for implied odds to exist. You
must flop huge to continue, out of position.

**fix** At short-to-mid stacks, facing a 3-bet is 4-bet or fold. Speculative
hands want high SPR and position; neither is present.

> This finding names an *opening* hand but is not an opening-range finding —
> it is about the response to the 3-bet. Rule 1.2 still holds: do not comment
> on whether the open itself was in range.

---

### `LEAK-BBFOLD` — over-folding the big blind

**trigger** `stats[foldBBvsSteal].flag = 'missed' AND verdict != 'thin'`
**cite** `pct`, `made/opportunities`.

**why it costs** Antes mean a large price is being laid. Folding too often
makes stealing free for everyone behind.

**fix** Defend wider, with a flop plan. Defending and then folding to every
c-bet pays the leak twice.

---

### `LEAK-CBET` — no c-bet discipline

**trigger**
```
stats[cbetFlop].flag = 'missed' OR stats[cbetTurn].flag = 'missed'
  (verdict != 'thin' in each case)
```
**cite** whichever of the two is flagged, with `made/opportunities`.

**why it costs** The preflop raiser holds a range advantage on most boards.
Declining to use it gives back the value the raise bought.

**fix** C-bet on boards that favour your range; give up on ones that don't.
One-and-done is a leak; so is auto-firing every board.

---

### `LEAK-LIMP` — limping

**trigger** `stats[limp].flag = 'bleed' AND verdict != 'thin'`
**cite** `pct`, `byRole[role='limp']`.

**why it costs** No fold equity, no initiative, invites multiway pots with a
capped range.

**fix** Raise or fold, first in.

---

### `LEAK-CALLDOWN` — calling down too light

**trigger** `stats[wtsd].flag = 'bleed' AND stats[wsd].flag = 'bleed'`
(both `verdict != 'thin'`)
**cite** both percentages and `chipFlow.showdownBB`.

**why it costs** Reaching showdown often with hands that lose there. Real
opponents under-bluff rivers badly, especially with large sizings, so the
bluff-catchers arriving at showdown are beaten more often than MDF implies.

**fix** Fold bluff catchers below MDF against a population that under-bluffs.
MDF is a floor against a balanced opponent, not a licence to call.

---

## 5. Decision math

Arithmetic on the report, no solver. Use it to convert a judgement into a
testable claim.

- **Required equity on a call** = `toCall / (potBefore + toCall)`. Already
  computed as `equityNeeded`. This is the share of the final pot being bought,
  and the most useful number available.
- **Alpha** = `risk / (risk + reward)` — how often a bluff must work to break
  even.
- **MDF** = `1 − alpha`. Facing a bet of `B` into pot `P`: `MDF = P / (P + B)`.
- **SPR** = stack ÷ pot at the flop. Low SPR wants made-hand strength; high SPR
  wants hands that make nutted hands.

| Bet size | Caller needs | Bettor's bluff must work | MDF |
|---|---|---|---|
| ⅓ pot | 25% | 25% | 75% |
| ½ pot | 25% | 25% | 67% |
| ¾ pot | 30% | 30% | 57% |
| pot | 33% | 33% | 50% |
| 1.5× pot | 40% | 40% | 40% |
| 2× pot | 40% | 40% | 33% |

---

## 6. Mindset

Emit these only when their trigger fires. They are not filler.

### `MINDSET-RESULTS` — judge decisions, not results

**trigger** any `biggestCalls[]` entry whose hand has `netBB > 0` and
`equityNeeded` high enough to be questionable.

A call that needed 31% and had 26% is a losing call whether or not the river
saves it. Say so explicitly. These are the most dangerous hands in a session:
the result hides the error, so it gets repeated. This is the reason
`equityNeeded` is reported per decision rather than only per losing pot.

### `MINDSET-PROCESS` — process goals over results goals

**trigger** emit at most once, when the session's `chipFlow.netBB` is strongly
negative and no finding reaches confidence.

Decision quality, focus and tilt control are controllable; short-term results
are not. Review by examining the tough decisions, estimating how much variance
moved the number, and checking progress on the one thing being worked on — not
by reading the net.

### `MINDSET-TILT` — tilt has a measurable signature

**trigger** `stats[vpip].flag='bleed'` AND `stats[wtsd].flag='bleed'` AND
`stats[aggFreq].flag='missed'`.

More hands, more calls, less betting. When that shape appears, ask when the
hands were played before concluding it is a strategic leak.

### `MINDSET-ONELEAK` — one leak at a time

Always close with this. Name the single most expensive item in `byRole`, tell
them to play a few hundred hands with it as the only focus, then re-run.

---

## 7. Output contract

- Lead with `chipFlow`: net, and the showdown / non-showdown split. One line.
- Then at most 3 findings, ranked per §2. Each: what the number is, why it
  costs, the fix. Cite the finding's required evidence.
- Close with `MINDSET-ONELEAK`.
- State the sample size and, when under 200 hands, that percentages are not yet
  reliable.
- Do not restate the whole stat table. The user can read the report.

---

## 8. Provenance

Bands and taxonomy are drawn from general coaching literature, not from solver
output, and not all sources were reachable when this file was written — the
GTO Wizard and SplitSuit articles below are cited from search summaries rather
than fetched text. Treat the numbers as a tunable starting point. When bands
change, change §3 and `BANDS` in `src/lib/hh/stats.ts` together.

- [GTO Wizard — The 3 Biggest Leaks Killing Your Winrate](https://blog.gtowizard.com/the_3_biggest_leaks_killing_your_winrate/)
- [SplitSuit — Most Common Poker Leaks and Fixes](https://www.splitsuit.com/most-common-poker-leaks-fixes)
- [Upswing — 5 Strategic Mistakes Poker Players Make](https://upswingpoker.com/exploit-poker-leaks/)
- [Upswing — How to Play Top Pair Weak Kicker](https://upswingpoker.com/top-pair-weak-kicker/)
- [Upswing — What is a HUD & What Stats Should You Include?](https://upswingpoker.com/poker-hud-stats/)
- [PokerCoaching — Poker Kicker: How It Works and Mistakes That Cost Pots](https://pokercoaching.com/blog/poker-kicker/)
- [PokerCoaching — 3 Most Common Exploits In Live Tournament Poker](https://pokercoaching.com/blog/exploits-in-live-tournament-poker/)
- [BBZ Poker — Poker HUD Stats Explained for Tournament Players](https://bbzpoker.com/poker-hud-stats-explained/)
- [Poker Trainer — Introduction to Minimum Defense Frequency](https://pokertrainer.se/introduction-to-minimum-defense-frequency/)
- [PokerSkill — MDF and Bluff Frequency Table](https://www.pokerskill.com/blog/optimal-bluffing-frequency-formula/)
- [PokerSkill — Cold Call vs 3-Bet: When to Pick Each](https://www.pokerskill.com/blog/cold-call-vs-3-bet/)
- [Deepfold — Bluff Catching: When to Call and When to Let It Go](https://deepfold.co/en/blog/bluff-catching-principles)
- [PokerStars Learn — How to Identify and Fix Poker Leaks](https://www.pokerstars.com/poker/learn/strategies/how-to-identify-and-fix-poker-leaks/)
- [PokerNews — Jared Tendler Offers Defense of Results-Oriented Goals](https://www.pokernews.com/strategy/jared-tendler-in-defense-of-results-oriented-goals-15650.htm)
- [Jared Tendler — The Mental Game of Poker](https://jaredtendler.com/books/the-mental-game-of-poker/)
