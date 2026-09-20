# Leak coaching reference

Grounding for an agent that turns `npm run leaks -- --json` into coaching.
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
meta.window  {requestedFrom, requestedTo, first, last, hands, decisions}
meta.archive {files, hands, excluded, skipped, first, last, tournaments,
              games, timezone}
meta.levels, meta.tournaments — of the window
stats[]      {key, label, made, opportunities, pct, band, verdict, flag}
byBoard      {caveat, splits[]}
rfiFolds[]   {id, position, hand, cards, stackBB, depth, action, caveat}
byRole[]     {role, hands}
```

**The payload is blind to results, deliberately.** There is no chip flow, no
net by role, no loss-ranked pot list and no won-when/won-at-showdown. Hands
that lost are not hands that were played badly — a cooler played perfectly
loses a stack, and a bad fold costs nothing and leaves no trace — so an agent
given the money coaches the wrong hands. `--mode pots` is the one place results
are visible, and it is for a human asking where the chips went, not for you.

`splits[]` = `{key, board, made, opportunities, pct}`, where `key` is one of
`cbetFlop | cbetTurn | foldToCbetFlop` and `board` is one of
`dry-high-mine | wet-high-mine | middling-theirs | paired | monotone`.

`verdict` ∈ `low | ok | high | thin | none`. `flag` ∈ `bleed | missed | null`.

**Every stat and every count is the window, not the archive.** A
date window is selected with `--from` / `--to`, inclusive, either usable alone.
`board` stops at the last street Hero acted on, so it is what Hero saw, not the
full runout. Villain hole cards are not in the payload at any point.

- **bleed** — chips leaving that should not. Nearly always calling.
- **missed** — chips not coming in that should. Nearly always declining to raise.

---

## 1. Hard rules

1. **Never coach a stat whose `verdict` is `thin`.** The sample is below its
   minimum. Reporting it as a leak is a factual error, not a judgement call.
2. **Never coach opening *frequency*.** Roles `open` and `iso-raise` are
   drilled in the app's preflop trainer. Report their net if asked; never flag
   how often Hero opens. The carve-out is `rfiFolds[]`: a named fold of a named
   hand from a named seat is a per-hand fact, not a frequency, and it is the
   one finding that is sound at n=1. Coach those; they are already filtered to
   folds outside the chart's bottom 3% of combos.
3. **Never infer a villain's holding from the report alone.** `cards` is
   Hero's view. Shown cards are not in the JSON.
4. **Never ask what a hand returned, and never guess.** The payload has no
   result for anything, by design (§0). If a finding needs to know whether a
   pot was won, it is not a finding — it is a story about variance.
5. **On a sample under 200 hands, lead with `rfiFolds` and `byRole`,** not with
   percentages. Only `vpip`, `pfr` and `threeBet` settle early; postflop stats
   need thousands.
7. **Report at most 3 findings.** Ranked by rule 2 below. More is noise, and
   **fewer than three is a correct output** — say nothing rather than reach.
8. **Describe only `meta.window`.** `meta.archive` is there so you know how
   thin a slice you were handed. Never describe hands outside the window, and
   never call the window "your session" unless the dates say it is one.
9. **`byBoard.splits` are never banded.** Read the direction between buckets,
   never the percentage, and repeat `byBoard.caveat` if you cite one at all.

---

## 2. Ranking

Rank candidate findings by, in order:

1. Named hands. A `rfiFolds[]` entry is a fact about one decision and is sound
   at n=1 — it outranks every frequency, however large the sample.
2. The same mistake more than once. Two chart folds from the same seat at the
   same depth is a rule Hero is carrying, not two accidents. Say which they
   share; that is the finding, not the count.
3. `flag` present and `verdict` ∈ {`low`, `high`} — a real band violation.

Ranking used to lead with money, which meant coaching whichever hands lost.
That is backwards: the hands that lost are not the hands played worst, and the
payload no longer lets you sort by them at all.

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

Conventional low/mid-stakes MTT coaching ranges, not solver output. Tournament
values differ from cash: antes put dead money in before anyone acts, so steals
need to work less often and defending is cheaper relative to pot size.

**Stack depth changes meaning.** 22/19 at 50bb and 22/19 at 10bb are different
players. Read every finding against `rfiFolds[].stackBB`.

**Paired reads.** These say more together than alone:

| Pair | Condition | Reading |
|---|---|---|
| `threeBet` low + `coldCall` high | both flagged | one leak: flatting where the choice is raise or fold |
| `vpip` high + `gap` high | both flagged | the extra hands are being called, not raised |
| `cbetFlop` ok + `cbetTurn` low | `cbetTurn.verdict = low` | one-and-done; giving up the pot on the turn |

---

## 4. Findings

Each finding: `trigger` is checkable against the JSON. `cite` lists what must
appear in the output. Do not emit a finding without its citations.

---

### `LEAK-COLDCALL` — flatting instead of raising or folding

**trigger**
```
(stats[coldCall].flag = 'bleed' AND verdict != 'thin')
  OR (stats[threeBet].flag = 'missed' AND verdict != 'thin')
```
**cite** `byRole[role='cold-call'].hands`; `stats[threeBet].pct` and
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

**where to look** `byBoard.splits` cuts these by flop texture. A high figure on
`dry-high-mine` next to a low one on `middling-theirs` is discipline, not a
leak — that is the shape the fix describes. The reverse is the leak worth
naming. Never quote a split's percentage as a number; the buckets are tiny.

---

### `LEAK-RFIFOLD` — folding a hand the chart opens

**trigger**
```
rfiFolds[] is non-empty
```
**cite** the hand's `id`, `cards`, `position`, `stackBB` and `depth`, plus its
`caveat` when one is set. Never aggregate them into a rate — that would be
opening frequency, which rule 2 forbids.

**why it costs** First in, with fold equity and position still to come, these
are the cheapest chips in the game to pick up. Unlike everything else here the
finding needs no sample: the chart either plays the hand from that seat at that
depth or it does not.

**fix** Name the seat and the hand, and send them to the preflop trainer's
matching position and depth. One fold is a slip; the same seat twice is a
habit.

---

### `LEAK-LIMP` — limping

**trigger** `stats[limp].flag = 'bleed' AND verdict != 'thin'`
**cite** `pct`, `byRole[role='limp']`.

**why it costs** No fold equity, no initiative, invites multiway pots with a
capped range.

**fix** Raise or fold, first in.

---

## 5. Decision math

Arithmetic on the report, no solver. Use it to convert a judgement into a
testable claim.

- **Required equity on a call** = `B / (P + 2B)` facing a bet of `B` into a pot
  of `P` — the share of the *final* pot being bought. Not `B / (P + B)`: that
  forgets your own call is in the pot you are trying to win.
- **Alpha** = `risk / (risk + reward)` — how often a bluff must work to break
  even.
- **MDF** = `1 − alpha`. Facing a bet of `B` into pot `P`: `MDF = P / (P + B)`.
- **SPR** = stack ÷ pot at the flop. Low SPR wants made-hand strength; high SPR
  wants hands that make nutted hands.

| Bet size | Caller needs | Bettor's bluff must work | MDF |
|---|---|---|---|
| ⅓ pot | 20% | 25% | 75% |
| ½ pot | 25% | 33% | 67% |
| ¾ pot | 30% | 43% | 57% |
| pot | 33% | 50% | 50% |
| 1.5× pot | 38% | 60% | 40% |
| 2× pot | 40% | 67% | 33% |

The middle column is `alpha = B / (P + B)` and the left is `B / (P + 2B)`; they
are different questions and the two columns used to carry the same numbers.
Alpha rises much faster with sizing than required equity does — that gap is
why an overbet bluff needs so many more folds than the call needs equity.

---

## 6. Mindset

Emit these only when their trigger fires. They are not filler.

### `MINDSET-PROCESS` — process goals over results goals

**trigger** emit at most once, when no finding reaches confidence.

Decision quality, focus and tilt control are controllable; short-term results
are not. Review by examining the tough decisions, estimating how much variance
moved the number, and checking progress on the one thing being worked on — not
by reading the net.

### `MINDSET-TILT` — tilt has a measurable signature

**trigger** `stats[vpip].flag='bleed'` AND `stats[aggFreq].flag='missed'`.

More hands, more calls, less betting. When that shape appears, ask when the
hands were played before concluding it is a strategic leak.

### `MINDSET-ONELEAK` — one leak at a time

Always close with this. Name the one thing to work on, tell them to play a few
hundred hands with it as the only focus, then re-run.

---

## 7. Output contract

- Never open with how the session went. You do not know, and saying it anyway
  is the failure mode this payload exists to prevent.
- At most 3 findings, ranked per §2. Each: what happened, why it costs, the
  fix. Cite the finding's required evidence.
- Close with `MINDSET-ONELEAK`.
- State `meta.window.hands` as the sample size and, when under 200, that
  percentages are not yet reliable. If `meta.archive.hands` is much larger, say
  the window is a slice of a bigger archive — do not quietly imply otherwise.
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
