---
name: kb-review
description: Handle what the coach knowledge base's autoreview couldn't decide, and veto anything it merged. Use when the user says kb-review, asks about escalations, wants to see what the KB learned, or wants to undo a merged claim.
---

# KB review: escalations and vetoes

`kb-autoreview` (Opus, nightly) approves or rejects staged claims on its own.
This skill is the user's window into that. The user isn't a poker expert, so
explain everything in plain language and always recommend.
`KB=research/coaching-transcripts`. See `research/nightly-kb-plan.md`.

## 1. What changed

Summarise `$KB/kb/review-log.md` since the last `kb-review` line in
`$KB/digest.md`:
- counts per family
- the 3–5 merged claims most likely to change the user's play (a 6-max cash
  regular)
- any rejection pattern, e.g. one channel failing the cash-fit check again
  and again, which may mean dropping it from `research/kb-channels.md`

## 2. Escalations

For each item in `$KB/kb/escalations.md`, ask with AskUserQuestion (at most 4
options, several questions per call). Put the recommended option first. A
possible repo fix (the charts in `src/lib/preflop/` or the strategy notes look
wrong) is a dev-hat change. Offer to make it, but don't make it here. Remove
each item from the file once it's decided, and log the decision in
`review-log.md`.

## 3. Veto

If the user wants to undo something, remove the bullet (or the one citation)
from the brief and log `VETO` in `review-log.md` with the reason.

## Also

- `$KB/kb/label-proposals.md`: mention new ones. Applying them is dev-hat
  work with per-item approval.
- If `state.json` is paused and the user wants more, set `paused: false` and
  `lowNoveltyStreak: 0`. Suggest adding channels if the pause came from
  saturation.

Finish by prepending a line to `$KB/digest.md`: `kb-review <date>: <n>
escalations decided, <v> vetoes`.
