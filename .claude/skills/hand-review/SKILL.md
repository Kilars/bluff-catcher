---
name: hand-review
description: Coach a session from the local GGPoker hand-history archive. Use when the user asks to review their hands, look at a session, find leaks, or asks what they played badly. Runs the leaks CLI and coaches from its JSON payload.
---

# Hand review

Coach from the report. Never from the hands.

## Run

```bash
npm run leaks -- --json --from YYYY-MM-DD --to YYYY-MM-DD   # both optional
npm run leaks -- --json --label check-draw                  # one label, in full
```

No path argument: `hands/` is the default and is read recursively. Both dates
are inclusive and either works alone. With no window, the whole archive is
reported on — say so.

Read `docs/leak-coaching.md` before writing anything; it holds the bands, the
finding catalogue and the output contract.

## Lead with the labelled hands

`labels[]` is why hands are in the payload at all. Each entry is one label,
the facets **every** instance of it shares, and a stride-sampled set of the
decisions themselves — street, seat, stack depth, SPR, sizing, hand class,
flop texture, removals and the hand id.

Work it in this order:

1. Take the groups whose `shared` is non-empty. That is the finding: "four
   flop checks as the raiser, all from the blind, all on dry high-card boards"
   is a rule being carried. An empty `shared` means these instances have
   nothing to do with each other — leave them.
2. Open one decision from `decisions[]` and argue it from its own board, hand
   class, SPR and sizing. Name the hand id so the user can pull it up.
3. Only then look at `rfiFolds[]`, and only then at the percentages.

**A label is not a mistake.** `overbet-strong` is the recommended line with
nut advantage and a readable one without it; `check-draw` on a monotone flop
is standard. The code says what happened; deciding what was wrong is your
whole job. If you cannot say why one named instance was wrong, drop it.

**Never turn `instances` into a rate.** There is no denominator in the payload
and inventing one is the counting this tool was built without. `stride` above
1 means `decisions[]` is a sample of the group, not all of it.

**Never run `--mode pots`.** It ranks hands by what they returned, and it
exists for a human asking where the chips went. Reading it would tell you which
hands lost, and the hands that lost are not the hands played worst.

## Hard rules

- **Never read `hands/`.** The JSON payload is the only input. It is already
  stripped of villain hole cards and the board stops where Hero stopped.
- **Never state a number that is not in the payload.** Code counts; you read.
- **Never say how the session went.** No result reaches you — not net chips,
  not won-at-showdown, not a pot list. That is deliberate. Do not ask for it,
  do not reach for `--mode pots`, and do not imply a direction you cannot know.
- **Only `meta.window` may be described.** `meta.archive` tells you how thin
  the slice is — it is not yours to narrate.
- **Never coach opening frequency.** `rfiFolds[]` is the carve-out: those are
  per-hand facts and sound at n=1.
- **Never quote a `byBoard.splits` percentage.** Direction only, with the
  caveat attached.
- **A group ships five instances, not all of them.** `instances` is the true
  count and `stride` says how the five were picked. When a group looks like a
  real pattern and five is not enough to argue from, re-run with `--label
  <name>` for every instance. Never read the five as the whole.
- **Two of the same mistake beat one of each.** When a `labels[]` group has a
  non-empty `shared`, or `rfiFolds[]` has more than one entry, say what they
  share — seat, depth, texture, hand family. The shared thing is the finding;
  the count is not.
- **At most three findings. Fewer than three is a correct output.** Say nothing
  rather than reach for a third.

## Write

Append each session's findings to `leaks-log.md` (gitignored) under a dated
heading, and give the user a short summary in chat — the log is the record, the
chat is the conversation.
