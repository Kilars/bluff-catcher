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

## 3. Phase 2 — labels, when there are hands to count

Not built now. Specified so it can be built without redesign.

### Labels describe, they do not accuse

An earlier draft made a label *be* a mistake — prescription versus action, tag
fires on mismatch. Review killed it: under that model three of five labels fire
on plays that are correct. Betting 33% with air on a board that fits your range
is range betting. Checking a nut flush draw on a monotone flop is standard.
A 150% river overbet with nut advantage is the recommended line.

So a label states a fact — `overbet-with-nuts`, `check-draw`,
`river-bluff-blocks-folds` — and **the agent decides which instances were
wrong**. Counts are frequencies, not error rates. A decision carries a *set*
of labels, not one.

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
nothing new in the repo needed. This is what makes `river-bluff-blocks-calls`
and `river-bluff-blocks-folds` sayable, and §4 of the strategy notes is the
worked example: A♥K♥ on a bricked heart board removes the hands you wanted to
fold, A♦K♦ removes nothing. Same strength, opposite value.

### Counting

`minN` and `thin` are leftovers from when a label meant an error. A frequency
needs a denominator, not a floor. Each label is an axis predicate crossed with
an action predicate, so its denominator is every decision matching the axis
predicate under any action.

```ts
interface LabelStat {
  label: string;
  decisions: number; hands: number; opportunities: number;
  rate: number | null; ci95: [number, number] | null;   // Wilson
  spread: { tournaments: number; days: number; byPosition: Record<string, number> };
}
```

`ci95` width plus `spread.tournaments` is what separates a tendency from noise.
"Nine times, all in one tournament" is the thing the agent needs to know, and
no threshold says it.

### Phase 2 additions

`src/lib/read.ts` for hand class and removals, taking board context as an
argument so `vulnerable` — which needs players-in and flop SPR — does not end
up half-owned by two modules. `src/lib/hh/lines.ts` for the compact action
notation. `src/lib/hh/labels.ts` for the axes. `labelStat()`, not `stat()`,
which throws on an unknown key (`stats.ts:177`). Then `--mode blind` as an
**allow-list** renderer, `--label <name>` returning whole hands, and
`--exemplars N` selecting every ⌈n/N⌉-th in archive order with the stride
printed.

`blind` must strip more than the obvious: `wwsf`/`wtsd`/`wsd`
(`stats.ts`), `byRole[].netBB`, `worstPots`,
`HeroHand.won`/`net`/`invested`, `wonPot` and `showdown` (`hero.ts:281`), and
`board`, which is the full five cards at `hero.ts:285`.

---

## 4. Deferred indefinitely

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
