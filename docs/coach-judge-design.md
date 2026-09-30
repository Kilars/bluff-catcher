# Coach judge backend — design (for review)

The one part left before the harness coaches on real data
(`docs/coach-harness-handover.md`): a **real backend behind the `Judge` port**.
This is the design under review — not yet built.

## The seam it fills

`Judge.evaluate(brief: FamilyBrief): Promise<FamilyVerdict>` (`src/lib/hh/judge.ts`).
Input and output shapes already exist; `validateFamilyVerdict` already enforces the
contract at the seam (family match, every instance judged exactly once, verdict/severity
agreement, refs cited from the brief, throughline evidence = leaks). The stub returns
all-`fine`. We add one more implementation of the same interface — nothing else in the
pipeline changes.

## Decisions taken (from the handover's open list)

- **Which model / hosted vs local:** hosted Anthropic API. Default model
  `claude-opus-4-8` (poker-strategy correctness is intelligence-sensitive), overridable
  via `ANTHROPIC_MODEL`. Credential from `ANTHROPIC_API_KEY` in the environment.
- **How many calls:** one call per family (the current shape). Families are few (4) and
  each brief already samples ≤5 instances per spot, so a family fits one call comfortably.
- **SDK vs raw HTTP:** the official `@anthropic-ai/sdk` (a project-instruction default),
  added as a **devDependency** and imported only from the Node judge module — never from
  the React/PWA bundle, so the browser build is untouched. (`probe-typesafe.ts` used raw
  `fetch`; that was a throwaway probe, not the pattern to follow here.)

## Shape

New file `src/lib/hh/anthropicJudge.ts`:

```ts
export function anthropicJudge(opts?: {
  apiKey?: string;      // defaults to process.env.ANTHROPIC_API_KEY
  model?: string;       // defaults to process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8'
  client?: Anthropic;   // injectable for tests — no network in unit tests
}): Judge
```

- Fails loudly at construction if no API key (so the CLI errors before parsing hands,
  not mid-run).
- `evaluate(brief)`:
  1. Serialise the `FamilyBrief` as the user message (JSON — it is already blind).
  2. A frozen system prompt carries the coaching contract (below).
  3. **Structured output** via `output_config: { format: { type: 'json_schema', schema } }`
     forces the `FamilyVerdict` shape. `severity` is `enum: [0,1,2,3,4,5]` (numeric
     min/max isn't supported by structured outputs); `verdict` and `label` are enums;
     `throughline` is `anyOf: [object, null]`. Schema is **static** across families (label
     enum = all `LABELS`) so the 24-h schema-compile cache is reused.
  4. `thinking: { type: 'adaptive' }`, `max_tokens: 16000` (non-streaming; one family's
     output is small).
  5. Parse, return the `FamilyVerdict`. **No validation here** —
     `validateFamilyVerdict` at the call site is the single enforced seam.

## The system prompt (the one guard a static test can't cover)

The handover's "one hole": the model's own prose (note, throughline) could restate a
result. The prompt contract must forbid it:

- You grade poker decisions from **blind facts only**. You never know the outcome — not
  the result, not villain's cards, not whether a bet was called or the pot was won.
- **Never reference** chips won/lost, net result, showdown outcome, or whether a bet got
  called/folded to. Coach the *decision* on the information available when it was made.
- Judge every instance you are given, citing it by its exact `ref`.
- A `note` must say something specific about *that* instance (cards, board, sizing, the
  enriched number) — no generic platitudes.
- Read the `cues`/`unless` rubric per spot; `unless` is a brake — do not coach a bet where
  checking is standard.
- Emit a `throughline` only when a real pattern spans ≥2 leaks in the family.

## CLI wiring (`scripts/leaks.ts`)

- `--judge` accepts `stub | anthropic` (was `stub` only).
- `anthropic`: construct `anthropicJudge()`; on missing key, `die()` with a clear message.
- **Per-family isolation** (handover deferred finding — a flaky live model shouldn't abort
  a whole run): wrap each family's `evaluate` + `validateFamilyVerdict` in try/catch;
  on failure, log the family + error to stderr and continue with the other families,
  rather than throwing out of the loop. A degraded run reports what it could judge.

## Tests

- Unit: inject a fake `client` returning a canned parsed message; assert the judge maps it
  to a `FamilyVerdict` and that it passes `validateFamilyVerdict` against the fixture brief.
- Unit: missing API key throws at construction.
- No network in the test suite. A live smoke is manual (`--judge anthropic` on real hands).

## Explicitly out of scope (deferred, per handover)

Sampling-vs-ranking normalisation, adding villain position / draw type to the payload,
turn-street coverage, the sit-out/away-fold detector. None block a first real run.

## Decisions after 5-reviewer round

- **Fail loud, no silent degradation.** Any judge failure (auth, 4xx, exhausted
  retries, malformed/refused output, blindness breach) **aborts the whole run** with a
  clear stderr message naming the family. Rationale: a skipped family renders as `clean`
  in `renderCoachJson` (`fv?.verdicts ?? []`), so "degraded but continuing" would emit
  false negatives — worst of all on a bad API key, where every family would read clean.
  Per-family resilience with an explicit `unjudged` marker in the payload is deferred.
- **Schema:** `severity` = `{ type: 'integer', enum: [0..5] }`; every object carries
  `additionalProperties: false` (incl. the non-null `throughline` branch), or it 400s.
- **Response handling:** `create()` + `JSON.parse` of the text block (validation is at the
  seam). Throw on `stop_reason` refusal/max_tokens or a missing text block.
- **Thinking budget:** `effort: 'medium'` bounds adaptive thinking so `max_tokens: 16000`
  non-streaming doesn't truncate.
- **Blindness backstop:** `assertBlind(verdict)` in `judge.ts` scans note/throughline prose
  for a conservative set of outcome frames ("villain had", "won the pot", "got there", …)
  and throws on a hit — a tripwire behind the prompt contract, enforced at the same seam
  as `validateFamilyVerdict`.
- **Prompt:** cue-anchored notes (name the enriched value the cue points at), hypothesis
  framed as testable-not-confirmable, `unless` checked first and overriding the thesis,
  severity anchored to EV/stack at risk, per-instance independence, throughline only across
  ≥2 spots.

## Open questions for the reviewers

1. Is one call per family right, or does per-instance calling buy enough precision to
   justify the cost/latency? (Current: per family.)
2. Is structured output the right lever, or should we use tool-use / plain JSON parse with
   a retry? Structured output can't express the verdict↔severity coupling — that stays in
   `validateFamilyVerdict`. Acceptable?
3. Does per-family isolation hide systemic failures (e.g. bad key) behind "degraded"? Should
   auth/4xx errors be fatal while 5xx/malformed are per-family-skippable?
4. Blindness: is the prompt contract enough, or do we also want a post-hoc scan of the
   model's `note`/`throughline` prose for outcome words (chips, won, called, folded)?
