---
name: hand-review
description: Coach a session from the local GGPoker hand-history archive. Use when the user asks to review their hands, look at a session, find leaks, or asks what they played badly. Runs the leaks CLI and coaches from its JSON payload.
---

# Hand review

Coach from the report. Never from the hands.

## Run

```bash
npm run leaks -- --json --from YYYY-MM-DD --to YYYY-MM-DD   # both optional
npm run leaks -- --mode pots --json --from … --to …
```

No path argument: `hands/` is the default and is read recursively. Both dates
are inclusive and either works alone. With no window, the whole archive is
reported on — say so.

Run `leaks` first, then `pots`. Read `docs/leak-coaching.md` before writing
anything; it holds the bands, the finding catalogue and the output contract.

## Hard rules

- **Never read `hands/`.** The JSON payload is the only input. It is already
  stripped of villain hole cards and the board stops where Hero stopped.
- **Never state a number that is not in the payload.** Code counts; you read.
- **Only `meta.window` may be described.** `meta.archive` tells you how thin
  the slice is — it is not yours to narrate.
- **Never coach opening frequency.** `rfiFolds[]` is the carve-out: those are
  per-hand facts and sound at n=1.
- **Never quote a `byBoard.splits` percentage.** Direction only, with the
  caveat attached.
- **At most three findings. Fewer than three is a correct output.** Say nothing
  rather than reach for a third.

## Write

Append each session's findings to `leaks-log.md` (gitignored) under a dated
heading, and give the user a short summary in chat — the log is the record, the
chat is the conversation.
