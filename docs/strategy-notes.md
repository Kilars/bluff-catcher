# Poker strategy notes

Personal reference. Built from a working session on range boundaries, blockers,
bluff structure, sizing, postflop decision-making and preflop 3-bet/flat.

Numbers are solver-flavoured approximations unless marked exact. Treat decimals
as ±2%; the shapes are reliable.

---

## Quick reference — at the table

**Postflop as the preflop aggressor, in order:**

1. **Whose board is it?** → picks the SIZE
2. **Where's my hand inside that?** → picks the FREQUENCY
3. **Does a fold help me or hurt me?** → resolves protection vs value
4. **If I bet flop and turn, what's my river bet and what am I repping?**

**Before any large bet:** name three value hands you'd bet this size with. Can't? Then you have no bluff at this size either.

**Bluff selection:** flop = equity. River = blockers + zero showdown value.

**Blocker rule:** block their *calls*, unblock their *folds*. The direction flips by street.

**Deviation rule:** the size of your exploit scales with the confidence of your read. Unsure → GTO.

---

## 1. Range boundaries — where the edge is drawn

- A hand sitting exactly on an RFI boundary is worth roughly **0 to +0.05bb** vs folding. That's what "boundary" means — EV crosses zero there.
- Getting the line wrong by a few hands is noise. Your winrate lives in the top of your range and in big pots.
- **But**: a solver draws the line where EV = 0 *given solver-quality postflop play*. Yours isn't. And boundary hands are exactly where your leaks cost most — dominated top pairs, second-nut flushes, one-pair bluff-catchers.
- → **Draw your line tighter than the chart.** The useful question is not "where is the edge" but "how much of the theoretical EV do I actually realize near it."
- Error is asymmetric: too wide costs much more than too tight.

Rough cost scale, 100bb:

| Mistake | Cost |
|---|---|
| Opening 3% too wide, played well | ~0.1–0.3bb/100 |
| Opening 3% too wide, played like a human | ~1bb/100 |
| One misplayed big pot | 5bb+ in a single hand |

**Where the boundary genuinely matters: 10–15bb jam-or-fold.** No postflop to recover EV, ranges are sharp, a hand one notch off the line flips from clear jam to clear fold. That's the regime worth memorising exactly.

**Why drill boundary hands anyway:** low EV per decision, high *information* per decision. Being dealt AA and 72o tests nothing. The boundary is where a trainer can measure whether you know the range at all.

---

## 2. Postflop framework (flop and turn)

The two-stage split that resolves "is this a hand decision or a range decision":

### Stage 1 — the board picks the size

Done *before* looking at your cards. Same for every hand in your range.

| Board | Example | Shape | Why |
|---|---|---|---|
| Dry high-card, yours | A72r, K83r | 33%, ~80% freq | You own the Ax/Kx. Nothing to protect against |
| Wet high-card, yours | A♠J♠8♦, K♥Q♥4♣ | 75%, ~55% freq | Real draws out there. Polarize |
| Middling connected, theirs | 865, T97, 776 | Check 60%+ | They have the straights and two pairs |
| Paired | K72-2, 995 | 33%, high freq | Nobody connected. Small bet takes it |
| Monotone | ♠♠♠ | Check often, small when betting | Ranges compress; nut advantage is everything |

> "C-bet 50%" is a useless average. Real frequencies run ~90% on A72r and ~25% on T97. The mean is correct nowhere.

### Stage 2 — the hand picks the frequency

One question: **does a fold help me or hurt me?**

| Hand class | A fold is… | Action |
|---|---|---|
| Strong + vulnerable (TPGK wet, overpair) | **Good** — real equity denied | Bet nearly always |
| Strong + invulnerable (set on A72r) | **Bad** — you wanted the money in | Bet small, or check some |
| Draw (8–15 outs) | **Great** — 35% became 100% | Bet often |
| Air with backdoors | The only way you win | Bet at balancing frequency |
| Air, no backdoors, no blockers | Irrelevant | Check. Worst bluff candidate |

### The "they folded and I'm sad" fix

That feeling is right on **dry** boards, wrong on **wet** ones.

- **A72r with AA:** they have ~2 outs. A fold genuinely costs you → bet small to buy calls.
- **K♥Q♥4♣ with KK:** they fold a flush draw with ~35% equity. That's a *successful* value bet.

**Protection and value are the same bet.** Score the outcome by whether money went in ahead or equity got denied — not by whether they called.

**Sizing mechanism, one line:** nothing to deny → bet small, maximize calls. Lots to deny → bet big, folds are fine.

**Flop bluffs do not fold out better made hands.** As the PFA your flop bluffs fold out *equity* — overcards, gutshots, backdoors. Folding out better hands is a turn/river, big-bet concept. Drop it from flop thinking.

### Turn — one question

**Did the card change who owns the board?**

- Favors you (brings your nuts, bricks their draws) → keep firing, often bigger
- Favors them (completes draws, hits their calling range) → check more, including some strong hands
- Blank → the flop plan continues

### The vision

**Plan to the river before you bet the flop.** Ask: *if I bet flop and turn, what's my river bet and what am I repping?*

Betting three streets on A♠J♠8♦ reps Ax+ and the flush — do I have enough of those? KQ with a flush draw: bet flop, bet turn, river is either the flush (value) or a bluff with the A♠ blocker.

Deciding the whole line on the flop is what makes the flop size obvious instead of agonising.

---

## 3. Playing out of position as the BB caller

### Donk betting

Mostly don't. "Check to the preflop aggressor" beats "my range connects."

**Range advantage ≠ nut advantage.** The worked case, BB with A3o on **T-6-5**:

| | BB caller | PFR |
|---|---|---|
| 5x, 6x, 65, 54 | more combos | few |
| Tx | T9s maybe | AT, KT, QT, JT, TT |
| Overpairs JJ+ | mostly 3-bet preflop | all of them |
| Range cap | yes | no |

You have the *connected* half; they have the *top* plus an uncapped range. The ten is what kills the donk case — on **6-5-4** the argument would be much stronger.

Solvers do donk here at ~5–15% with sets, two pair and some draws. Ignore it: the EV is a fraction of a bb and a badly built donk range loses more than the good one gains.

### What A3o on T65 is actually worth

| Component | Worth |
|---|---|
| Ace-high showdown value | Thin — beats KQ/KJ/QJ that gave up |
| 3 outs to top pair | ~12% by river, and it's a bad top pair (3 kicker) |
| Backdoor wheel (needs 2 *and* 4) | ~0 |
| Ace blocker | **Works against you on the flop** — see below |

**It's mostly a fold.** Decision is price:

- vs 33% c-bet (need 25%): thin call, and it's the price calling, not the hand
- vs 75% c-bet (need 30%): fold
- Turn barrel: fold unless improved. Never calling three streets

**Suits change everything.** A♠3♥ on T♠6♠5♦ is a backdoor-nut-flush hand — clear continue and a live check-raise candidate. A♥3♦ on the same board is air with a blocker problem. Same "A3o," two different hands.

### Check-raising — correct and underused

Build it from hands with equity when called:

- **Sets:** 55, 66
- **Two pair:** 65s, T6s, T5s
- **Straight draws:** 87, 97, 89, 44, 34s, 74s
- **Combo draws:** 87 with a flush draw — the best ones
- **Some Tx** for value and protection

A3o fails twice: 3 outs when called, and the blocker points the wrong way.

Texture calibration:

| Board | BB check-raise freq | Why |
|---|---|---|
| 6-5-4, 8-7-6 | ~20%+ | You have all the straights and sets; they have none |
| T-6-5 | ~10–15% | The ten gives them AT/KT/QT/JT/TT plus overpairs |
| A-K-4, K-Q-7 | Low | Their board — check and defend |

---

## 4. Blockers

**The rule:** hold cards that are in their *calling* hands, not their *folding* hands.

Your skepticism ("I block their good hands and their bad hands, it washes out") is **correct whenever their range is wide.** On the flop, against 60 combos of continues, removing 3 changes nothing. Blockers concentrate on rivers where ranges are narrow and the call/fold boundary is sharp.

### Examples, increasing sharpness

1. **A-high board, bluffing with an ace.** Board A-9-5-2-J. Their call = Ax. You hold A♦4♦ — can't win at showdown, blocks a chunk of the only hands that call.
2. **Straight board.** Board 9-8-7-2-6. Their call = any T or 5. Holding a T means fewer straights for them.
3. **Paired board.** Board K-K-7-3-2. Their call = Kx and 77. You hold a 7 → 77 goes from 3 combos to 1.
4. **The asymmetry case** — the one to internalise:

Board **Q♥ 7♥ 3♦ 8♠ 2♣**. Flush draw bricked. Their range splits into Qx (calls) and missed hearts (folds).

| Your hand | Showdown value | Blocks their calls | Blocks their folds | Verdict |
|---|---|---|---|---|
| A♥K♥ | none | no | **yes — badly** | Bad bluff |
| A♦K♦ | none | no | no | Good bluff |

Identical by strength. One removes the exact hands you're trying to make fold.

### Direction flips by street

- **Flop, T65:** their c-bet folds are AK/AQ/AJ → holding an ace makes them fold *less*. Bad bluff blocker.
- **River, Ax board:** their calls are Ax → holding an ace is a great bluff blocker.

Same card, inverted value, because the range composition changed.

### Where blockers don't matter

Flops, multiway pots, wide calling ranges, and value betting (you want the call — blockers barely register).

---

## 5. Bluffing structure

### Street determines the logic

| Street | Cards to come | Selection | Why |
|---|---|---|---|
| Flop | 2 | Draws, backdoors | Two ways to win. Surplus of candidates, so you don't need air |
| Turn | 1 | Draws + blockers | Transition |
| River | 0 | Blockers only | Nothing to improve to. Every bet is a pure bluff |

Flop "pure bluffs" in solver output are usually not literal zero equity — they're backdoor flush + backdoor straight hands around 4–6%. That equity buys turn playability.

### Yes, you can bet total air — range betting

Betting ~100% of your range for a small size (25–33%) on boards that overwhelmingly favor you. As PFR: **A72r, K83r, A-high dry generally.** On A72r you bet 33% with everything including 54o.

**Terminology:** range betting is *small and high-frequency*. Polarized betting is *large and low-frequency*. Two different strategies — don't compress them into one phrase.

### Frequency math

Bluffs as a share of your betting range, to make a caller indifferent (= `s / (1 + 2s)` where s is bet as a fraction of pot):

| Your bet | Bluff % | Ratio |
|---|---|---|
| ½ pot | 25% | 1 bluff : 3 value |
| ¾ pot | 30% | ~1 : 2.3 |
| Pot | 33% | 1 : 2 |
| 2x pot | 40% | 1 : 1.5 |

Bigger bets support more bluffs. Most players' overbets are pure value and instantly readable.

### River bluff filters, in order

1. **No showdown value.** Turning a winner into a bluff is the most expensive bluffing error.
2. **Blockers pointing the right way.** On a flush board, the A of the suit is canonical.

---

## 6. Sizing

**Build from the value side, always:**

1. Do I have enough nutted hands to want a big size?
2. If yes → how many bluffs does that support?
3. If no → there is no big size, for value *or* bluffs

**The gate is nut advantage.** You can only overbet where your range holds hands theirs can't beat. A-K-5-2-8 as PFR: you have AK, AA, KK, A5s; a BB caller has almost no two-pair+. Symmetric boards don't qualify no matter how much you want to fire.

### The three-size tree

- **33%** — range bets on boards that fit you
- **75%** — standard value and semi-bluffs
- **150%** — rivers only, nut advantage only, mostly value against weak players

### 200% (2x pot) — river only

**Precondition:** they need 40% equity to call, so their calling range is narrow and strong. The size only works when they hold a strong *second-best* hand. If their range is air they just fold and you win nothing extra.

**Trigger:** the river gave you something they can't have, and they have an obvious strong hand they can't fold.

**Value:**
- Nuts and near-nuts only
- Flush when the river completes it and they have top two / set
- Boat when the board pairs and they have the flush
- Straight when it completes and they've been betting top pair
- Top set on a dry runout where they've repped an overpair

**Bluffs (~40% in theory):**
- Zero showdown value
- Block their calls hard: the A of the flush suit, the straight-making card
- Unblock their folds

**Skip it when:** ranges are symmetric, board is wet enough that they have nuts too, or multiway.

### The amateur adjustment

The 40%-bluffs-at-2x figure assumes a caller who folds correctly. Against a station it nearly inverts:

| Opponent | Bluff share at 1.5x pot |
|---|---|
| Solid reg | ~35–40% |
| Typical amateur | ~10% |
| Calling station | ~0% |

And the value side moves the *other* way — against a station you value bet **thinner and bigger**. Top pair good kicker for 1.5x pot against someone who can't fold is among the highest-EV bets available.

**Not having a large size in the tree costs more in lost value than it saves in bluff EV.**

---

## 7. Preflop — 3-bet vs cold call

### The decision is about them, not your hand

| Situation | Do |
|---|---|
| Blinds are competent | **3-bet.** Isolation is worth real money |
| Blinds are also bad | **Flat.** Three-way IP vs two bad players is fine |
| Blinds squeeze a lot | Tighten flats — that's the tax on cold calling |
| Weak opener folds to 3-bets | **Flat.** 3-betting wins 4bb and ends the hand you wanted |
| Weak opener calls 3-bets wide | **3-bet linear** — value-heavy, few bluffs |

**Against a weak opener, 3-bet merged, not polarized.** Adding bluff 3-bets folds out the wide range you wanted to farm and gets you called by the top of theirs.

- **vs strong opener:** polarized — premiums + A5s-type bluffs, flat the middle
- **vs weak opener:** merged — QQ+, AK, AQs *plus* JJ, TT, AQo, AJs, KQs promoted to value

### Widening to reach the good spot

BTN flat vs a weak HJ can go from ~12–15% to **20–25%**, and all of the addition should be suited:

| Add | Don't add |
|---|---|
| Suited aces (A2s–A9s) | K9o, Q9o, J9o |
| Pocket pairs, all | Weak offsuit aces |
| Suited connectors to 54s | ATo, KJo unless blinds are passive |
| Suited gappers: 86s, 97s, T8s | Anything offsuit and disconnected |

Test: **does this hand survive going multiway?** You won't reliably get the clean isolated pot — BB is priced in and comes along often. Suited/connected hands make nuts and have implied odds. Offsuit broadways need heads-up IP and are dominated by the part of a weak range that continues.

Small pairs go *up* in value against fish more than any other class — set-mining wants ~15:1 implied odds and someone who can't fold top pair gives far better.

### How far to go for position

**Not far.** Position adds maybe 5–10% to equity realization — enough to add suited connectors and suited aces to a flatting range, never enough to justify a hand you'd otherwise fold. If "but I'd be in position" is the main argument for a call, it's a fold.

### My 3-bet range — the correction

AA, KK, QQ, JJ, AKs, AQs = 24 pair combos + 8 suited = **32 combos = 2.4%**.
Typical BTN vs CO 3-bet frequency: **~10%**.

I'm at roughly a quarter of standard, and missing AKo, which is a clear 3-bet. The feeling of "I 3-bet a lot" comes from taking those hands 100% of the time — the range underneath is tiny.

**Keep the "AA can get beat" instinct.** Approximate equities:

| AA vs | Equity |
|---|---|
| 1 opponent | ~85% |
| 2 | ~73% |
| 3 | ~64% |
| 4 | ~56% |

Converting a four-way 56% pot into a heads-up 85% pot is exactly what the 3-bet buys. Don't flat premiums to trap against weak fields — they call too much for trapping to be worth it.

**What to add:**
- vs weak players: TT, 99, AJs, KQs, AQo, AKo (pure value extension)
- vs regs: A5s, A4s, KJs, QJs (blocker bluffs)

### BTN vs HJ open, 50bb, chipEV

Assume HJ opens ~17% at 2.2–2.3x.

- **3-bet ~8%:** QQ+, AK, AQs, JJ mostly. Bluffs A5s–A3s, some KJs/QJs
- **Flat ~13–16%:**

| Class | Hands |
|---|---|
| Pairs | 22–TT (TT mixes, 99 and below pure flat) |
| Suited broadway | AJs, ATs, KQs, KJs, KTs, QJs, QTs, JTs |
| Mid suited aces | A9s–A6s |
| Suited connectors | T9s, 98s, 87s, 76s, 65s (54s low freq at this depth) |
| Suited gappers | J9s, T8s, 97s — lower frequency |
| Offsuit | AJo, KQo, the flatting half of AQo |

Total defend ≈ 21%.

### What changes 100bb → 50bb

| | 100bb | 50bb |
|---|---|---|
| Flat % | ~15–18% | ~13–16% |
| 22–55 | Pure flat | Still flat, thinner |
| 54s, 43s | Flat | Drop or low frequency |
| JJ/TT | More flatting | More 3-betting |
| A5s–A2s | Mixed | More 3-bet |

Mechanism is SPR: less room to maneuver, so implied-odds hands lose a little and raw-equity hands gain. **Flatting is completely standard at 50bb** — it doesn't collapse until ~25bb, where post-call SPR drops to ~4 and you can't play three streets. ICM accelerates that.

**Antes widen everything** — tournament pots are bigger preflop, so the price improves and ranges run a couple of points wider.

---

## 8. Priorities and exploit calibration

### Top 3 for a tournament

1. **Big-pot discipline.** 3–8 hands decide the tournament, all 50bb+ pots. Amateurs underbluff — when an unknown fires big on the turn or river, they have it. Don't fire three barrels without the nuts or a real blocker story.
2. **Stack-depth correctness, especially 15–25bb.** At 20bb it's mostly jam-or-fold, not open-2.2x-and-guess. The 10bb jam ranges are memorisable and that's where the exact boundary pays.
3. **Pick your targets.** Isolate the weak player, attack the tight player's blinds, stay out of the good aggressive player's way. The frame is *who*, not *how often*.

Blind stealing is a distant 4th. Rough scale on a 30bb stack: aggressive stealing over 3 orbits nets +3 to 5bb; one 25bb bluff into someone who can't fold is –25bb and terminal. ~6x in chips, worse in tournament equity.

### What to demote

| Idea | Verdict |
|---|---|
| Check to the PFA | **Keep.** Load-bearing |
| Isolate in position | **Keep.** |
| Polarized = big | Keep, but it's a sizing detail |
| "C-bet ~50%" | Decoration. *Which* hands matters far more than frequency |
| Play the range not the hand | Right idea — but use *their* actual range, not the chart's |

**On "play the range":** GTO range thinking assumes a GTO range opposite. When an amateur cold-calls UTG and then check-raises the turn, their range is two-pair-plus, not the chart's.

### Exploit calibration

- **Scale deviation to read confidence.** Unsure → GTO. GTO's value is being safe when you don't know.
- **Noobs don't adjust.** Don't plan around an image they won't form. Deliberate advertising pays a certain cost now for a benefit requiring an opponent who both notices and adapts.
- If a bad player does form a crude "he's aggressive" read, it usually resolves into calling wider — good for your value bets, not something to engineer.

### Late in a big tournament

The fish are gone; it becomes a fairly GTO-flavoured game with heavy ICM overlays. Cold calling largely disappears (stack depth + squeeze risk), it's raise-or-fold and 3-bet-or-fold, and the reads that matter are stack-shaped — who's covered, who's ICM-pressured — rather than skill-shaped.
