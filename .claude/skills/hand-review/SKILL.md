---
name: hand-review
description: Coach a session from the local GGPoker hand-history archive. Use when the user asks to review their hands, look at a session, find leaks, or asks what they played badly. Runs the leaks CLI and coaches from its JSON payload.
---

# Hand review

The standard review coaches from the report, not the raw hands. Use real hand
IDs, not theoretical ranges. A results-aware follow-up is a separate step, done
only when the user asks for it (see the end of this file).

## Run

```bash
npm run leaks -- --json --variant cash|mtt [--from YYYY-MM-DD] [--to YYYY-MM-DD] --out FILE
npm run leaks -- --json --variant cash --label NAME --out FILE   # every instance of one label
```

No path argument means `hands/` is read recursively. Dates are inclusive. With
no window, the whole archive is reported. Say so.

Read `docs/leak-coaching.md` first. It has the bands, the label meanings and the
finding catalogue.

### Knowledge-base briefs

If they exist, read the approved briefs in
`research/coaching-transcripts/kb/briefs/` for what the session touches:
- the `preflop-*` briefs for preflop sections with hands in them
- the brief for each postflop family with labels that fired (slugs in
  `.claude/skills/kb-nightly/SKILL.md`)
- `fundamentals`

Briefs are coaching theory distilled from cited videos. They contain no hand
results, so they're fine to use in the blind review. Use them to ground each
explanation, and cite the source inline, like `(GTO Wizard, dVZ1CdESSTw
12:04)`. Lead with the GTO baseline. When an exploit is the better line, name
the population it assumes. Briefs never override the payload or the hard rules
below. Skip `staging/`, which is unapproved.

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

Don't run `--mode pots` for the standard review. It shows who won, and a lost
pot reads as a bad decision. Coach from `bigSpots` instead.

## Hard rules

- For the standard review, the `--json` leaks payload is the only input. Don't
  read `hands/` or `--mode pots` for it. (Dev work on the parser is a different
  hat; see `CLAUDE.md`.)
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

## Follow-up with the full hands

When the user asks for it after the blind review (to see villain hands, or a
hand the report is missing), read the raw hands. Add a results-aware section
under the blind review. Say which blind verdicts the full action confirms and
which it changes, and why. Judge each decision by what was knowable at the time.
Shown cards tell you the villain's range, not whether the decision was right.

