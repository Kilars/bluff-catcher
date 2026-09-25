# Coach harness — handover: what remains

Branch: `feat/coach-reshape` (not merged). Scope-level notes, not implementation
detail. The spine and the reshape are done and green (871 tests); this is the
list of parts still needed before the harness can coach on real data locally,
plus the decisions that gate them.

## Where it stands

The pipeline runs end to end: labelled decisions → blind family briefs → the
`Judge` port → a wrongness-ranked, results-blind payload. Only the **stub judge**
is wired, so every hand comes back `fine` — the harness proves it runs, it does
not yet coach.

There are two ways to get coaching out of this repo, and only one of them needs
more building:

- **Model-reads-the-payload** (the `hand-review` skill): the CLI emits the blind
  payload and a model (or a person) coaches from it. This works today.
- **Harness-judges-itself** (`--judge <backend>`): a model sits behind the
  `Judge` port and the harness produces the coaching. This is what remains.

## The one blocking part: a real judge backend

Everything else is optional polish. To "run it like this" with the harness doing
the judging:

1. **A backend behind the `Judge` port.** Takes a family brief, returns a family
   verdict. The port, the blind input, the per-instance verdict shape, and the
   validation gate all exist — this is filling in the one seam, not new
   architecture.
2. **CLI access to it.** `--judge` currently accepts only `stub` by design; open
   it to the real backend and fail loudly when its prerequisites (e.g. an API
   key) are missing.
3. **Local run story.** Decide how it runs on your machine — hosted model call
   vs. a local model — and where the credential comes from. This is the piece
   that makes "locally like this" concrete.

## Decisions that gate the above (need you)

- **Which model, hosted or local.** Drives the credential/network story and cost.
- **How many calls.** One judgment call per family is the current shape; per-hand
  would be more precise and more expensive. Tied to the sampling item below.
- **Merge timing.** Land `feat/coach-reshape` on main before or after the backend.

## Deferred findings to fold in (from the two review rounds)

None block a first run; each sharpens it.

- **Sampling vs. ranking.** Wrongness is measured on the ≤5 sampled instances a
  spot ships, while the payload still reports the true total. A 40-instance spot
  is judged on 5. Decide: send all, or normalise the score by the sample.
- **Live-backend resilience.** A single malformed verdict currently aborts the
  whole run. Fine for the stub; a flaky live model needs per-family isolation
  and a degraded-but-continuing result.
- **Note specificity.** The per-hand note is free text. It is only forced to
  *cite* a hand, not to *say* anything specific about it — the prompt (and
  possibly a more structured note) has to carry that weight.
- **Facts the rubric leans on but can't verify.** The counter-conditions talk
  about villain position and draw type; the payload doesn't yet carry either, so
  the model reconstructs them. Adding them removes that burden.
- **Turn coverage.** The taxonomy jumps flop → river. Turn barrel give-up,
  over-folding to bets, and the in-position check-back were deferred; add on
  evidence.

## Gap found when pointed at real data

- **Sit-out / away-from-table folds look like a folding leak.** A run of
  first-in folds of premium hands across one tournament with a descending stack
  is almost certainly a disconnect or sit-out, not strategy. The harness surfaces
  these as chart-fold findings with no way to tell them apart. A detector for
  "consecutive folds, descending stack, one tournament" — or a caveat on the
  cluster — would stop the strongest-ranked finding from being a false positive.

## Guardrails to preserve while finishing

- **Blindness.** No result reaches the model. Enforced by the payload key-scan,
  the action-line value-scan, and the street cut. Don't add a field or a note
  path that carries an outcome.
- **The one hole a static test can't guard.** The model's own prose (note,
  throughline) could restate a result. The backend's system prompt must forbid
  referencing chips, net, or whether a bet was called — this is a prompt
  contract, checked at integration, not by a unit test.
