# Plan — hand-history coach skill

A local archive of GGPoker exports that grows as tournaments are played, a
script that answers questions about it, and a thin skill that lets an agent
read the answers and coach from them.

Deliberately small. Phase 1 is roughly a day and a half and ships five things
that work at today's volume. Phase 2 is the label machinery, which needs more
hands than exist yet and is specified here so it can be built later without
redesigning anything.

---

## 1. Spec

1. **`hands/` at the repo root, gitignored**, read recursively every run, the
   default target when no path is given. The archive is the asset — it
   compounds whether or not anything is built on it.
2. **A date window selects what is reported on**, never what is parsed.
   `--from` / `--to`, inclusive, either usable alone.
3. **Code computes every number.** The agent never counts.
4. **The agent never reads `hands/` directly.** The payload is the only input.
5. **Villain hole cards never reach the agent.** `shows[]` stays out.
6. **Board and action line truncate at Hero's last action.**
7. **Findings append to `leaks-log.md`**, gitignored, plus a short chat summary.
8. **One smoke check, no test suite.** A full end-to-end test is its own
   follow-up plan.
9. ~500 hands across 5 tournaments today, growing slowly.

---

## 2. Phase 1 — what gets built now

### Step 0 — module resolution and one smoke check

`node --experimental-strip-types` is ESM and needs file extensions.
`classify.ts:23`, `ranges.ts:62`, `hands.ts:18`, `boundary.ts:19` and `:27`
import values without one, and `import('src/lib/preflop/ranges.ts')` throws
`ERR_MODULE_NOT_FOUND` today. Adding `.ts` to those five sites is verified
sufficient. It also fixes `npm run build`, which will reject the same imports
once the CLI graph pulls those modules in — `npm run typecheck` uses
`moduleResolution: bundler` and never shows it.

Then **one** smoke check, `scripts/smoke.ts` with exit codes: run the CLI end
to end and assert the window filters in both directions, that a raise buckets
correctly, and that argv survives its flags. Needs a real fixture file — the
hand in `parse.test.ts:19` is a template literal inside a test, so extract
`src/lib/hh/fixtures/*.txt` with at least two hands, two dates and two
tournaments. Every bug below fails *silently*; nothing else would catch them.

### Step 1 — archive, window, and the CLI fixes

The compounding asset, and where four verified bugs live.

- **Recursive walk.** `collect()` (`leaks.ts:17`) is not, so per-tournament
  subfolders vanish with no warning. `hands/` is the default target;
  `leaks.ts:32` currently exits 1 with no path.
- **Rewrite argv.** `leaks.ts:28` exempts only `--out`'s value, so
  `--mode pots --from 2026-09-01` puts `pots` and the date into `targets` and
  `statSync` throws ENOENT. Verified.
- **Normalise the date.** `Hand.timestamp` is `2026/09/08 20:03:09` — slashes.
  Against `YYYY-MM-DD`, `--to` silently returns nothing and `--from` silently
  returns everything. Verified. Add
  `handDate = timestamp.slice(0,10).replaceAll('/','-')`, record the export's
  timezone in `meta`, exit 1 on a malformed date or `from > to`.
- **Dedupe by hand id.** `Hand` keeps no raw text, so "compare the text" is
  unbuildable — compare a structural key (`id + totalPot + actions.length`) or
  add `raw` to `Hand`. Decide here; it forks `parse.ts`.
- **Exclude pot-check failures and no-hero hands from every denominator**, not
  merely warn. In an accumulating archive that garbage is permanent.

Types, introduced here rather than later because `lines.ts` and every renderer
need the `Hand` that `heroHand()` (`hero.ts`) discards:

```ts
interface HandRecord { hand: Hand; hero: HeroHand; file: string; handDate: string }
readArchive(paths: string[]): { records: HandRecord[]; meta: ArchiveMeta; excluded: Excluded[] }
selectWindow(recs: HandRecord[], from?: string, to?: string): { records: HandRecord[]; window: WindowMeta }
```

`meta` carries **both** spans, always, explicitly labelled:
`meta.archive {files, hands, excluded, first, last}` and
`meta.window {requestedFrom, requestedTo, first, last, hands, decisions}`. Only
`meta.window` may be described. The window applies to every mode including
`leaks`, which changes the contract `leak-coaching.md:17` pins — update that
file in this step. `leaks.ts:59` also takes `gameName` from `hands[0]`; a
multi-tournament archive has no single game, so make it a list.

### Step 2 — `--mode pots`

Top 20 by Hero's gross chips in, **measured in bb** — across a window spanning
levels, raw chips sort by blind size. Gross is
`invested + (uncalled.player === hero ? uncalled.amount : 0)`, because
`parse.ts:274` subtracts an uncalled bet and would otherwise rank a river
bluff that got through below the same bluff called.

Reuses `handDetail` (`report.ts:149`). Money is visible here; that is the mode.

### Step 3 — board type, and the c-bet stats split by it

The highest value per line of code in the plan, and it needs no cards — board
type is computed before looking at your hand.

```
dry-high-mine / wet-high-mine / middling-theirs / paired / monotone
```

A rank-and-suit scan, ~50 lines. Then split `cbetFlop`, `cbetTurn` and
`foldToCbetFlop` by it. This closes the one real gap in the existing report:
a single c-bet percentage averages ~90% on A-7-2r with ~25% on T-9-7 and is
correct at neither.

Honest caveat to write into the output: that is ~7 c-bets per bucket per
session, so most buckets stay under their minimum for a long time. The split
is still right — it stops the aggregate from being actively misleading.

### Step 4 — RFI fold check

Fires at n=1, so it is the one component with no sample problem at all. Three
things must exist first, and two of them are outright blockers today.

- **`chartPosition(label): Position | null`.** `POSITIONS` (`ranges.ts:66`) is
  UTG…BTN with no blinds, so `isOpen('SB', …)` throws on `undefined.has` —
  verified — and `firstInOpp` (`hero.ts:228`) is true in the SB. Return null
  for SB, BB and heads-up `SB/BTN`, clamp `UTG3+` to `UTG`, skip on null.
  Short tables need no special handling: `positionNames` already labels by
  distance from the button, so 6-max LJ is 9-max LJ.
- **`depthFor(stackBB): Depth`** — `>= 40 deep`, `>= 15 mid`, `< 15 short`.
  Nothing in `src` maps stack to depth today. The `short` tier is a **jam**
  chart (`ranges.ts:131`), so at 12bb the finding reads "not a jam", not "not
  an open". The 28–45bb band has no chart of its own; say so in the output.
- **`toleranceBand(pos, depth): ReadonlySet<HandClass>`** —
  `ceil(0.03 * rangeComboCount(pos, depth))` combos accumulated from the
  weakest in-range class upward, ordered offsuit → suited → pairs and
  ascending `strengthRank` within family. Empty below 15bb. A flat "~40
  combos" is 19% of UTG-deep and 6% of BTN, which forgives an arbitrary set.

Only folds strictly above the band are flagged. Folding behind limpers is not
an RFI spot and is skipped.

Write the carve-out down: `leak-coaching.md:41` forbids coaching opening
ranges. RFI *folds* are in scope; RFI *frequency* is not.

### Step 5 — the skill

```
.claude/skills/hand-review/SKILL.md     ~30 lines
```

Run `leaks`, then `pots`, read `docs/leak-coaching.md`, at most three
findings. Hard rules: never read `hands/`; never state a number absent from
the payload; only `meta.window` may be described; **fewer than three findings
is a correct output**. Shells out to `npm run leaks` and vendors nothing.

### CLI surface after phase 1

```
npm run leaks -- [paths]  --mode leaks|pots      # leaks is the default
                          --from / --to YYYY-MM-DD
                          --json --out FILE      # both already exist
```

---

## 3. Labels — built

This was "phase 2, when there are hands to count". It is built, and the
counting is gone: what follows records what exists and why, not what to do
next. Three of its claims turned out to be wrong and are corrected in place,
marked **[corrected]**.

### Labels describe, they do not accuse

An earlier draft made a label *be* a mistake — prescription versus action, tag
fires on mismatch. Review killed it: under that model three of five labels fire
on plays that are correct. Betting 33% with air on a board that fits your range
is range betting. Checking a nut flush draw on a monotone flop is standard.
A 150% river overbet with nut advantage is the recommended line.

So a label states a fact — `check-draw`, `overbet-strong`,
`river-bluff-with-blocker` — and **the agent decides which instances were
wrong**. A decision carries a *set* of labels, not one.

**[corrected]** This paragraph named `overbet-with-nuts` and
`river-bluff-blocks-folds`. Neither shipped. `strong` admits an overpair and
top pair with a Q kicker, which are not the nuts, and a label may not assert
something nothing computed. `blocks-folds` is a claim about which of their
hands would fold — a range claim, which the rule immediately below forbids.

### Axes

| Axis | Values |
|---|---|
| Hand class | `strong / marginal-made / draw / air` |
| Board type | the five from step 3 |
| Action | `check / bet-33 / bet-75 / bet-150 / bet-200`, or `fold / call / raise` when facing |
| Removals | see below |

`strong` = two pair or better using a hole card, an overpair, or top pair with
a Q+ kicker. `marginal-made` = any other pair, or playing the board. `draw` =
eight or more outs — a four-out gutshot is not a draw, though `classify.ts`
calls one. `air` = the rest.

**Sizing numerator differs by action kind.** `Action.to` is documented "raises
only" (`parse.ts:51`), so reading it for a bet yields NaN, and for a raise it
includes the call and inflates every bucket — a raise to 300 over a 100 bet
into 100 reads 1.00 instead of 0.67. Bets use `amount / potBefore`; raises use
`raiseBy / (potBefore + toCall)`. `raiseBy` (`parse.ts:305`) is exactly the
increment. All-in and near-all-in decisions carry labels but leave the sizing
denominators.

### Removals — board-derived, no villain range

What can the board make, and does Hero hold one of those cards? That is all.

```
3+ of a suit on board      → holding that suit removes flushes
                             holding its ace removes the nut flush
3 of 5 ranks in a window    → the two missing ranks are the removals
a paired board rank         → holding that rank removes the boats
highest board card          → holding it removes top pair
```

`removals(hole, board): Removal[]` — about forty lines, no range modelling,
nothing new in the repo needed. It is what lets a river bluff be split into
`river-bluff-with-blocker` and `river-bluff-no-blocker`.

**[corrected]** This claimed removals make `river-bluff-blocks-calls` and
`river-bluff-blocks-folds` sayable. They do not: which hands call and which
fold is a property of a range, and this design has none. What a board-derived
removal can say is that Hero holds a card the board could have used — the
direction is the agent's to argue.

**This section used to cite §4 of the strategy notes as its worked example. It
cannot be.** That board is Q♥-7♥-3♦-8♠-2♣ — *two* hearts, the draw bricked, so
no flush is makeable and not one of the four rules above fires. A♥K♥ and A♦K♦
both return `[]`, correctly. The asymmetry §4 describes comes from villain
holding busted heart draws, which is range modelling, which this design
forbids outright.

That is a limit to state plainly rather than paper over: **board-derived
removals go quiet exactly where §4 says blockers matter most** — a bricked
draw on the river, where the call/fold boundary is sharp. Give the same board
a third heart and the machinery works as intended: A♥K♥ yields two removals,
A♦K♦ none, same strength and opposite meaning, with the direction left to the
agent. `read.test.ts` pins both the working case and the silence, so the
silence reads as a decision and not as a bug.

### Grouping, not counting

**[corrected]** An earlier draft counted: rate, Wilson interval, a `spread` to separate a
tendency from noise. All of it is deleted. **A leak is not a sampling
question.** Folding AJo from the cutoff once might be a misclick, the clock,
or a read the history does not record; folding it fifteen times is a rule
being carried around. Neither reading comes from a confidence interval, and
waiting for one means waiting for thousands of hands to say something the
third instance already said.

What separates a misunderstanding from an accident is not how many times it
happened but **whether the instances look alike**. AJo from the CO at 50bb,
ATo from the CO at 47bb and AJo from the HJ at 52bb are one misunderstanding
with three instances — too tight with offsuit aces in late position at mid
stack. A chart fold and a river overbet are two unrelated events, and calling
them "2 mistakes" says nothing.

So a label carries its instances and what they share:

```ts
interface LabelGroup {
  label: string;
  decisions: Decision[];          // every instance, not a count of them
  shared: Partial<Record<'position' | 'depth' | 'handClass' | 'boardType', string>>;
}
```

`shared` holds only the facets on which every instance agrees — that is the
finding, and it is sayable at n=2. The agent reads the instances and decides
which were wrong; the code never decides that, because a label describes and
does not accuse.

No rate, no denominator, no `minN`, no `thin`. Frequencies live in `stats[]`,
which is a commodity every tracker ships and is not what this tool is for.

### What exists

| | |
|---|---|
| `src/lib/read.ts` | hand class and removals |
| `src/lib/hh/decisions.ts` | one record per voluntary Hero action, with sizing |
| `src/lib/hh/labels.ts` | the six labels, and grouping by shared facets |
| `--label <name>` | one label, un-strided — every instance, not a sample of five |

`--mode blind` was **not built and will not be.** The main path is already
blind: the result fields were deleted from the payload outright rather than
filtered out by a second renderer, so there is no unblinded version left to
guard against. `--mode pots` stays as the one place results are visible, for a
human asking where the chips went.

`--exemplars N` was **not built either.** The stride it describes is applied
unconditionally at five per group, with `stride` and the true `instances`
count in the payload. A flag to tune N is a knob nobody has needed, and
`--label` covers the case that motivated it.

### Still open

- **`src/lib/hh/lines.ts`**, the compact action notation. Deferred rather than
  dropped: the payload already hands the agent structured decisions with
  sizing, SPR, texture and board, so a notation string would be a second and
  lossier view of the same facts. Build it only if the agent turns out to
  reason better from `x/b33/c` than from the fields.
- **The vocabulary is a guess.** Six labels chosen against fixtures. Which of
  them fire, and which spots go unnamed, is the first thing a real archive
  will say.
- **`vulnerable`** stays deferred (§4) — it needs opponents-in and SPR to be
  trustworthy and it feeds only labels.

---

## 4. Coaching harness — locked decisions (next build)

Settled in design review. Rationale, the 8-agent exploration and the unanimous
5-judge carving panel live in `research/coaching-harness-design.md`,
`research/coaching-transcripts/synthesis.md` and the transcript notes. Nothing
here is implemented yet. Where this conflicts with earlier text in this file,
this section wins — flagged inline.

### Label set — nine facts, no new label

Section 3 shipped six; three more were mined from the coaching corpus, one
proposed label was rejected:

| Label | Fact |
|---|---|
| `pfa-check-flop` | PFR checked the flop (not a check-raise) |
| `check-draw` | checked holding 8+ outs |
| `donk-bet` | caller led into the PFR on the flop |
| `check-raise-flop` | caller check-raised the flop |
| `overbet-strong` | bet/raise larger than the pot with `strong` |
| `river-bluff-with-blocker` | river bet, air, holds a board-relevant card |
| `river-bluff-no-blocker` | river bet, air, holds none |
| `river-call-marginal` | called a river bet with a marginal made hand |
| `river-check-value` | checked the river through with a made hand (missed value) |

**No `missed-ip-stab`.** "Missed" is a verdict needing a range read — the agent's
job, not the parser's. IP passivity as the PFR is already carried by
`pfa-check-flop` + the `position` facet. The caller stab-back (villain checks to
you in position, you check behind, `pfa==false`) is the one uncovered spot;
**parked** as a future fact label (`check-back-flop-ip`) only if a real archive
shows it earns one.

### Families — four, spot-based (unanimous 5-judge panel)

Families are the **teaching container** — one corpus-synthesised brief each — not
the unit of priority.

| Family | Labels |
|---|---|
| PFR flop passivity | `pfa-check-flop`, `check-draw` |
| Caller aggression | `donk-bet`, `check-raise-flop` |
| River bluffing | `river-bluff-with-blocker`, `river-bluff-no-blocker` |
| River value / bluff-catch | `river-call-marginal`, `river-check-value`, `overbet-strong` |

Carved by decision-type/spot, not by coaching lens: `focus_order` is a checklist
every spot runs (range advantage → sizing → SPR → texture → blockers), so the
lenses cross-cut and cannot partition; coaches cluster their teaching by
role + street.

### Priority — per-label, base × evidence

**Labels are the first-class unit.** A session ranks what to coach by
`base-priority × evidence`, computed by the harness (never the model); empty
labels drop out.

- **base-priority** is a per-label number. Aggression is *one input*, not an axis:
  the target player is an amateur who skews passive, so the missed-aggression
  labels (`pfa-check-flop`, `check-draw`, `river-check-value`) score higher than
  the defensive `river-call-marginal`. No position multiplier — position is a
  facet `shared`/`dominantCell` already surface. Numbers drawn from the two
  small-stakes videos (`lSvyX-Ryi0M`, `4wGRlpNxDBs`), **not** from corpus-
  prominence (which over-weights high-stakes river precision).
- **evidence** is pattern strength in the player's own data (`dominantCell`,
  `shared`), never a rate.
- A family's session-relevance = max over its labels of (base × evidence); it
  surfaces on its strongest label and the brief foregrounds it.
- Aggression *detection* stays deterministic: `stats[]` bands already flag
  `cbetFlop`/`cbetTurn`/`aggFreq`/`threeBet` as `missed` with no model. That layer
  says "too passive"; the family and brief say where and how to fix it.

### Harness layers

1. **L0 — per-family coaching briefs synthesised from the corpus.** Reorganise
   the transcript notes by label/family (not by video), each claim cited
   `{video, ts}` + strategy-notes. Loaded on demand — the skill reads only the
   briefs for labels that appeared. Subsumes the "reference-line" idea.
2. **Enrichment (deterministic).** Attach `requiredEquity`/`alpha`/`mdf`/
   `sprCommitment`/`boardFavoursPfa` per decision, plus `dominantCell`. The model
   reads numbers; it never does the arithmetic a weak model botches.
3. **Verification batteries.** Per-label closed questions answered from named
   fields; the argument stays free prose — do not template the reasoning.
4. **Scenario packets — group-level, family-bundled, built later.** One packet
   per finding carrying the whole label group, baseline + texture-split inlined,
   pre-ranked. Sequenced after enrichment exists.
5. **Docs reframe.** Rewrite `leak-coaching.md` positively; **cut "at most three
   findings" → a quality gate** (argue what you can; fewer or more is fine), cut
   "always close MINDSET-ONELEAK" → conditional, cut MINDSET-PROCESS; add a
   conditional drill loop ("play ~200 hands on the one thing, re-run with
   `--label`, did it move?"). Keep the load-bearing invariants as positives
   (results-blind, label-is-a-fact, no villain cards, thin-stat, window-not-archive).

**Supersedes in this file:** step 5's "at most three findings / fewer than three
is a correct output" is replaced by the quality gate above.

### The judgment seam — one port, swappable

The model is a dependency, not the design. Everything it touches sits behind a
single thin port, so Jev, an LLM, a solver, or a stub are interchangeable and the
harness never knows which answered. This is what "model-agnostic" above actually
costs, spelled out. Three rules keep the seam small:

- **The primitives are ours, not a vendor's.** `choice` / `score` / `noul` are
  repo types. Jev speaks them natively; an LLM adapter renders them to a JSON
  schema; a solver could answer some deterministically. The primitive is the
  abstraction, and any one backend is just an implementation of it.
- **The port is one call** — `evaluate(state, questions) → answers`, `state`
  derived from a `LabelledDecision` and nothing else, `answers` carrying
  `choice|score|noul` + `confidence`. Layer 3's verification batteries are its
  only caller. Selection is config (`JUDGE=jev|llm|none`), never a code change.
- **Nothing checkable crosses it.** Enrichment arithmetic stays in Layer 2,
  priority stays `base × evidence` in the harness, labels stay facts. The model
  produces verdicts on already-true facts and nothing else — which is what makes
  it both swappable *and removable*: pull the judge and the deterministic spine
  still stands.

`scripts/probe-typesafe.ts` is the throwaway that proved two adapters (Jev,
Gemini) satisfy one seam against the real archive; the signatures live there
until they earn a place in `src`.

### Still open

- The per-label base-priority numbers — a small hand-set table drawn from the two
  small-stakes videos.
- Build order across the five layers.
- The `Judge` port's exact type signatures — sketched in the probe, not yet
  lifted into `src`.
- `check-back-flop-ip` — parked; add only on evidence from a real archive.

---

## 5. Deferred indefinitely

- A large end-to-end test — its own follow-up plan.
- Blind defense, 3-bet and cold-call charts. `ranges.ts` is RFI-only.
- `vulnerable` as a computed facet. It needs opponents-in, SPR, counterfeiting
  and redraws to be trustworthy, and it feeds only labels.
- Conditional slicing across facets. Needs thousands of hands.
- Comparing two windows over time.
- Subagent fan-out.
- Feeding found leaks into the trainers' drill weighting. This is the only
  thing that would close the loop between the report and the app, and it is
  worth more than most of phase 2.
