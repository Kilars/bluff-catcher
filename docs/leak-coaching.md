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
labels[]     {label, shared, instances, stride, decisions[]}
rfiFolds[]   {id, position, hand, cards, stackBB, depth, action, caveat}
coldCalls[]  {id, position, vsPos, cards, hand, stackBB, depth, limpersAhead}
bigSpots[]   {id, position, role, pfa, cards, hand, stackBB, depth, committedBB,
              board, decisions[{street, action, amountBB, potBB, toCallBB,
              sizing, allIn, equityNeeded, handClass}]}
faced3Bets[] {id, position, heroRole, threeBettorPos, cards, hand, stackBB,
              depth, multiway, sizing, response}
byBoard      {caveat, splits[]}
byRole[]     {role, hands}
stats[]      {key, label, made, opportunities, pct, band, verdict, flag}
```

`--label <name>` re-runs with one label and no stride — every instance rather
than the five sampled. Use it when a group looks like a pattern worth arguing
and the sample is too thin to name what the instances share.

Listed in reading order. `labels[]` and `rfiFolds[]` name what Hero did and are
the reason a hand is here at all; `stats[]` is last because it is context, not
a finding — every tracker computes it and none of it is specific to a hand.

**The payload is blind to results, deliberately.** There is no chip flow, no
net by role, no loss-ranked pot list and no won-when/won-at-showdown. Hands
that lost are not hands that were played badly — a cooler played perfectly
loses a stack, and a bad fold costs nothing and leaves no trace — so an agent
given the money coaches the wrong hands. `--mode pots` is the one place results
are visible, and it is for a human asking where the chips went, never for you.
The big hands reach you through `bigSpots[]` instead: ranked by what Hero
committed, with every decision's pot and price and no outcome.

**Hands reach you because they carry a label, never because of what they
returned.** `labels[]` is the selector, and `rfiFolds[]`, `coldCalls[]` and
`faced3Bets[]` are the per-hand preflop ones — each sound at n=1. `faced3Bets[]`
is every hand where Hero's raise was raised over the top: the record behind the
`foldTo3Bet` stat, which otherwise names no hand. Everything in a labelled
decision was knowable before the next card came.

`labels[].decisions[]` = `{id, street, action, position, stackBB, depth, spr,
sizing, allIn, pfa, facedBet, cards, board, handClass, boardType, removals,
labels}`.

- `handClass` ∈ `strong | marginal-made | draw | air`, read against the board
  as it stood at that decision. `strong` = two pair or better using a hole
  card, an overpair, or top pair with a Q+ kicker. `draw` = eight or more outs.
- `boardType` is the **flop's** texture on every street — the same five
  buckets `byBoard` uses.
- `sizing` is the bet or raise as a fraction of the pot, and is `null` for a
  fold, a check, a call and an all-in. `allIn` tells the last of those apart: a
  shove is not a chosen size, so it carries no fraction rather than a made-up
  one.
- `removals` = `{card, removes}[]` — what a card in Hero's hand takes out of
  the hands *the board can make*. It is board-derived and says nothing about
  what villain held. It goes quiet on a bricked draw, which is exactly where
  blockers matter most; that silence is a known limit, not a finding.
- `shared` holds only the facets — `position`, `depth`, `handClass`,
  `boardType` — on which **every** instance of the label agrees, and is empty
  below two instances. It is the finding. There is no rate and no denominator
  attached to any of it, by design.
- `instances` is how many there were; `stride` is the sampling interval, so
  `decisions[]` is every `stride`-th instance in archive order, never a ranked
  pick. A stride above 1 means you are reading a sample.

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
7. **Rank, don't pad.** Within each section of the review, lead with the
   findings ranked by rule 2 below. A section with nothing real in it says so in
   one line — say nothing rather than reach.
8. **Describe only `meta.window`.** `meta.archive` is there so you know how
   thin a slice you were handed. Never describe hands outside the window, and
   never call the window "your session" unless the dates say it is one.
9. **`byBoard.splits` are never banded.** Read the direction between buckets,
   never the percentage, and repeat `byBoard.caveat` if you cite one at all.
10. **A label is not a mistake.** `labels[]` says what happened; whether it was
   wrong is your call, made from the decision's own board, hand class, sizing
   and SPR. Several of these fire on lines `docs/strategy-notes.md` recommends
   outright, so a report that treats the list as a list of errors is wrong on
   its face. Never turn `instances` into a rate — there is no denominator, and
   inventing one is the counting this payload was built to avoid.

---

## 2. Ranking

Rank candidate findings by, in order:

1. Named hands. A `rfiFolds[]` entry is a fact about one decision and is sound
   at n=1 — it outranks every frequency, however large the sample.
2. The same thing more than once, with something in common. A `labels[]` group
   whose `shared` is non-empty, or two chart folds from the same seat at the
   same depth, is a rule Hero is carrying rather than two accidents. Say what
   they share; that is the finding, not the count. An empty `shared` is a real
   answer too — it says these instances have nothing to do with each other.
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
`stats[coldCall].pct` when not thin. For the per-hand drill-down, cite specific
`coldCalls[]` entries: each is one flat, sound at n=1 like a chart fold — name
the `id`, `cards`, `position`, `vsPos` (the opener's seat) and `stackBB`, and
argue it. A flat is not automatically a leak: a small pair set-mining in
position, or a suited hand closing behind at a price, is fine; the leak is a
dominated broadway or a medium pair flatted out of position, where the choice
was 3-bet or fold. `vsPos` is the pivot — the same hand is a flat vs a button
open and a fold vs UTG. Never aggregate `coldCalls[]` into a rate.

**why it costs** Flatting builds a small pot, lets worse hands realise equity
cheaply, hands villain the initiative and the c-bet, and invites players behind
to squeeze. Cold-calling ranges are capped, so observant opponents widen their
barrels against them.

**fix** For each flat, ask whether the hand is good enough to 3-bet. If not, it
is usually a fold — the middle option is the leak. A 3-bet builds the pot when
ahead, folds out equity that would otherwise draw cheaply, claims the
initiative, and shrinks the field.

---

### `LEAK-FOLD3BET` — folding too much (or continuing wrong) to a raise over your raise

**trigger**
```
stats[foldTo3Bet].flag = 'missed' AND verdict != 'thin'
  OR faced3Bets[] has two or more entries that share a facet
```
**cite** `stats[foldTo3Bet].pct` and `made/opportunities` when not thin, and for
the per-hand drill-down the specific `faced3Bets[]` entries: name the `id`,
`cards`, `position`, `threeBettorPos`, `heroRole`, `sizing`, `multiway` and
`response`, and argue each one. A fold is not automatically a leak — `faced3Bets`
is full of correct folds (junk opens, dominated offsuit hands out of position
against a big size), and the stat being high only points you at the list; the
coaching is per hand.

`heroRole` splits the list in two: an `open`/`iso-raise` entry is **facing a
3-bet**, a `3bet`/`squeeze` entry is **facing a 4-bet** (`response: '4bet'` is
then Hero's 5-bet). `threeBettorPos` vs `position` fixes who is in position — a
hand folded in position to a blind's 3-bet is a tighter fold than the same hand
out of position to the seat on your left. `multiway: true` is a squeeze: a caller
was already in, so Hero's continuing range tightens and the 4-bet denies the
cold-caller's equity too.

**why it costs** The same way `LEAK-COLDCALL` does, inverted: refusing to
continue hands good enough to call or 4-bet lets opponents 3-bet you for free, and
it is self-reinforcing — a player who never 4-bet-bluffs gets value-owned by every
4-bet they do make. The mirror leak is continuing *wrong*: flatting a dominated
offsuit broadway out of position, or calling a 4-bet with a hand the 4-bet range
dominates, spews the chips the fold would have saved.

**fix** Read the whole list before judging. The common shapes: (1) a genuinely
too-tight fold of a strong, playable hand — flat it in position, flat or 4-bet it
out; (2) only value 4-bets and no bluff 4-bets — a few blocker hands (suited aces)
keep the value ones paid; (3) a too-loose continue out of position — fold or
3-bet it rather than cold-call. Name which shape each cited hand is.

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

### `LABEL-GROUP` — the same spot, played the same way

Not a `LEAK-`, and the prefix is the point: a label says what happened, and
three of the six below fire on lines `docs/strategy-notes.md` recommends. The
finding is never the label. It is the group agreeing on something, plus your
own read of the instances it hands you.

**trigger**
```
labels[] has an entry whose `shared` is non-empty
```
**cite** the label, every key in its `shared`, and at least one decision's
`id`, `cards`, `board`, `handClass`, `sizing` and `spr`. Never cite
`instances` as a rate and never describe a group whose `shared` is empty as a
pattern.

**the vocabulary**

- **`pfa-check-flop`** — Hero raised preflop and checked the flop (a
  check-raise is excluded; that is a different line). §2's c-bet frequency runs
  from ~90% on A-7-2r to ~25% on T-9-7, so `shared.boardType` decides this one:
  all on `middling-theirs` is discipline, all on `dry-high-mine` is giving back
  what the raise bought.
- **`pfa-check-turn`** — Hero raised preflop, c-bet the flop, then checked the
  turn (a turn check-raise is excluded, and a turn check after a *flop* check is
  not this — that pot was already given up on the flop). The turn is the barrel
  the flop bet set up; `shared.boardType` still carries the flop texture, so
  read the turn card and whether the range shifted, not a barrelling rate.
- **`barrel-abandon`** — Hero c-bet the flop, barrelled the turn, then checked
  the river with `air` (no showdown value): two barrels fired and then the line
  given up on the last card the bluff had to be told on. Unlike `pfa-check-turn`
  this abandons a *held* barrel line, not a preflop-earned initiative. Not a
  verdict — a river give-up can be correct on a bricked board where a third
  barrel has no fold equity — and it names no barrelling frequency; read the
  river card and board, and `shared.boardType` carries the flop texture.
- **`cbet-multiway-air`** — Hero was the preflop raiser and c-bet the flop with
  `air` (no showdown value) into **3+ players**. A pure-bluff c-bet lives on fold
  equity, and multiway that equity has to clear *every* villain — each extra
  range behind is another that has to fold before the bluff prints, so this is
  the selection error the family names. Not a verdict: with real backdoor equity
  or a coherent barrel plan on a raiser-favoured board it is fine, and
  `shared.boardType` plus the player count are the read — never a c-bet rate,
  which is a stats-layer concern this label does not touch.
- **`check-draw`** — Hero checked holding eight or more outs. A fold is great
  for a draw, so the default is to bet — but checking a nut flush draw on a
  monotone flop is standard, and `shared.boardType` is again what separates
  them.
- **`donk-bet`** — Hero was the caller, not the preflop raiser, and led into
  the flop rather than checking to the aggressor. Mostly dominated — the
  caller's range is capped and the raiser keeps the top — but correct on low
  connected boards where the caller owns the straights and sets, so
  `shared.boardType` decides it: a lead on `middling-theirs` (e.g. 6-5-4) can be
  the line, a lead on `dry-high-mine` is usually the leak.
- **`turn-probe`** — Hero was the caller and led the turn after the preflop
  raiser **checked back the flop** (a declined c-bet, not any turn lead). The
  flop went check-check, so both ranges are uncapped and the probe attacks a
  hand that already gave up once; `shared.boardType` carries the flop texture,
  so read the turn card and whether it favours the caller. Heads-up read: with a
  third player in, confirm the checked flop was the raiser's before trusting it.
- **`check-raise-flop`** — Hero check-raised the flop as the caller. Correct and
  underused, but built from equity-when-called (sets, two pair, combo draws);
  its frequency swings hard with texture, so read `shared.boardType` and the
  instance's `handClass`, not the raise itself.
- **`overbet-strong`** — a bet or raise larger than the pot with `strong`. The
  gate for a size above the pot is nut advantage; with it this is the
  recommended river line, and without it the overbet is pure value that a
  competent opponent reads instantly. Check the board and the street, not the
  size alone. On the **river** in particular, `strong` admits non-nut hands
  (an overpair, top pair with a Q kicker), and an overbet with one of those for
  thin value folds out exactly the worse hands you wanted the call from — a
  two-thirds-pot bet gets more of them. Read whether this was polar value or a
  thin value bet dressed as an overbet.
- **`river-bluff-with-blocker`** — a river bet with no showdown value, holding
  a card the board's possible hands need. Whether that helps or hurts depends
  on whether those hands were going to call or fold, and the payload cannot
  tell you: read `removals` against the board yourself.
- **`river-bluff-no-blocker`** — the same bet, removing nothing. This is not
  automatically the worse one. On a board where the draw bricked, the hand
  blocking nothing is the *better* bluff, because the blocker would have been
  blocking folds.
- **`river-call-marginal`** — Hero called a river bet with a pair that is not
  top pair with a good kicker. The bluff-catch, and the one decision where
  blockers reliably matter: ranges are narrow and the call/fold boundary is
  sharp.
- **`river-check-value`** — Hero checked the river holding `strong` or
  `marginal-made` and the pot **checked through** — not a check that then called
  a bet, which is a bluff-catch (`river-call-marginal`). The value-side mirror of
  `overbet-strong`, and the one label here that catches an *omission*: the
  checked-back made hand is where thin value quietly goes missing, and against a
  pool that doesn't fold a made hand taken to showdown is often a bet left
  unmade. The label says only that Hero checked a made hand through; whether
  value was there is your read from the board and the pool, not a claim it makes.
- **`river-raise-value`** — Hero raised over a river bet holding `strong` or
  `marginal-made`. The top of the value range: a raise only prints when it beats
  what calls it, and `strong` here admits non-nut hands (an overpair, top pair
  with a Q kicker), so a "marginal-made" raise usually turns a bluff-catcher into
  a hand that folds out worse and is called by better — read the actual cards and
  the line (`facedSizing`) villain reps, not the bucket. The label says Hero
  raised; whether it was value is your call.
- **`river-raise-bluff`** — Hero raised over a river bet holding `air`. A pure
  bluff-raise, a steeper ask than a bet because the bettor already showed
  strength; it must credibly rep a hand that beats them. Whether a blocker helps
  depends on whether it removes their calls or their folds, and the payload
  cannot tell you: read `removals` against the board yourself, and do not assume
  the raise is good just because the hand has none.
- **`fold-to-turn-barrel`** — Hero folded the turn to a **continued** bet: the
  villain bet the flop too, so this is a second barrel, not a lone stab. The
  honest question is the price against the hand — `facedSizing` gives
  `requiredEquity`/`mdf`, and a showdown class that clears the price defends
  while one that does not folds. A fold can be correct: do not read the label as
  an over-fold. Small-stakes pools under-barrel, so over-folding is the *lean* to
  test, never the verdict. Heads-up-to-Hero the price is exact; with villains
  acting between the bet and Hero it mis-scales, so confirm the line first
  (multiway the flop and turn bets may be different villains, not one barrel).
- **`fold-to-river-barrel`** — Hero folded the river to a **continued** barrel:
  the villain bet the turn behind too, backing the river bet (the flop may have
  checked through, so this is a barrel of at least two streets, not necessarily
  three). Same reading: weigh `requiredEquity`/`mdf` from `facedSizing` against
  the showdown class Hero held, on the sharp river call/fold boundary. A fold
  can be correct — paired boards, bricked draws and narrow barrelled value lines
  are folds, not over-folds. The pool's under-bluffing is a lean to test against
  the price, not a licence to call wider blind, and the price is exact only
  heads-up-to-Hero (multiway the two bets may be different villains).

**On the bluff-catch and the river bluffs, the correct direction is population-
dependent, and the report cannot see it.** The same call is right against a
field that over-bluffs and wrong against one that under-bluffs — coaches split
exactly here, some folding marginal made hands because the pool never finds the
triple-barrel bluff, others calling wider because small stakes over-folds and so
must be barrelled. This is why the payload carries no villain tendency and why
these labels do not say which way a blocker points (§ rule 3): pick the
direction from your own read of the pool, not from the report, and say which
read you are making.

**why it costs** Nothing here costs anything on its own. What costs is a rule
applied where it does not fit — the same check on the same texture from the
same seat, repeated — and `shared` is the only evidence that a rule is what
this is.

**fix** Name the shared facets, pick one decision from `decisions[]` and argue
it out loud from its own board, hand class, SPR and sizing. If you cannot say
why a particular instance was wrong, the group is not a finding.

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
- A full review in the sections the `hand-review` skill lists: what's going
  well, preflop, every postflop label family, big spots, and one focus.
  Each finding: what happened, why it costs, the fix. Cite the finding's
  required evidence, and name the correct instances alongside the leaks.
- Close with `MINDSET-ONELEAK`.
- State `meta.window.hands` as the sample size and, when under 200, that
  percentages are not yet reliable. If `meta.archive.hands` is much larger, say
  the window is a slice of a bigger archive — do not quietly imply otherwise.
- Do not restate the whole stat table. The user can read the report.
- **Never lead with a percentage.** `stats[]` may support a finding that a
  label or a chart fold already established; it may not be the finding. If the
  only thing you have is a banded number, you have nothing worth three
  paragraphs — say less.

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
