# Coaching harness design — 8-agent research synthesis

Question: **after labelling, what does the harness do so a coach reads well —
even with a weak model?** Owner's principles: keep deterministic as long as
possible; spend the LLM only on final judgement, fed a rich per-scenario packet;
frame positively ("do this"), not as a wall of prohibitions; the harness should
be good enough that the model barely matters.

The 8 proposals are **complementary layers**, not alternatives. They stack:

```
PER-LABEL BRIEFS  →  ENRICHMENT      →  PACKAGING  →  CONSTRAINED TASK  →  DOCS
  L0 (from corpus)    A1 decision-math   A3 packets    A8 verification     A7 rule reframe
                      A5 pattern-detect                A6 output template  A4 output UX
                      (A2 folded into L0)
```

Everything up to the model gets more deterministic; the model's job shrinks from
"generate coaching" to "verify a pre-assembled scenario and argue one instance,
with an expert brief for that exact situation in hand."

### Owner refinements (confirmed)

- **Packet granularity = the whole label GROUP, not one hand.** The coach
  analyzes the label/pattern (all instances, `shared`/`dominantCell`), arguing
  one representative hand out loud. Bundle **related labels into families** where
  coaching them as one theme is more productive:
  - caller aggression: `donk-bet` + `check-raise-flop`
  - river bluffing: `river-bluff-with-blocker` + `-no-blocker`
  - river value / bluff-catch: `river-call-marginal` + `river-check-value` + `overbet-strong`
  - PFR flop passivity: `pfa-check-flop` (+ `check-draw`)
- **L0 — per-situation coaching briefs, authored from the mined corpus.** The
  transcript work (notes/*.yaml, synthesis) gets reorganized **by label instead
  of by video** into one brief per label/family: how real coaches reason about
  that exact spot, every claim cited to `{video, ts}` + strategy-notes. Loaded on
  demand — the skill `Read`s only the briefs for labels that appeared. This is
  the richest form of the "reference" idea (A2 folds into it) and the reason a
  weak model coaches well: the expertise lives in the doc, not the weights.
  Authoring is a synthesis pass, likely one subagent per label/family.

---

## The layers

### 1 — Deterministic enrichment (pre-compute what the model would otherwise reason out)

- **A1 Decision-math layer.** Attach `requiredEquity` (`B/(P+2B)`), `alphaFacing`,
  `mdfFacing`, `alphaOwn` (= `sizing/(1+sizing)`), `sprCommitment`
  (committed/semi/deep), `boardFavoursPfa` to each decision. The model reads
  numbers instead of doing arithmetic — the exact thing weak models botch
  silently. Cost: surface `potBefore`/`facedSizing` in `decisions.ts`; ~6 helper
  fns in `report.ts`; rewrite `leak-coaching §5` from "compute" to "read".
  **Highest value / lowest risk / most clearly deterministic.**
- **A2 Reference-line lookup.** Pre-join the "standard line here" from
  `strategy-notes.md` tables (c-bet freq by texture, BB check-raise freq, donk
  by texture, bluff-selection by street) keyed by `boardType`/`street`/
  `handClass`. Model *compares* fact-vs-reference instead of recalling theory.
  Cost: new `reference.ts` lookup, optional `reference` field. **Risk:** a
  "standard line" next to a fact smuggles a verdict — guard with A2's own test:
  *the reference must read the same on a well-played and a badly-played
  instance.* Overlaps A1's `boardFavoursPfa` — fold them together.
- **A5 Pattern detection.** Compute patterns instead of asking the model to spot
  them across a stride-sample it can't fully see: `dominantCell` ("6 of 8
  donk-bets on dry-high"), `tightCluster` (densest 2-facet subset when `shared`
  is empty), cross-label hand-class convergence, `sizing/sprSpread`. Stays clean
  on the "no denominator" rule — ratios are within a label's own cohort, never an
  invented opportunity count. Cost: extend `labelGroups` + `renderJson`.

### 2 — Packaging

- **A3 Scenario-packets.** Restructure the coach-facing payload: one
  self-contained, **pre-ranked** packet per finding, with `baseline` and
  `textureSplit` inlined (no cross-referencing), a deterministic plain-language
  `restatement`, and only the decisions it needs. Moves "cite these fields / rank
  these / join byBoard" out of prose rules into the shape of the data. Cost:
  bigger `report.ts` refactor + skill + `doc.test.ts`; changes the JSON contract.
  This is the *container* the enrichment fills.

### 3 — Constrained model task

- **A8 Verification-over-generation.** Per-label closed question batteries
  ("`donk-bet`: is `boardType` == `middling-theirs`? → defensible clause; ==
  `dry-high-mine`? → leak clause"). Model answers each from a named field, cites
  it, and the verdict assembles from pre-written clauses. Directly matches the
  owner's own phrasing — "check all labels and groups, is it good?" Models verify
  better than they generate. Honest gaps named (thin-value overbet, ambiguous
  blocker direction) stay judgement. Cost: battery text in `leak-coaching §4`.
- **A6 Output template.** Fill-in slots, not prose: quote-the-field-before-any-
  claim, enumerated `fix` vocabulary, explicit `EMPTY`/`NO Nth FINDING` states.
  Fabrication becomes structurally awkward. Cost: rewrite `§7` as a form.
- **Shared caution (A4 + A6):** do **not** template the argument prose itself —
  mad-libs kill the one thing models do well. Structure the *claim type and
  evidence anchor*; leave the *reasoning* free.

### 4 — Docs / output

- **A7 Guardrail audit.** Classifies every rule principled vs generic. **Cut**
  "max 3 findings" (→ quality gate: emit what you can argue, fewer or more is
  fine), **cut** "always close MINDSET-ONELEAK" (→ conditional), **cut**
  MINDSET-PROCESS (filler). **Keep but rephrase as positives** the load-bearing
  ones: results-blindness, label-is-a-fact, no-villain-cards, thin-stat,
  window-not-archive. Restructure so the doc leads with "what a finding is / what
  you do," not a prohibition checklist.
- **A4 Output UX.** Recommends annotated-findings format, **quality gate over
  count cap**, and a **conditional drill loop** ("play 200 hands on this one
  thing, re-run with `--label`, did it move?"). Same cuts as A7 — independent
  agreement.

---

## Synthesis / my read

- A7 + A4 agree independently and hit the owner's actual complaint. Lowest risk,
  do first regardless.
- A1 is the purest expression of the owner's principle (push the exact thing weak
  models fail — arithmetic — into the harness). Do it.
- A5 dominantCell is clean and high-value; the rest of A5 is nice-to-have.
- A2 is valuable but carries the only real conceptual risk (verdict-smuggling);
  fold `boardFavoursPfa` into it so there's one "standard here" encoding.
- A3 packets is the right container but the biggest refactor — sequence it after
  enrichment so it packages something.
- A8 batteries are the strongest robustness mechanism and match the owner's
  words; A6 template is good if kept to evidence/claim-type and not the argument.
  Going all-in on both A8 + rigid A6 risks over-constraining — pick the level.

**Suggested spine:** reframe docs (A7/A4) → enrich decision-math (A1) →
patterns (A5 dominantCell) → verification batteries (A8) → packets (A3) →
reference-lines (A2) last, once the fact/reference boundary is proven.

Open decisions put to the owner separately.

---

## Decision log (confirmed)

1. **Docs reframe — full.** Rewrite `leak-coaching.md` positively; cut "max 3
   findings" → quality gate ("argue what you can, fewer or more is fine"), cut
   "always close MINDSET-ONELEAK" → conditional, cut MINDSET-PROCESS; keep the
   load-bearing invariants (results-blind, label-is-a-fact, no villain cards,
   thin-stat, window-not-archive) rephrased as positives.
2. **Enrichment = decision-math + pattern-detection.** Precompute
   `requiredEquity`/`alpha`/`mdf`/`sprCommitment`/`boardFavoursPfa` and the
   dense-cluster (`dominantCell`) detector. Reference-lines fold into L0 briefs.
3. **Model task = verification batteries.** Per-label closed questions answered
   from named fields; the argument stays free prose (don't template the reasoning).
4. **Packaging = scenario packets, group-level, family-bundled, sequenced later.**
   A packet carries the whole label group (not one hand); related labels bundle
   into a family; build after enrichment exists.
5. **L0 = per-family coaching briefs synthesised from the corpus**, reorganised
   by label/family (not by video), each claim cited `{video, ts}` + strategy-notes,
   loaded on demand.
6. **Families = 4 spot-based (unanimous 5/5 panel).**
   - PFR flop passivity: `pfa-check-flop`, `check-draw`
   - Caller aggression: `donk-bet`, `check-raise-flop`
   - River bluffing: `river-bluff-with-blocker`, `river-bluff-no-blocker`
   - River value / bluff-catch: `river-call-marginal`, `river-check-value`, `overbet-strong`
   Families are the **teaching container** (one brief each), not the unit of
   priority — see 7.
7. **Relevance = base-priority × evidence; base-priority is a per-LABEL number.**
   **Labels are the first-class unit — priority, families and briefs serve the
   labels, not the reverse.** Aggression is not a separate axis or a multiplier
   formula; it is *one input* to each label's base number: because the target
   player is an amateur who skews passive (confirmed by the two small-stakes
   videos `lSvyX-Ryi0M`, `4wGRlpNxDBs` — "apply pressure" is the real fix, vs the
   thin-river precision the 5 GTO videos over-weight), the missed-aggression
   labels (`pfa-check-flop`, `check-draw`, `river-check-value`) get higher numbers
   than the defensive one (`river-call-marginal`). `pfa-check-flop`'s IP instances
   carry the "not c-betting in position" signal via the `position` facet. Position is
   already a facet that `shared`/`dominantCell` surfaces when all instances share
   it — no dedicated multiplier. A family's session-relevance = max over its
   labels of (base × evidence); the family surfaces on its strongest label and
   the brief foregrounds it. Detection stays deterministic (stats bands already
   flag `cbetFlop`/`cbetTurn`/`aggFreq`/`threeBet` as `missed` with zero LLM).
   Corpus-prominence is *not* the driver — that over-weighted GTO river precision.
8. **No new label — reuse `pfa-check-flop` + the `position` facet.** IP passivity
   as the PFR (you raised, then checked in position, declining your c-bet) is
   already captured: `pfa-check-flop` fires IP and OOP, and `position` is a facet
   `shared`/`dominantCell` surfaces. The agent reads the IP instances against the
   deterministic `cbetFlop`/`aggFreq` bands and coaches "you're not c-betting in
   position" — no new label, no new code. **Parked:** the *caller* stab-back
   (villain checks to you IP, you check behind, `pfa==false`) is the only spot
   `pfa-check-flop` can't reach (it requires `pfa==true`). It's a marginal
   secondary spot; add a fact label (`check-back-flop-ip`) only if evidence later
   shows it matters. `missed-ip-stab` is dead: "missed" is a verdict the agent
   owns, not a fact the parser states.

### Still open
- The per-label base-priority numbers (a small hand-set table drawn from the two
  small-stakes videos, not a formula).
- Build order / phasing across layers.
