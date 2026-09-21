# Handover — hand-history coach, end of phase 1

Phase 1 of `PLAN-coach.md` is built, reviewed three times and merged into
[#13](https://github.com/Kilars/bluff-catcher/pull/13). This is what a next
session needs that the plan and the code do not already say.

## The essentials

- **All of phase 1 §2 steps 0–5 ship.** Nothing was skipped or half-done.
- **Two plan deviations, both deliberate** — no `HandRecord`, and the lib
  stays pure. Reasons below; neither corners phase 2.
- **Seven real bugs were found by review, not by tests.** Four were wrong
  numbers in the payload, three were regressions from fixing the first four.
- **One known defect ships**: dead button *and* dead small blind together.
- **Phase 2 is unchanged** and still the right next move, with one caveat
  about `StreetPlay`.

## Start here

```bash
npm run leaks -- src/lib/hh/fixtures            # the text report
npm run leaks -- src/lib/hh/fixtures --json     # what the coach is fed
npm run smoke                                   # the CLI's only gate
```

`hands/` is the default target and is gitignored — it does not exist in a
fresh clone, and the CLI says so rather than failing oddly. Node 22.6+ is
required (`--experimental-strip-types`); CI and `engines` both pin it now.

## What changed outside the plan

| Thing | Why |
|---|---|
| CI and deploy moved to Node 22 | `npm run leaks` always needed it, but nothing in CI ran the script, so the pin and the toolchain had silently disagreed |
| `doc.test.ts` fixture's pot corrected | It was short by exactly its antes (19,111 vs 19,291). The new pot check excluded the hand and emptied `worstPots` |
| `parse.ts` position rotation | Anchors on the first live seat past the button, so a dead button no longer hands out labels by raw seat number |
| `heroHands()`, `potOdds()`, `bestPots`, `BOARD_TYPES` deleted | No callers |

## The two deviations from the plan

**No `HandRecord`.** The plan specifies `readArchive(paths: string[])`
returning `{hand, hero, file, handDate}`. `src/lib/**` is bundled into the
browser app, so that signature would have put `node:fs` in the app's shared
import graph. `archive.ts` takes `{path, text}[]` instead and the fs walk
lives in `scripts/leaks.ts`; `handDate` and `grossBB` went onto `HeroHand`.

This does not corner phase 2 — `HeroHand.decisions` already carries full
`Action` objects, which is everything §3's sizing rule needs. **The one thing
genuinely lost is villain sizing**: `buildStreet` keeps only Hero's actions,
so `lines.ts` could only reconstruct villain bets from Hero's `toCall`, which
is lossy multiway. The fix is one line when you need it — add `allActions: all`
to `StreetPlay`; `all` is already computed on the line above.

**Structural dedupe key, not `raw` on `Hand`.** `raw` would carry every hand's
source text through the pipeline and into a type the browser imports, to serve
a dedupe that runs once per file. The key is `tournamentId|id` — deliberately
not the pot or the action count, which could only ever fail *open* (keeping a
duplicate), and deliberately not the id alone, which could fail *closed* if GG
ever reuses an id across tournaments (silently dropping real hands forever).

## Known defect

**A dead button with a dead small blind shifts every position label one seat.**
The rotation anchors on the button's seat number. With the button on an empty
seat *and* no small blind posted, the first live seat is labelled SB when it is
actually posting the big blind.

A dead button with a live SB is correct — that case has a test. The exact fix
is to anchor on the `posts big blind` line instead of the seat number: the BB
is always live and always exactly one position. I left it because I could not
confirm from the repo whether GG emits dead-SB hands without a `posts small
blind` line, and changing core position logic at handover is the wrong trade.
**Check a real export for a hand with no `posts small blind` line before
deciding.**

## What review caught that tests did not

Worth knowing, because it says where the risk lives:

- A mucked river call was not counted as a showdown. Hero shows when he wins
  and mucks when he loses, so the bias was one-directional every time — WTSD
  could only read low, WSD only high, call-down losses landed on the red line.
- Fixing that by reading "anyone showed" was **the same error inverted** — an
  opponent who folds may still flash a hand.
- Fold-to-c-bet measured in-position spots only (`facedBet` means "before
  Hero's first action", which excludes every BB check-fold).
- Fixing *that* with `facedBetEver` then counted donk bets that fold to a
  raise.

Both fix-the-fix rounds were found by a reviewer running adversarial fixtures,
not by the suite. `stats.test.ts` now covers the payload numbers, and each
assertion was checked by reverting its fix and confirming it goes red. **The
lesson for phase 2: a stat's denominator is where the bugs are, and they do
not fail loudly — the report just prints a wrong percentage beside a
reference band.**

## Still untested

These behaviour changes ship green with nothing asserting them. None moves a
number in the payload, which is why I left them:

- the `tournamentId|id` dedupe key
- symlink following in `collect()`
- the `--out --json` flag-as-value guard
- `firstIn`'s `limpersAhead === 0` filter

## Phase 2

Unchanged — read `PLAN-coach.md` §3. It needs more hands than exist today
(~500 across 5 tournaments), so the archive growing is the gate, not the code.

The one item worth promoting above phase 2 is the last line of §4: **feeding
found leaks into the trainers' drill weighting.** It is the only thing that
closes the loop between the report and the app, and it is worth more than most
of phase 2.
