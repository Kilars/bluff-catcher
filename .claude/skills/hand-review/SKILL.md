---
name: hand-review
description: Coach a session from the local GGPoker hand-history archive. Use when the user asks to review their hands, look at a session, find leaks, or asks what they played badly. Runs the leaks CLI and coaches from its JSON payload.
---

# Hand review

Coach from the report, never from the raw hands. Use real hand IDs, not
theoretical ranges.

## Run

```bash
npm run leaks -- --json --variant cash|mtt [--from YYYY-MM-DD] [--to YYYY-MM-DD] --out FILE
npm run leaks -- --json --variant cash --label NAME --out FILE   # every instance of one label
```

No path argument means `hands/` is read recursively. Dates are inclusive. With
no window, the whole archive is reported. Say so.

Read `docs/leak-coaching.md` first. It has the bands, the label meanings and the
finding catalogue.

## Read everything

1. **Preflop, per hand:** `rfiFolds[]` (chart opens folded), `coldCalls[]`
   (flats), `faced3Bets[]` (a raise over your raise: `heroRole` `open` means you
   faced a 3-bet, `3bet`/`squeeze` means you faced a 4-bet). Each is sound at
   n=1. Argue each hand from seat, raiser's seat, sizing and whether it's
   multiway.
2. **Postflop, every label family:** for each `labels[]` group with `stride` > 1,
   re-run with `--label NAME` and read every instance, not the 5-hand sample.
   Sort each group's instances into correct and leak, and name the IDs. A label
   is not a mistake: many fire on correct lines.
3. **Stats last:** `stats[]` and `byBoard` are context. Quote `byBoard` for
   direction only, with its caveat. Never coach a `thin` stat, and never coach
   opening frequency.

## Big spots

`bigSpots[]` is the 20 hands where Hero committed the most. For each one it lists
every decision with the pot, the price, the sizing and the hand strength at the
time, plus the board up to the last street Hero acted on. It contains no
outcome. Use it to judge how Hero plays under pressure, and look for patterns
across the spots: sizing with strong hands, river stack-offs, bluff targets,
preflop wars.

Never run `--mode pots`, even if the user asks for results. It shows who won,
and a lost pot reads as a bad decision. If asked, explain that and coach from
`bigSpots` instead.

## Hard rules

- Never read `hands/` or `--mode pots` while coaching. The `--json` leaks
  payload is the only input. (Dev work on the parser is a different hat; see
  `CLAUDE.md`.)
- Never state a number that isn't in the payload.
- Never claim how a hand or session went. You don't know.
- Describe only `meta.window`. `meta.archive` only tells you how thin the slice
  is.
- Never turn `instances` into a rate.
- Population-dependent spots (bluff-catches, river bluffs): say which pool read
  you're making.

## Output

Write `leaks-review-<YYYY-MM-DD>.md` (gitignored), with these sections in order:

1. **Sample:** window, hand count, variant, and how reliable the numbers are.
2. **What's going well**, with hand IDs.
3. **Preflop:** RFI folds, cold-calls, faced 3-bets and 4-bets.
4. **Postflop:** one subsection per label family, each with correct vs leak hands.
5. **Big spots:** every `bigSpots` hand in a table with a **Do differently**
   column (one short fix, or ✅ if the hand was played fine), then the patterns.
6. **One thing to focus on.**

Append a short dated summary to `leaks-log.md`. Send the review file to the user
with SendUserFile, and keep the chat reply to the headline findings.

If a label misfires (it tags a line it shouldn't), say so in a tooling note in
the review. Don't coach from it.
