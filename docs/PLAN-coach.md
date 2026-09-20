# Plan — hand-history coach skill

A local archive of GGPoker exports, a script that labels every decision
deterministically, and an agent that reasons over cohorts of labelled hands.
Ships as a Claude Code skill.

`docs/leak-coaching.md` is untouched and stays the grounding for the existing
aggregate report. This adds the per-hand layer beside it.

---

## 1. Spec

Requirements as stated, not softened into something easier to build.

### Output

1. **Minimal.** Parse, emit the desired action, stop.
2. **Per-hand action lines**, not aggregate-only.
3. **The model never computes a statistic.** Every count, frequency and
   percentage comes from code.
4. **Findings go to a local `leaks-log.md`**, gitignored, plus a short summary
   in chat. Not a wall of text in either place.

### Labelling

5. **Labelling is scripted.** Hand class, board type, action bucket and the
   resulting tag are all computed. No model in the labelling path, so the same
   hand always carries the same tag and the denominators mean something.
6. **The agent reasons over cohorts, not single hands.** It asks the script for
   every hand carrying a tag, reads that cohort, and applies poker knowledge to
   say what the pattern is and how to fix it — "you are overbetting, but too
   small" is the shape of the output, and it is a claim about the group.
7. **Wide enough to name real mistakes, narrow enough to cluster.**
8. **Derived from `docs/strategy-notes.md`**, which is input material for the
   vocabulary. It is not loaded at runtime and never handed to the agent.
9. **Every tag carries its denominator** and reads `thin` below a minimum.
   8 of 15 is a leak; 8 of 200 is noise.
10. **Thin tags are shown, not hidden.** The agent sees every tag with its
    count and verdict and is trusted to say "3 of 5, too early to call". This
    is a deliberate divergence from `leak-coaching.md` rule 1, which suppresses
    thin stats outright: a suppressed tag cannot be named as something to watch,
    and in a narrow window most tags are thin.

### Outcome blindness

11. **Villain hole cards never reach the agent.** `shows[]` is parsed and stays
    out of every payload.
12. **The board truncates at the street Hero left**, and so does the action line.
13. **`blind` carries no money and no result** — no `netBB`, no `chipFlow`, no
    `wonPot`, no showdown stats, no result-derived ordering.
14. **The agent never reads `hands/` directly.** The payload is the only input.
    One `cat` of a raw export defeats the entire design.

### Modes

15. **`blind`** — no outcome. Cohorts, tags, action lines.
16. **`pots`** — the big pots, wins and losses both, ranked by Hero's gross
    chips in. Money visible; that is the point of the mode.
17. **`leaks`** — the existing aggregate report, unchanged, still the default.

### Folds

18. **Preflop folds are absent from `handLines[]`.** They still feed tag counts
    and the RFI block.
19. **The range check is code, never a model.**
20. **RFI only for now.** Blind defense, 3-bet and cold-call ranges later.

### Archive

21. **`hands/` at the repo root, gitignored**, holding `.txt` exports. Grows as
    tournaments are played. Every run reads the whole archive.
22. ~500 hands across 5 tournaments today. Built for that to increase.
23. **A date range selects which hands are read.** Everything stays in
    `hands/` forever and everything is labelled; a start and an end date pick
    the window to report on. Labelling is cheap and scripted, so the window
    is a reporting concern, never a parsing one.

### Process

24. **No tests.** Drift is caught by a check script the skill runs, not by CI.
25. **MVP first**, then increments. Position mapping stays simple.

---

## 2. Label model

### Hand class — four, not six

`strong / marginal-made / draw / air`

`strong-vulnerable` and `strong-invulnerable` were one class times a facet the
plan already stored, so they collapse. `vulnerable` is a boolean beside the
class, and `overbet-invuln` is `strong` + `!vulnerable` + `bet-over`.

`air-backdoor` is dropped. `DECISIONS.md:126` deleted backdoor detection on
purpose, and reintroducing it to name one tag is not worth reopening that
decision. Backdoor hands fall into `air`.

**`vulnerable` is forced `false` on the river.** Zero cards to come means
nothing to deny, and without this every river check tags `underprotection`.

### Action — two trees, not one

You cannot check while facing a bet. One flat axis silently folds every
fold-to-a-bet into `missed-semibluff`.

| Tree | Values | Prescriptions |
|---|---|---|
| `unopened` | `check / bet-33 / bet-75 / bet-over` | strategy-notes §2 stage 2 |
| `facing` | `fold / call / raise` | none yet — facets only, no tag |

§3 gives a price table for the facing tree, not a prescription. Until there is
one, facing decisions emit facets and `tag: null`.

Buckets from `Action.to` (`parse.ts:52`), never `Action.amount`, which for a
raise is chips *added* (`parse.ts:296`). Boundaries: `<0.45` / `0.45–1.0` /
`>1.0` of the pot. **`Action.allIn` excludes the decision from bucketing** — a
12bb jam into a 6bb pot is `bet-over` by ratio and is not an overbet decision.
At MTT depths this is otherwise a large false-positive source.

### Prescriptions apply to the preflop aggressor only

strategy-notes §2 is headed "Postflop **as the preflop aggressor**", and §3
has the BB caller checking to the PFA. Ungated, `underprotection` fires on
correct caller checks and on the check half of a check-raise — which §3 calls
"correct and underused".

Gate on `hero.ts:278 pfa` and `StreetPlay.facedBet`. Evaluate the street by
`checkRaised` (`hero.ts:135`), not by its first action.

### Board type is an aggregate, never a tag

§2 stage 1 prescribes a *frequency* — "33%, ~90%". That is a property of a
population. One check on A-7-2r is not a mistake, and tagging it as one is
simply wrong.

Board type contributes to the bucket key and produces one aggregate row per
type, through the existing `Stat` shape:

```
cbet on dry-high-mine: 12/19 = 63%  vs ~90%
```

The five types stay: `dry-high-mine / wet-high-mine / middling-theirs /
paired / monotone`.

### The tag

Prescription versus action, on the `unopened` tree, as PFA:

```
strong + !vulnerable × bet-over → overbet-invuln
strong +  vulnerable × check    → underprotection
marginal-made        × bet-over → nonpremium-overbet
air                  × bet-*    → worst-bluff-candidate
draw                 × check    → missed-semibluff
```

### "This was fine" is data, not absence

Every postflop decision emits a row. The prescription returns `ok | off | n-a`:

- `ok` — matched. `tag: null`.
- `off` — mismatched. Tag set.
- `n-a` — no prescription applies: caller, multiway, facing a bet, under 15bb.
  **Excluded from the denominator.** Collapsing `n-a` into `ok` dilutes every
  frequency printed.

### Facets — stored, read, never clustered on

IP/OOP · pot type (SRP / 3BP / limped) · players in on the street · SPR ·
level · stack depth · `vulnerable` · `nutAdvantage`.

IP/OOP, pot type and players-in are functions of the parsed `Hand` and nothing
currently produces them — see step 3. SPR, level and `stackBB` already exist
(`hero.ts:49-55`, `:126`); do not recompute them.

---

## 3. Build order

**Step 0 — module resolution.** `node --experimental-strip-types` is ESM and
needs file extensions. `classify.ts:23`, `ranges.ts:62`, `hands.ts:18`,
`boundary.ts:19` and `:27` import values without one, and
`import('src/lib/preflop/ranges.ts')` throws `ERR_MODULE_NOT_FOUND` today.
`hh/*.ts` works only because it already writes `.ts`. Add the extensions; vite
and vitest tolerate them. **Nothing else in this plan runs until this lands.**

**Step 1 — archive and CLI.** `hands/` at the repo root, gitignored, walked
**recursively** (`collect()` at `leaks.ts:17` is not, so per-tournament
subfolders vanish silently). Dedupe by hand id, asserting same-id records carry
identical text. `meta` currently reports the first tournament's name and date
as the whole archive's (`leaks.ts:59`) — widen it to a span. **Hands failing
the pot check are excluded from denominators, not merely warned about**: in an
accumulating archive that garbage is permanent. Return
`{hands, perFile: {file, hands, skipped, potFails, noHero}}`.

**Step 2 — action lines.** `src/lib/hh/lines.ts`. Compact per-hand notation,
board and line both truncated at Hero's last action, preflop folds omitted.
Depends only on parse and hero, and it is the thing the agent actually reads.

**Step 3 — decision facets.** Extend `StreetPlay` (`hero.ts:25`) with IP/OOP,
pot type and players-in. Doing this in `tags.ts` instead would re-walk
`hand.actions` and produce a second pot-state computation — exactly what the
parser's pot check exists to guard against.

**Step 4 — RFI fold check.** Fires on preflop folds, which are most hands, and
needs no new poker logic. `positionNames` (`parse.ts:155`) already maps by
distance from the button and its labels are a subset of `ranges.ts:66`
POSITIONS apart from the blinds, so the check is
`POSITIONS.includes(position)` plus first-in — noting `firstInOpp`
(`hero.ts:228`) currently admits SB and limped pots, which RFI is not.
Tolerance band from `strengthRank` / `HAND_STRENGTH_RANKING`
(`preflop/hands.ts:200`, `:170`): per strategy-notes §1 the line should sit
*tighter* than the chart, so boundary folds are correct and only folds above
the Nth-weakest in-range hand are flagged.

**Step 5 — hand and board reading.** `src/lib/read.ts`, beside odds and
classify rather than under `hh/`, which is history-shaped. One module, because
`vulnerable = f(handClass, boardTexture)` and splitting it scans ranks and
suits twice.

No 7-card evaluator. An evaluator exists to compare two hands, and spec item 11
forbids ever seeing villain cards. What is needed is one comparison — Hero's
best five against the board's five — to catch playing the board and
board-made straights, which `classify.ts:206` gets wrong by its own admission
(see the comment at `:211`). A category-plus-kicker tuple over C(7,5), reusing
`hasStraight` and `hasFlush`.

`vulnerable` is wrong in four known places, all of which belong in the doc
rather than in silent code: forced `false` on the river; it scales with
opponents still in, which step 3 supplies; counterfeiting on paired rivers;
and Hero's own blocker to a two-flush suit.

**Step 6 — tagging.** `src/lib/hh/tags.ts`. Prescription versus action per
decision, on the unopened tree, gated on PFA. Emits tag or `null`, plus the
`ok/off/n-a` verdict and the facets. `nutAdvantage` lives here, not in
`read.ts`, because it needs the preflop role.

**Step 7 — counting.** Tag counts with denominators. `stat()` dereferences
`BANDS[key]` at `stats.ts:177` and throws on an unknown key, so this is a new
`tagStat()`, not a reuse.

**Step 8 — payloads.** One `HandRecord`, with `renderBlind` and `renderPots`
as **field-pickers over it**. Splitting `renderJson` in two invites two shapes
that drift, and blind mode is exactly where a drifted field leaks a result.

What must be stripped from `blind`, beyond the obvious: `wwsf`, `wtsd` and
`wsd` (`stats.ts:303-305`) are results; `byRole[].netBB` is money;
`worstPots` and `biggestCalls` (`stats.ts:320-334`) are result-ranked;
`HeroHand.wonPot` and `showdown` (`hero.ts:281-282`) leak per hand. Ordering
is archive order, stated explicitly in the payload.

`pots` ranks by **gross chips Hero put in**, not `hero.ts:242 invested` —
`parse.ts:274` subtracts the uncalled bet, so a river bluff that got through
ranks below the same bluff called.

**Step 9 — CLI surface.**

```
npm run leaks -- [paths] --mode leaks|blind|pots   # leaks stays the default
                        --from YYYY-MM-DD          # window start, inclusive
                        --to   YYYY-MM-DD          # window end, inclusive
                        --tag <name>               # the cohort selector
                        --exemplars N              # cap lines per tag
                        --vocab --check-doc
```

`--mode leaks` remains the default because `docs/leak-coaching.md` is written
against that report.

`--tag` is what makes the agent's loop work: counts first, then every hand
carrying the tag it chose. `--exemplars N` caps lines per tag while counts stay
whole-window, which holds an invocation near 12k tokens at any archive size.
Ship it now; retrofitting it at 5000 hands means rewriting the reading
procedure too.

### The window

`--from` and `--to` are both inclusive and both optional: `--from` alone runs
to the present, `--to` alone runs from the start of the archive, neither reads
everything. They filter **after** parsing and labelling, so a hand's tag never
depends on which window it is read in, and the same hand always carries the
same label whether you ask about October or about everything.

Filtering is by **hand timestamp, not tournament date**. A tournament that
crosses midnight or a month boundary is otherwise either split arbitrarily or
pulled in whole, and the hand is the unit every count is built on. The cost is
that a boundary tournament appears partially, so `meta` reports
`tournaments: {whole, partial}` and the agent can say so.

`meta` carries the window — the requested dates, the actual first and last
hand timestamps inside it, and the hand count. **The agent never describes a
window it was not given**: findings from `--from 2026-10-01` are about
October, not about "your game", and the payload has to make that impossible to
get wrong.

A narrow window makes `thin` the normal verdict rather than the exception —
one month can be 120 hands, where almost nothing clears its `minN`. Thin tags
are still emitted with their full counts. The agent reads them, says which are
established and which are only forming, and the payload names how many cleared
their minimum so a short month cannot be mistaken for a clean bill of health.

**Step 10 — the skill.**

```
.claude/skills/hand-review/
  SKILL.md              trigger, run command, mode order, hard rules,
                        output contract, pointers
  references/
    blind-review.md     reading a cohort; per-street bluff logic
    pots-review.md      reading pots mode
docs/
  hand-tags.md          canonical: axes, prescription tables, closed tag
                        list, minN, per-tag cost and fix. Peer of
                        leak-coaching.md.
```

The rubric lives in `docs/` beside the code that emits it, not inside
SKILL.md — one copy, and the skill points at it. The skill shells out to
`npm run leaks` and vendors nothing: a second copy of the parser is the thing
most likely to drift.

Hard rules in SKILL.md: never read `hands/`; never state a number absent from
the payload; at most 3 established findings; `blind` runs before `pots`, in
its own invocation, because one agent running both defeats the mode split.

Thin tags get their own rule rather than a ban. The agent may raise one as a
**watch item** — named as thin, with its counts, phrased as forming rather
than established — and a watch item never occupies one of the three finding
slots. Stating a thin tag as an established leak is the error; mentioning it
is not.

**Step 11 — the log.** Findings append to `leaks-log.md` at the repo root,
gitignored, dated, with a stable finding id so re-runs do not duplicate. Chat
gets a short summary, not the file.

---

## 4. Keeping the vocabulary honest without tests

The CLI emits `vocabulary[]` — every tag key the tagger can produce, with its
`minN`. SKILL.md treats the payload as authoritative: a tag in
`docs/hand-tags.md` but not in `vocabulary[]`, or the reverse, means the doc is
stale, and the agent says so instead of coaching it.

`npm run leaks -- --vocab --check-doc` diffs the emitted keys against the doc's
headings and exits non-zero. The skill runs it at the start of a review. This
is `leak-coaching.md` §0's advisory rule made mechanical, at about twenty
lines, and it is not a test in the suite.

---

## 5. Deferred

- Blind defense, 3-bet and cold-call charts. `ranges.ts` is RFI-only, so the
  `facing` tree has no prescriptions and emits no tags until they exist.
- Splitting `bet-over` back into 150 and 200, and gating the overbet tags on
  nut advantage. Correct distinctions that need volume to earn.
- Conditional slicing on facets. Needs thousands of hands.
- A parsed-hand cache. 500 to 5000 hands re-parse in well under a second, and
  step 1's `perFile` return makes a cache a drop-in later.
- Subagent fan-out. Revisit when the payload exceeds ~40k tokens, when
  per-tournament comparison is wanted, or when a hypothesis loop exists in
  which every proposal goes back to code to be counted.
- Comparing two windows against each other — "is the overbetting closing?"
  is the obvious next want once `--from`/`--to` exist, but it needs a stable
  finding id and enough hands in both windows to clear `minN` twice.
- Feeding found leaks into the trainers' drill weighting.
