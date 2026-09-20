---
name: hand-review
description: Coach a session from the local GGPoker hand-history archive. Use when the user asks to review their hands, look at a session, find leaks, or asks what they played badly. Runs the leaks CLI and coaches from its JSON payload.
---

# Hand review

Coach from the report. Never from the hands.

## Run

```bash
npm run leaks -- --json --from YYYY-MM-DD --to YYYY-MM-DD   # both optional
```

No path argument: `hands/` is the default and is read recursively. Both dates
are inclusive and either works alone. With no window, the whole archive is
reported on — say so.

Read `docs/leak-coaching.md` before writing anything; it holds the bands, the
finding catalogue and the output contract.

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
- **Two of the same mistake beat one of each.** When `rfiFolds[]` has more than
  one entry, say what they share — seat, depth, hand family. The shared thing
  is the finding; the count is not.
- **At most three findings. Fewer than three is a correct output.** Say nothing
  rather than reach for a third.

## Write

Append each session's findings to `leaks-log.md` (gitignored) under a dated
heading, and give the user a short summary in chat — the log is the record, the
chat is the conversation.
