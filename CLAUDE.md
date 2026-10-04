# bluff-catcher

A poker training app (Vite + React + TS) plus a hand-history leak finder for the
user's GGPoker exports. The user works here in one of two hats, and the two
should not mix.

## Hats

**Dev hat:** building the app or the hand-history pipeline. Give technical
answers only, with no poker tips. If it's unclear which hat applies, stay
technical and ask before coaching.

**Coach hat:** reviewing the user's own hands. It starts when the user invokes
`hand-review` or asks for coaching on their play. Coach from the JSON report,
never from `hands/` directly. The report is blind to results by design.

## What exists

| Area | Where |
|---|---|
| Trainers: Odds, then preflop Open (RFI), 3-bet, 4-bet, Blinds (`docs/PLAN-menu.md`); phone tree | `src/modes/`, ranges in `src/lib/preflop/` |
| Hand-history pipeline: parse → hero facts → labels → stats → report | `src/lib/hh/` |
| Coaching reference (bands, label meanings, findings) | `docs/leak-coaching.md` |
| Strategy grounding | `docs/strategy-notes.md` |
| Design decisions / plans | `docs/DECISIONS.md` (source of truth), `docs/PLAN-*.md` |
| Hand review skill | `.claude/skills/hand-review/` |
| Hand archive (gitignored) | `hands/` |
| Coaching outputs (gitignored) | `leaks-log.md`, `leaks-review-*.md` |

## Commands

```bash
npm run dev | build | test | typecheck | lint
npm run leaks -- [paths] --json [--variant cash|mtt] [--from/--to YYYY-MM-DD] \
                 [--label NAME] [--mode leaks|pots|coach] [--out FILE]
npm run split-hands -- [paths] [--out DIR]   # sort exports into cash/ and mtt/
npm run smoke                                # leaks CLI sanity check
```

The `leaks` JSON payload contains `labels[]`, `rfiFolds[]`, `coldCalls[]`,
`faced3Bets[]`, `bigSpots[]`, `byBoard`, `byRole` and `stats[]`. `--label NAME`
returns every instance of a label instead of the 5-hand sample. Never use
`--mode pots` for coaching, even on request, because it shows results.
`bigSpots[]` covers the big hands without them.

## Coaching output

The user wants a complete review: what's going well, preflop (RFI folds,
cold-calls, faced 3-bets/4-bets), postflop (every label family, read in full),
big spots, and one thing to focus on. The `hand-review` skill defines the
sections. Use real hand IDs, not theoretical ranges. Write the
review to `leaks-review-<date>.md`, append a summary to `leaks-log.md`, and send
the file to the user.
