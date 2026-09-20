# Plan — hand-history coach skill

A local archive of GGPoker exports, a script that labels every decision
descriptively, and an agent that reads cohorts of labelled hands and judges
what went wrong. Ships as a Claude Code skill.

---

## 0. The central decision: labels describe, they do not accuse

An earlier draft made a label *be* a mistake — prescription versus action, tag
fires on mismatch. Two reviews killed it with the same finding: under that
model three of five tags fire on the plays `strategy-notes.md` explicitly
prescribes. Betting 33% with 54o on A-7-2r is range betting (§5). Checking a
nut flush draw on a monotone flop is what §2 says to do. Overbetting 150% on
the river with nut advantage is §6's recommendation. A tagger that calls those
mistakes is not a coach, it is a noise generator.

So a label states a fact about a decision:

```
river-bluff-with-blocker      you bluffed the river holding the A of the flush suit
overbet-with-nuts             you bet over pot with a hand nothing beats
check-strong-vulnerable       you checked a strong hand on a draw-heavy board
range-bet-air                 you bet 33% with air on a board that favours you
```

None of those is an accusation. Some are good play. **The agent decides which
are wrong, in context.** That is the division the whole design rests on: code
states what happened and how often, the agent says what it means.

Two consequences:

- **Counts are frequencies, not error rates.** `overbet-with-nuts: 9` means
  you did it nine times, not that you erred nine times.
- **The prescription survives as a facet.** Every postflop decision still
  carries `prescribed: ok | off | n-a` computed from `strategy-notes.md` §2,
  both stages, gated on being the preflop aggressor. It is evidence the agent
  weighs, not the label's identity — which is why the stage-1 board gate being
  imperfect is now tolerable rather than fatal.

---

## 1. Spec

### Output

1. **Minimal.** Parse, emit, stop.
2. **Per-hand action lines**, not aggregate-only.
3. **The model never computes a statistic.** Every count comes from code.
4. **Findings append to a local `leaks-log.md`**, gitignored, plus a short
   summary in chat.

### Labelling

5. **Labelling is scripted and descriptive.** Same hand, same labels, always.
6. **The agent judges; the script does not.** It reads a cohort of hands
   sharing a label and says what the pattern means and how to fix it.
7. **A whole hand is labelled**, every street including the river. Most labels
   land before the river; some only exist there.
8. **`docs/strategy-notes.md` is input material**, compiled into the
   prescription facet. Never loaded at runtime, never handed to the agent.
9. **Every label carries its denominator.** Counts are over *decisions*, and
   the payload also prints how many hands they span.
10. **Thin labels are shown, not hidden.** The agent sees every count and is
    trusted to say "3 of 5, too early to call". Deliberate divergence from
    `leak-coaching.md` rule 1.

### Outcome blindness

11. **Villain hole cards never reach the agent.** `shows[]` stays out.
12. **Board and action line both truncate at Hero's last action.**
13. **`blind` carries no money and no result.** Enforced as an allow-list.
14. **The agent never reads `hands/` directly.** The payload is the only input.

### Modes

15. **`leaks`** — the existing aggregate report, still the default.
16. **`blind`** — no outcome. Labels, counts, action lines.
17. **`pots`** — biggest pots, ranked in bb by Hero's gross chips in.

### Folds

18. **Preflop folds are absent from `handLines[]`** but feed counts and the
    RFI block.
19. **The range check is code, never a model. RFI only for now.**

### Archive

20. **`hands/` at the repo root, gitignored**, read recursively every run, and
    the default target when no path is given.
21. **A date window selects what is reported on**, not what is parsed.
22. ~500 hands across 5 tournaments today, growing.

### Process

23. **One smoke check, no test suite.** A large end-to-end test is a follow-up
    plan, not part of this work.
24. **MVP first**, then increments.

---

## 2. The label vocabulary

### Inputs the labeller computes

| Axis | Values |
|---|---|
| Hand class | `strong / marginal-made / draw / air` |
| Vulnerable | boolean, see below |
| Backdoors | boolean — three to a suit or to a straight |
| Blockers | which of villain's likely holdings Hero's cards remove |
| Board type | `dry-high-mine / wet-high-mine / middling-theirs / paired / monotone` |
| Action | `check / bet-33 / bet-75 / bet-150 / bet-200` (unopened), `fold / call / raise` (facing) |
| Street | `flop / turn / river` |

**Hand class boundary**, concretely enough to implement:

- `strong` — two-pair or better using at least one hole card, **or** an
  overpair, **or** top pair with a kicker of Q or better.
- `marginal-made` — any other pair, or playing the board.
- `draw` — eight or more outs. **A four-out gutshot is not a draw**;
  `classify.ts` calls it one, and `strategy-notes.md` §2 defines a draw as
  8–15 outs. Gutshots fall to `air` and carry `backdoors`.
- `air` — everything else.

**`vulnerable`** — there exist cards to come that turn a hand that is
currently ahead into one that is behind. Forced `false` on the river. On flop
and turn it must account for: threats already made (monotone means a flush
exists now, not a draw); counterfeiting and redraws; the number of opponents
still in; Hero's own blockers to the draw; and **flop SPR** — below 2 nothing
is vulnerable, because the stack goes in regardless.

**Blockers are new work.** Nothing in the repo computes them. `read.ts` needs
the ace of the flush suit, the straight-completing card, and paired-board
removal — the three cases `strategy-notes.md` §4 works through. This is what
makes `river-bluff-with-blocker` sayable, and it is the label the user asked
for by name.

### The label set

Labels are a function of the axes above. Named, closed, descriptive:

```
range-bet-air              air × bet-33 on a board that favours Hero
barrel-air                 air × bet-75+ , no backdoors, no blockers
semibluff                  draw × bet-*
check-draw                 draw × check
overbet-with-nuts          strong × !vulnerable × bet-150+
bet-big-vulnerable         strong × vulnerable × bet-75+
check-strong-vulnerable    strong × vulnerable × check
overbet-marginal           marginal-made × bet-150+
thin-value-bet             marginal-made × bet-33|75 on the river
river-bluff-with-blocker   air × bet-* × river × blocks villain's calls
river-bluff-no-blocker     air × bet-* × river × blocks villain's folds
```

The last two are the river pair the user named. §4 of the notes is explicit
that the direction flips by street, so they are river-only labels and the flop
equivalent is deliberately absent.

### The prescription facet

Alongside the label, every postflop decision carries `prescribed`, computed
from **both** stages of §2 — board picks the size, hand picks the frequency —
and only as the preflop aggressor:

- `ok` — action matched the prescription.
- `off` — it did not.
- `n-a` — no prescription applies.

`n-a` covers: not the preflop aggressor; facing a bet; multiway; river (§2 is
headed "flop and turn"); all-in or effectively committed; flop SPR < 2;
effective stack under 12bb; and `icm-suspect`. **`n-a` is excluded from the
prescription denominator**, so collapsing it into `ok` never dilutes a rate.

The stages are conjunctive. On `middling-theirs` and `monotone` the prescribed
flop action is a check, so a check there is `ok`, not `off`. Getting this
backwards is what made the old model fire on correct play.

`icm-suspect` is a facet, not a guess: final table, short-handed, or a late
level. `ranges.ts` states its charts are chipEV and too wide near a pay jump,
and §6's whole overbet tree assumes chipEV.

### Sizing buckets

`bet-33` `<0.45` · `bet-75` `0.45–1.0` · `bet-150` `1.0–1.75` · `bet-200`
`>1.75`, as a fraction of the pot.

150 and 200 stay split. §6's discriminator — "if you can't name the specific
hand they're calling with, you want 150%, not 200%" — is the most useful
distinction in the sizing section, and one extra boundary is a cheap way to
keep it.

**The numerator differs by action kind.** `Action.to` is documented "Raises
only" (`parse.ts:51`); every *bet* has `to === undefined`, so reading it
yields NaN for the entire unopened tree. Bets use `amount / potBefore`; raises
use `to / (potBefore + toCall)`.

`Action.allIn` decisions are `n-a` for the prescription facet and excluded
from sizing denominators, but they still carry a label. Excluding only the
bucketing is asymmetric — a check can never be all-in, so at 15–30bb the jam
would vanish while the check remained, driving every check rate upward.
Near-all-in counts too: a 7bb bet into a 6bb pot with 22bb behind is not an
overbet decision.

---

## 3. Build order

**Step 0 — module resolution and one smoke check.**
`node --experimental-strip-types` is ESM and needs extensions.
`classify.ts:23`, `ranges.ts:62`, `hands.ts:18`, `boundary.ts:19` and `:27`
import values without one; `import('src/lib/preflop/ranges.ts')` throws
`ERR_MODULE_NOT_FOUND` today. Adding `.ts` to those five sites is verified
sufficient, and the type-only imports beside them correctly need nothing.

Then **one** smoke check: run the CLI end to end against the fixture already
committed in `parse.test.ts:19` and assert the window, the sizing buckets and
argv all produce sane output. Not a suite — one command. The three worst bugs
found in review all fail *silently*, and nothing else would catch them.

**Step 1 — archive, window, CLI plumbing.**

- `hands/` walked **recursively** (`collect()` at `leaks.ts:17` is not) and
  used as the default target when no path is given (`leaks.ts:32` currently
  exits 1).
- **Rewrite argv parsing.** `leaks.ts:28` only exempts `--out`'s value, so
  `--mode blind --from 2026-09-01` puts `blind` and the date into `targets`
  and `statSync` throws ENOENT. Verified.
- **Normalise the date.** `Hand.timestamp` is `2026/09/08 20:03:09` — slashes.
  Compared against `YYYY-MM-DD`, `--to` silently returns nothing and `--from`
  silently returns everything. Verified. Add
  `handDate = timestamp.slice(0,10).replaceAll('/','-')`, record the export's
  timezone in `meta`, and exit 1 on a malformed date or `from > to`.
- `selectWindow(hands, from, to)` lives here, not in the CLI layer: it changes
  the hand set every count and every `meta` field is built on, so writing it
  later means writing steps 7 and 8 twice.
- Dedupe by hand id, asserting same-id records carry identical text.
- **Exclude pot-check failures and no-hero hands from every denominator**, not
  merely warn: in an accumulating archive that garbage is permanent.
- `meta` carries **both** spans, always, explicitly labelled:
  `meta.archive {files, hands, excluded, first, last}` and
  `meta.window {requestedFrom, requestedTo, first, last, hands, decisions}`.
  Only `meta.window` may be described by the agent.
- The window applies to **every** mode, including `leaks`. That changes the
  contract `leak-coaching.md:17` pins, so update that file in the same step.

**Step 2 — action lines.** `src/lib/hh/lines.ts`. Compact per-hand notation,
board and line both truncated at Hero's last action. Depends only on parse and
hero, and it is what the agent actually reads.

**Step 3 — decision facets.** Extend `StreetPlay` (`hero.ts:25`) with IP/OOP,
pot type, players-in and **effective stack**. `stackBB` (`hero.ts:266`) is
Hero's own starting stack: 60bb Hero against a 12bb caller is a 12bb pot, so
every threshold built on it is wrong today.

The unopened/facing split is **per action, not per street** — `a.toCall > 0`
means facing, otherwise unopened, with `checkRaised` (`hero.ts:135`) as the
named exception. `StreetPlay.facedBet` reflects Hero's first action only, so
check-then-call would otherwise land a call on a tree with no slot for it.

**Step 4 — RFI fold check.** The first useful vertical slice, and independent
of everything above except step 0. Two mappings must exist first:

- **`depthFor(stackBB)`.** Nothing in `src` maps stack to `Depth` (verified).
  Tiers are 60bb+/20bb/10bb and the modal MTT stack of 28–45bb has no chart.
  State the boundaries. Note the `short` tier is a **jam** chart
  (`ranges.ts:131`), so at 12bb "in range" means jam, not open.
- **Table size to chart column.** `POSITIONS` (`ranges.ts:66`) is a 9-handed
  ladder; `positionNames` (`parse.ts:155`) labels the earliest seat at a
  6-handed table "LJ". Distance from the button is the right idea, but the
  mapping must be stated or a short table silently reads a chart several seats
  too wide.

Tolerance is **combo mass, not rank**. `HAND_STRENGTH_RANKING` is a global
ordering that puts 54s below K7o while every chart has 54s in and K7o out, so
"N ranks" forgives an arbitrary set. §1 says trim the bottom 2–3% of combos,
offsuit and weakest-suited first: per `(position, depth)` accumulate
`combosForClass` upward from the weakest in-range class until ~40 combos, and
flag only folds strictly above that band. **Band is zero below 15bb** — §1
calls that the regime to know exactly.

Carve-out to write down: `leak-coaching.md:41` forbids coaching opening
ranges. RFI *folds* are in scope; RFI *frequency* is not.

**Step 5 — hand and board reading.** `src/lib/read.ts`, beside odds and
classify rather than under `hh/`. One module, because
`vulnerable = f(class, board)` and splitting it scans ranks and suits twice.

No 7-card evaluator — an evaluator exists to compare two hands and spec 11
forbids ever seeing villain cards. What is needed is Hero's best five against
the board's five, to catch playing the board and board-made straights, which
`classify.ts:206` gets wrong by its own admission. `hasStraight` and
`hasFlush` are in `odds.ts:71,80` and return bare booleans, so the
category-plus-kicker comparison is new code, not a reuse.

Blockers and backdoors land here. Backdoors are a **facet**, not a
`classify.ts` category — `DECISIONS.md:126` removed them from the outs drill
because they have no one-card outs, which is a statement about counting, not
about bluff selection. No decision is reopened.

**Step 6 — labelling.** `src/lib/hh/labels.ts`. Axes to label, plus the
`prescribed` facet and `nutAdvantage`, which needs the preflop role and so
belongs here rather than in `read.ts`.

**Step 7 — counting.** Label counts with denominators. `stat()` dereferences
`BANDS[key]` at `stats.ts:177` and throws on an unknown key, so this is a new
`labelStat()`, not a reuse. **Counts are over decisions**; the payload prints
both, as `17 decisions across 15 hands`.

**Step 8 — payloads and selection.** One `HandRecord`; `renderBlind` and
`renderPots` are field-pickers over it.

`renderBlind` is an **allow-list**, not a deny-list. The fields that leak are
more numerous than the obvious ones: `wwsf`/`wtsd`/`wsd` (`stats.ts:303`),
`byRole[].netBB`, `worstPots` and `bestPots` (`stats.ts:320`, `:350`),
`HeroHand.won`/`net`/`invested` (`hero.ts:269`), `wonPot` and `showdown`
(`hero.ts:281`), and `board`, which is the full five cards at `hero.ts:285`
and must be sliced to `streetReached`. Ordering is archive order, stated in
the payload.

`--label <name>` returns **whole hands** that carry the label: every label on
the hand and its full action sequence, not the one matching decision. The
agent reads the hand, not a row.

`--exemplars N` caps how many hands come back. Selection is every ⌈n/N⌉-th in
archive order, with the stride and `showing N of M` printed — spec 13 forbids
result-derived ordering, and taking the first N would return one table, one
tournament, one hour.

`pots` ranks **in bb**, not raw chips: across a multi-tournament window raw
chips sort by blind level. "Gross chips in" is
`invested + (uncalled.player === hero ? uncalled.amount : 0)` — `parse.ts:274`
subtracts an uncalled bet, which otherwise ranks a river bluff that got
through below the same bluff called.

**Step 9 — CLI surface.**

```
npm run leaks -- [paths]  --mode leaks|blind|pots    # leaks is the default
                          --from / --to YYYY-MM-DD   # inclusive, either alone
                          --label <name>
                          --exemplars N
                          --vocab --check-doc
```

**Step 10 — the skill.**

```
.claude/skills/hand-review/
  SKILL.md              trigger, run command, mode order, hard rules,
                        output contract, pointers
  references/
    blind-review.md     reading a cohort
    pots-review.md      reading pots mode
docs/
  hand-labels.md        canonical: axes, the closed label list, what each
                        label means and when it is and is not a mistake.
                        Peer of leak-coaching.md.
```

The rubric lives in `docs/` beside the code that emits it; SKILL.md points at
it. The skill shells out to `npm run leaks` and vendors nothing.

Hard rules in SKILL.md:

- Never read `hands/`. Never state a number absent from the payload.
- Only `meta.window` may be described. Findings from a one-month window are
  about that month.
- At most three established findings, and **fewer than three is a correct
  output**. Thin labels may be raised as watch items, named as thin and
  phrased as forming; a watch item never occupies a finding slot.
- Every established finding must cite a **sub-condition** whose count is
  strictly smaller than the label count, and the `prescribed: ok` count in the
  same cell. "14 of 17" and "14 of 60" are different leaks, and a finding that
  cites neither is a restatement of the label's name.
- The action line ends at Hero's last action and never says whether it worked.
- `blind` runs before `pots`, in its own invocation. One agent running both
  defeats the mode split.

Because `docs/hand-labels.md` carries, per label, *why* it can be a mistake
quoted from the user's own notes, the fix text lands in his framework rather
than in generic solver vocabulary.

**Step 11 — the log.** Findings append to `leaks-log.md`, gitignored, dated,
keyed by `hash(label, from, to)` so overlapping windows do not duplicate. Chat
gets a short summary, not the file.

---

## 4. Keeping the docs honest without a suite

The CLI emits `vocabulary[]` — every label the labeller can produce, with its
`minN`. A label in `docs/hand-labels.md` but not in `vocabulary[]`, or the
reverse, means the doc is stale, and the agent says so rather than coaching it.

`npm run leaks -- --vocab --check-doc` diffs the emitted keys against the
doc's headings and exits non-zero. It must work with `hands/` empty or absent.
It also diffs the `meta` contract that `leak-coaching.md:17` pins, since step
1 changes it.

---

## 5. Deferred

- A large end-to-end test. Its own follow-up plan.
- Blind defense, 3-bet and cold-call charts. `ranges.ts` is RFI-only, so the
  facing tree carries facets and no prescription.
- Conditional slicing on facets. Needs thousands of hands.
- A parsed-hand cache. 500 to 5000 hands re-parse in under a second, and step
  1's `perFile` return makes one a drop-in later.
- Comparing two windows — "is the overbetting closing?" — which needs both
  windows to clear `minN`.
- Subagent fan-out. Revisit past ~40k tokens of payload, for per-tournament
  comparison, or once a hypothesis loop exists where every proposal goes back
  to code to be counted.
- Feeding found leaks into the trainers' drill weighting.
