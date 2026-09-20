# Plan — hand-history coach pipeline

Turns a growing archive of GGPoker exports into two payloads for an LLM coach:
one that never sees results, and one that reviews the biggest pots.

Supersedes nothing. `docs/leak-coaching.md` stays as-is — it grounds the
existing stat report. This plan adds the per-hand layer beside it.

---

## 1. Spec

Requirements as stated, not paraphrased into something easier to build.

### Output

1. **Minimal.** Parse, then emit the desired action only. No padding.
2. **Per-hand action lines**, not aggregate-only. The coach sees hands.
3. **The LLM never computes a statistic.** Every frequency, count and
   percentage comes from code. The model reads and judges; it does not count.

### Outcome blindness

4. **Villain hole cards are never passed to the coach.** `shows[]` is parsed
   and stays out of every payload.
5. **The board truncates at the street Hero left.** Folding the flop means the
   turn and river are not emitted.
6. **Mode `blind` carries no money at all** — no `netBB`, no `chipFlow`, no
   result-derived ordering.

### Modes

7. **`blind`** — no outcome. Looks for patterns and misplays.
8. **`pots`** — the big pots, wins and losses both. Ranked by Hero's own
   invested BB, so a pot villains built after Hero folded never surfaces.
   Money is visible here; that is the point of the mode.

### Folds

9. **Preflop folds are removed from the `blind` payload entirely.** `vpip` and
   `pfr` already state that exactly.
10. **The range check is code, never an LLM.** Checking a fold against a chart
    by prompting a model is inefficient and unnecessary.
11. **RFI only for now.** Blind defense, 3-bet and cold-call ranges are a later
    increment. Small steps.

### Labels

12. **Wide enough to name real mistakes, narrow enough to cluster.**
13. **Derived from `docs/strategy-notes.md`**, which is *input material for the
    vocabulary* — it is not read at runtime and not handed to the agent.
14. **Every tag carries its denominator**, and reads `thin` below a minimum.
    8 of 15 is a leak; 8 of 200 is noise.

### Archive

15. **A local folder of hand histories** that grows as tournaments are played.
    Every run parses the whole archive. Counts accumulate across exports
    rather than restarting.
16. Currently ~500 hands across 5 tournaments. Built for that to increase.

### Process

17. **No tests** for this work.
18. **MVP first**, then increments.
19. Position mapping stays simple — use what the history gives.

---

## 2. The label model

Four axes. Each of the first two carries a *prescription*, which is what makes
tags generate instead of being enumerated by hand.

### Hand class — prescribes an action

| Class | Prescription |
|---|---|
| `strong-vulnerable` | bet nearly always |
| `strong-invulnerable` | bet small, or check some |
| `marginal-made` | check/call, pot control |
| `draw` | bet often |
| `air-backdoor` | bet at balancing frequency |
| `air-nothing` | check |

Five come from strategy-notes §2 stage 2. `marginal-made` is added because
that table is written about betting, so bluff-catchers and TPWK fall through
it, and `LEAK-TPWK` already exists as a named finding.

### Board — prescribes a size

| Type | Prescription |
|---|---|
| `dry-high-mine` | 33%, ~90% frequency |
| `wet-high-mine` | 75%, ~55% |
| `middling-theirs` | check ~60%, else 33% |
| `paired` | 33%, high frequency |
| `monotone` | check often, small when betting |

From §2 stage 1. "Mine" is relative to who raised preflop.

### Action taken

`check / fold / call / bet-33 / bet-75 / bet-over`, bucketed from
`amount / potBefore`. Raises flagged, not split into their own scale.

§6 draws the size tree as 33 / 75 / 150 / 200, and the 150-vs-200
discriminator is real — 150 is wide value against a spread of decent hands,
200 is near-nuts against one hand they cannot fold. Both collapse to
`bet-over` for now: at 500 hands they would carry a couple of hits each,
which names nothing. Split them when the archive supports it.

Nut advantage is a stored facet, not a gate on any tag. Gating narrows the
tag further at exactly the sample size where hits are scarce.

### Street bluff logic

`flop = equity`, `turn = equity + blockers`, `river = blockers only` (§5).
Gives a per-street test rather than one generic one.

### The tag is the mismatch

Not a free-form label. Prescription vs action:

```
strong-invulnerable × bet-over → overbet-invuln
strong-vulnerable   × check    → underprotection
marginal-made       × bet-over → nonpremium-overbet
air-nothing         × bet-*    → worst-bluff-candidate
draw                × check    → missed-semibluff
```

A closed vocabulary that clusters, because the axes are small and the tag is a
function of them.

### Facets — stored, read by the coach, never clustered on

IP/OOP · pot type (SRP / 3BP / limped) · SPR as a number · multiway · level ·
stack depth in bb · `vulnerable` bool · `nut-advantage` bool.

These fragment the key if clustered. Four facets across 24 tags is ~576 cells,
which never fires a three-hand threshold. They are context, not key.

---

## 3. Build order

Each step lands on its own.

**1. Archive and accumulation.**
`hands/` at the repo root, gitignored. The CLI walks it, parses every export,
dedupes by hand id. One run, whole archive.

**2. Made-hand strength.** `src/lib/hh/strength.ts`.
The load-bearing gap: `classify.ts` returns `null` for made hands and air, so
it covers draws only. Needs a 7-card evaluator producing the six classes plus
the `vulnerable` boolean (are there live cards that turn this into a loser).
`odds.ts` has `hasFlush` / `hasStraight` / `pairsUp` to build on.

**3. Board typing.** `src/lib/hh/board.ts`. The five types, plus
`draw-completed` on turn and river. `nut-advantage` computed from board type
and preflop role.

**4. Action lines.** `src/lib/hh/lines.ts`. Per-hand compact notation, board
truncated at exit street, preflop folds omitted. This is the thing the coach
actually reads.

**5. Tagging.** `src/lib/hh/tags.ts`. Prescription vs action per street
decision. Emits tag plus the facets for that decision.

**6. Aggregation.** Tag counts with denominators — how often the spot arose,
how often it was misplayed. `thin` below minN, reusing the shape in
`stats.ts:184`.

**7. Payloads.** Split `renderJson` into `renderBlind` and `renderPots`.
`blind` = stats with money stripped + action lines + tag counts.
`pots` = top N by Hero's invested BB, full decisions, money visible.

**8. CLI.** `--mode blind|pots` on `scripts/leaks.ts`, default `blind`.

**9. RFI fold check.** Map Hero's seat to a chart column by distance from the
button; skip the hand when the table is too short to have one. Depth tier from
`stackBB`. Per strategy-notes §1 the line should sit *tighter* than the chart,
so boundary folds are correct and must not be flagged — only folds
meaningfully inside the range count. Needs a tolerance band.

---

## 4. Deferred

- Blind defense, 3-bet and cold-call ranges — no charts in the repo yet, and
  `ranges.ts` is RFI-only.
- Conditional slicing on facets. Needs thousands of hands; at 500 it is noise.
- Splitting `bet-over` back into 150 and 200, and gating the overbet tags on
  nut advantage. Both are correct distinctions that need volume to earn.
- Subagent fan-out for open-ended hypotheses. Only worth it once tag
  clustering stops finding things, and only with every proposed hypothesis
  sent back to code to be counted.
