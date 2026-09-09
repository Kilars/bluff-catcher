# Leak coaching reference

Grounding for the leak report (`npm run leaks`). It exists so the numbers in
`src/lib/hh/stats.ts` have a stated source and so any coaching layer built on
top argues from established material rather than inventing it.

Two claims run through everything below:

- **Bleed** — chips leaving that shouldn't. Almost always calling: calling
  raises, calling down, calling off stacks.
- **Missed** — chips not coming in that should. Almost always declining to
  raise: flatting instead of 3-betting, checking instead of betting.

Most losing sessions are one leak wearing two costumes: *raise-or-fold spots
answered with a call.*

---

## 1. The stat reference

Bands in `stats.ts`. They are conventional coaching ranges, not solver output.
Tournament numbers differ from cash because antes put dead money in the middle
before anyone acts, so steals need to work less often and defending is cheaper
relative to pot size.

| Stat | Band | Above band means | Below band means |
|---|---|---|---|
| VPIP | 20–28% | bleed — too many hands | missed — too tight |
| PFR | 16–23% | — | missed |
| VPIP − PFR gap | 0–7pts | bleed — calling where you should raise | — |
| Limp (first in) | 0–2% | bleed | — |
| 3-bet | 6–11% | — | missed |
| Fold to 3-bet | 40–58% | missed — folding out your own equity | bleed — defending too wide |
| Cold-call an open | 3–10% | bleed | — |
| Fold BB vs steal | 40–58% | missed | bleed |
| C-bet flop | 50–72% | — | missed |
| C-bet turn | 40–60% | — | missed |
| Fold to flop c-bet | 40–58% | missed | bleed |
| Check-raise flop | 8–16% | — | missed |
| Aggression frequency | 35–52% | — | missed |
| Won when saw flop | 43–50% | — | bleed |
| Went to showdown | 26–32% | bleed — calling down too much | missed |
| Won at showdown | 48–56% | — | bleed — the hands arriving are too weak |

**Stack depth changes what a stat means.** A 22/19 line at 50bb and the same
22/19 at 10bb are different players. Read every reading against `stackBB`.

**Sample size.** The report marks anything under its `minN` as `thin sample`
and never flags it. At a few hundred hands only VPIP/PFR/3-bet have settled;
postflop stats need thousands. Until then the money breakdown — net by how you
entered the pot — is the honest signal.

**WTSD and W$SD are read together.** High WTSD with low W$SD is the signature
of calling down too light: you are arriving at showdown often, with hands that
lose when they get there.

---

## 2. The math the report can prove

All of this is arithmetic on the hand history — no solver, no equity guessing.
It is what turns "that felt loose" into a number.

**Required equity on a call** = `toCall / (pot + toCall)`. The share of the
final pot you are buying. This is the single most useful number in the report,
because it converts every call into a testable claim: *does my hand beat this
opponent's range that often?*

**Alpha** = `risk / (risk + reward)` — how often a bluff must work to break
even. **MDF** = `1 − alpha`: how often the defender must continue to stop that
bluff being free money. Against a bet of `B` into pot `P`, MDF = `P / (P + B)`.

Common sizings, facing a bet:

| Bet size | You need | Villain must bluff | MDF |
|---|---|---|---|
| ⅓ pot | 25% | 25% | 75% |
| ½ pot | 25% | 25% | 67% |
| ¾ pot | 30% | 30% | 57% |
| pot | 33% | 33% | 50% |
| 1.5× pot | 40% | 40% | 40% |
| 2× pot | 40% | 40% | 33% |

**MDF is a defensive floor against a theoretically balanced opponent, not a
calling licence.** Real opponents under-bluff rivers badly, especially with
large sizings. Against a population that never has enough bluffs, the exploit
is to fold bluff catchers below MDF — you are not "owed" a call.

**SPR** (stack ÷ pot at flop) sets how playable a hand is. Low SPR wants
made-hand strength; high SPR wants hands that make nutted hands.

---

## 3. The leak taxonomy

Each entry: what it looks like in a hand history, why it costs, the fix.

### Cold-calling a raise
**Evidence:** `role: cold-call` with a negative net; a 3-bet% under band next
to a cold-call% over band.
**Why it costs:** flatting builds a small pot, lets worse hands realise their
equity cheaply, hands villain the initiative and the c-bet, and invites players
behind to squeeze. Cold-calling ranges are capped and observant opponents widen
their barrels against them.
**Fix:** for each flat, ask whether the hand is good enough to 3-bet. If not,
it is usually a fold — the middle option is the leak. 3-betting builds the pot
when ahead, folds out the equity that would otherwise draw on you cheaply,
claims the initiative, and shrinks the field.

### Calling off too wide for stacks
**Evidence:** a single call in `biggestCalls` with a high `equityNeeded`, early
in the tournament, deep.
**Why it costs:** required equity above ~45% means you must beat villain's
entire range close to half the time. Very few hands do that against any range
that put a stack in.
**Fix:** name villain's range out loud before calling. If you can't, that's the
answer. Deep and early, there is no ICM pressure forcing a flip — you have room
to outplay instead.

### Top pair, weak kicker, three streets
**Evidence:** `call` on flop, turn and river with an ace and a low kicker on an
ace-high board.
**Why it costs:** reverse implied odds — small pots won when ahead, big pots
lost when behind to a better kicker. The hand cannot call three streets because
almost nothing worse can bet three streets.
**Fix:** top pair weak kicker is a pot-control hand. One or two streets, not
three. When the third barrel comes, the kicker is the reason to fold.

### Calling 3-bets out of position with speculative hands
**Evidence:** `role` open then a call of a raise, at low `stackBB`, with a
suited connector.
**Why it costs:** the resulting SPR is too low for implied odds to exist. You
need to flop huge to continue, and you're out of position doing it.
**Fix:** at short-to-mid stacks, facing a 3-bet is 4-bet or fold. Suited
connectors want a high SPR and position; neither is present.

### Over-folding the big blind
**Evidence:** `Fold BB vs steal` over band.
**Why it costs:** antes mean you are getting a large price. Folding too often
makes stealing free for everyone behind.
**Fix:** defend wider, but with a plan for the flop — defending and then
folding to every c-bet is the same leak paid twice.

### No c-bet discipline
**Evidence:** c-bet flop under band, or barrelling turn under band after
c-betting flop.
**Why it costs:** the preflop raiser has a range advantage on most boards.
Declining to use it gives back the value the raise bought.
**Fix:** c-bet as the aggressor on boards that favour your range; give up on
ones that don't. One-and-done is a leak; so is auto-firing every board.

### Limping
**Evidence:** `limp` in the role breakdown.
**Why it costs:** no fold equity, no initiative, invites multiway pots with a
capped range.
**Fix:** raise or fold, first in.

---

## 4. Mindset

**Judge decisions, not results.** A call that needed 31% equity and had 26% is
a losing call whether or not the river saves you. The report's `equityNeeded`
column exists exactly so a won pot can still be marked as an error — those are
the most dangerous hands in any session, because the result hides the leak and
you repeat it.

**Process goals over results goals.** You control decision quality, focus and
tilt control; you do not control short-term results. Results goals are still
useful as motivation, but the review has to run on process. A session is
reviewed by looking closely at the tough decisions, estimating how much variance
moved the number, and checking progress on the specific thing you were working
on — not by reading the net.

**Tilt is a decision-quality problem.** The measurable signature is VPIP and
WTSD drifting up while aggression drifts down: more hands, more calls, less
betting. If the report shows that shape, look at when the hands were played
before concluding it's a strategic leak.

**One leak at a time.** Pick the single most expensive item in the role
breakdown, play a few hundred hands with it as the only focus, then re-run.

---

## Sources

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
