# Plan: close the postflop label-coverage gap

## Why

The label catalogue has a **structural** gap, independent of any one session:
it models only the **flop** and **river**, and only Hero's **own initiative**
(betting/checking) — never the **turn**, and never **facing** a bet (bar one
river call, `river-call-marginal`). This is verifiable by reading `labels.ts`,
not inferred from a sample: no predicate references the turn, and only
`river-call-marginal` is gated on `d.facedBet` (labels.ts:141).

The real 354-hand cash session made the gap visible — 63% of postflop hands
(29/46) got no label, 17 of them at turn/river — but that session is the
*symptom*, not the *justification*. We add coverage because the axes (turn;
facing aggression; river raises) are missing by construction. The session's
hand counts and any pool-specific lean are treated as **unmeasured calibration
inputs**, not as load-bearing evidence (see Overfitting guard below).

Families today (`priority.ts:42`):
- PFR flop passivity → `pfa-check-flop`, `check-draw`
- Caller aggression → `donk-bet`, `check-raise-flop`
- River bluffing → `river-bluff-with-blocker`, `river-bluff-no-blocker`
- River value / bluff-catch → `river-call-marginal`, `river-check-value`, `overbet-strong`

## The three buckets — defined by predicate, not by hand list

Buckets are defined by the **predicate** each new label fires on, so a hand
that fires two predicates across two streets simply carries two labels
(`labelledDecisions` already emits one decision per action and `labels: string[]`).
The earlier hand-by-hand assignment was dropped because it forced a false
1-hand-to-1-bucket partition — e.g. an AQ hand that gave up the turn as PFR
*and* folded to a raise has a legitimate claim on two axes. Counts below are
indicative of where signal was seen, not a partition.

### Bucket 1 — Turn barreling → extend *PFR flop passivity* / *Caller aggression* to the turn
Hero keeps or surrenders the initiative one street past where any label looks.
- **Add `pfa-check-turn`**: Hero was PFA, **bet the flop**, then **checked the
  turn** (a near-copy of `pfa-check-flop`, one street later). The "bet flop"
  condition needs a new per-street set in `labelledDecisions`, mirroring the
  existing `checkRaised`/`checkedThrough` sets (labels.ts:172-180); it is *not*
  a field on `Decision`. Without the "bet flop" gate the name lies — a turn
  check after a flop check is not surrendering initiative, it was already gone.
- **Add `turn-probe`**: caller bets the turn after the PFR **checked back the
  flop** (betting into a *declined* c-bet — the strict meaning of "probe"). If
  it fired on any caller turn lead it would be a `turn-lead`/`donk`, not a probe;
  pin the "PFR checked back flop" condition or rename.

### Bucket 2 — Folding to a barrel → **new family** *Facing aggression (over-folding)*
The real structural hole: three families cover Hero's aggression; only
`river-call-marginal` covers defence, and it covers only the *call*. **This
family is scoped to folds only.**
- **Add `fold-to-turn-barrel`** and **`fold-to-river-barrel`**: Hero folds
  facing a bet on that street. "Barrel" is load-bearing — it asserts the
  villain **also bet the previous street** (a continued bet). The predicate
  must require prior-street villain aggression (via the `bettor`/`facedBetEver`
  street play), not merely `d.facedBet` on the current street. If we decide not
  to require prior aggression, rename to `fold-to-turn-bet`/`fold-to-river-bet`.
- **Do NOT** pull river bluff-catch *calls* into this family. `RC4837994125`
  (Q♦J♦ TPGK) is a river call and already belongs to `river-call-marginal` in
  "River value / bluff-catch". Keeping folds-only leaves each family's
  `HYPOTHESIS` single-claimed ("Hero over-folds to barrels" vs. "Hero
  mis-bluff-catches" are two different claims and must not share a family).

### Bucket 3 — River raises → extend *River value/bluff-catch* + *River bluffing* to **raise**
Every river label models bet/check/call; none models raising over a bet.
- **Add `river-raise-value`** and **`river-raise-bluff`**: `d.street === 'river'
  && d.kind === 'raise' && d.facedBet`, split by hand class (value vs. air),
  mirroring the existing river bet/bluff split.

## Predicate contracts (pin each name to its exact boolean)

The `firstInOpp` trap — a name asserting more than the boolean checks — is the
repo's known failure mode. Every new label states its contract here, reviewed
before it is written. All predicates read `Decision` fields (decisions.ts:11-33)
and the per-street sets built in `labelledDecisions`. **Use `Decision.facedBet`
(decisions.ts:22/95 — reads the street as printed, catches check-then-fold), NOT
`StreetPlay.facedBet` (which means "first to act into a bet" and misses the
commonest way to face a c-bet, per decisions.ts:35-46).**

| Label | Contract | Naming claim it must honour |
|---|---|---|
| `pfa-check-turn` | `d.pfa && d.street==='turn' && d.kind==='check' && betFlop.has(hand) && !checkRaised.has('turn')` | Had initiative, took the c-bet, then checked turn — not "never bet". Excludes a turn check-raise. |
| `turn-probe` | `!d.pfa && d.street==='turn' && d.kind==='bet' && pfaCheckedFlop` | Caller bets into a **declined** c-bet. Not any turn lead. |
| `fold-to-turn-barrel` | `d.street==='turn' && d.kind==='fold' && d.facedBet && villainBetFlop` | Villain **barrelled** (bet prev street too), Hero folded. |
| `fold-to-river-barrel` | `d.street==='river' && d.kind==='fold' && d.facedBet && villainBetTurn` | As above, river. |
| `river-raise-value` | `d.street==='river' && d.kind==='raise' && d.facedBet && (hand==='strong'\|\|hand==='marginal-made')` | Raised over a bet with a made hand. |
| `river-raise-bluff` | `d.street==='river' && d.kind==='raise' && d.facedBet && hand==='air'` | Raised over a bet as a bluff. |

The `betFlop` / `pfaCheckedFlop` / `villainBetFlop` / `villainBetTurn` sets do
not exist yet and are the only genuinely new *derivation* work; all are
computable in `labelledDecisions` from `h.streets` (`StreetPlay.bet`, `bettor`,
`facedBetEver`) exactly as `checkRaised`/`checkedThrough` are today. No parser
or `enrich` change is required.

### Multiway caveat
`facedSizing`/`mdf`/`requiredEquity` derive from Hero's single `toCall` over the
pre-bet pot (decisions.ts:80-84). That is exact heads-up but mis-scales when
villains act between the bet and Hero (some target hands are 3-way, e.g.
`RC4834994667`). For a clean bet→Hero sequence the math is right; for
bet-call-ahead-of-Hero it is lossy. Either guard the fold/probe predicates to
the heads-up-to-Hero case or state the limitation in the rubric `unless`. The
plan must not be silent on multiway.

## The data layer already supports all of this

Confirmed by review against source. `StreetPlay` (hero.ts:25-69) exposes per
street: `bet`, `checked`, `raised`, `checkRaised`, `facedBet`, `facedBetEver`,
`bettor`, `spr`. `enrich.ts:57-68` computes `requiredEquity`, `mdf`,
`sprCommitment`, `boardFavoursPfa`. `Decision` (decisions.ts:11-33) carries
`facedBet`, `facedSizing`, `sizing`, `pfa`, `spr`, `kind` (which already
includes `fold` and `raise`). The turn is fully parsed and exposed per street
(`hero.ts:321`, `board.ts:20`). `BOARD_SEEN` cuts the board at the decision
street (turn=4, river=5), so no unseen card leaks backward (labels.ts:184).

Correction to the earlier draft: `facedSizing` is a `Decision` **input**
(decisions.ts:31/80-84), not something `enrich` computes; and `HYPOTHESIS` lives
in `rubric.ts`, not `priority.ts`.

## Full file set per bucket — each bucket is ONE atomic change

The earlier "confined to `labels.ts`/`rubric.ts`/`priority.ts`, add predicate
first and wire later" framing was wrong. `LABELS`, `BASE_PRIORITY`
(`Record<Label, number>`, priority.ts:23), `RUBRIC` (`Record<Label, Rubric>`,
rubric.ts:33) and `HYPOTHESIS` (`Record<Family, string>`, rubric.ts:107) are
**total records**, so a new label name is a compile error until every table is
filled. And two tests pin the catalogue exhaustively:
- `priority.test.ts:39-44` asserts `FAMILIES` partitions `LABELS` exactly — a
  label cannot land without its family wiring in the same change.
- `doc.test.ts:172-177` pins `LABELS` bidirectionally to the label bullets in
  **`docs/leak-coaching.md`** — a new label with no matching `- **\`name\`** —`
  bullet turns the suite red.

So each bucket is a single atomic commit touching:

1. `src/lib/hh/labels.ts` — predicate in `labelsFor`, any new per-street set in
   `labelledDecisions`, name in `LABELS`.
2. `src/lib/hh/rubric.ts` — `RUBRIC` entry (`cues` + `unless`); for Bucket 2 the
   new `HYPOTHESIS` entry.
3. `src/lib/hh/priority.ts` — `BASE_PRIORITY` weight; for Bucket 2 the new
   member of the `Family` union (priority.ts:35-39) and `FAMILIES` (priority.ts:42).
   `FAMILY_OF`/`familyOf` derive automatically; `packet.ts`/`report.ts`/`judge.ts`
   are `Family`-generic and need no change.
4. `docs/leak-coaching.md` — the label bullet(s). **This is a required deliverable**
   and a behavioural change to the LLM coach's grounding, not just internal docs.
5. `src/lib/hh/labels.test.ts` — new `CASES` rows (see Test strategy).
6. `src/lib/hh/priority.test.ts` — partition assertion updated for Bucket 2's
   family; new labels' weights.

Bucket 2 additionally changes coaching **output shape**: a new family with two
labels can fire its own `throughlineHolds` (priority.ts:175, ≥2 distinct leaking
labels) and `familyRelevance` (priority.ts:139). Treat that as a behavioural
change with its own acceptance criteria, not merely added coverage.

## Test strategy — committed fixtures, not a CLI run on gitignored data

The real hands live in `hands/cash/` which is **gitignored**, so
`npm run leaks -- hands/cash --json` is a local smoke check only — it is not
reproducible, cannot run in CI, and must **not** be the recorded proof a bucket
works. Follow the existing precedent instead:

- **Synthetic `CASES` rows** in `labels.test.ts` (like `CHECK_CALL`,
  `CHECK_RAISE`): inline heads-up histories asserting the *exact* label set per
  decision on the target street. This is the primary proof.
- **Anonymised committed fixtures** under `src/lib/hh/fixtures/rc/` for buckets
  where texture/SPR realism matters (Bucket 2 fold-to-barrel especially),
  following the `cash.test.ts` + `fixtures/rc/session.txt` pattern that
  sanitised and committed 4 real hands precisely for reproducibility.

**Regression gates (add to definition-of-done):**
- Existing `CASES` `want` arrays in `labels.test.ts` are **frozen**. If a new
  predicate legitimately fires on an existing fixture, that is a reviewed spec
  change, not a silent edit — the file's own header says "a label that starts
  firing where it should not fails here".
- The results-blindness sweep (labels.test.ts / doc.test.ts:69-83) runs per
  bucket, since new per-street sets could reintroduce a money/outcome key.

## Baseline — fence the red typecheck before starting

`npm run typecheck` (tsconfig.app.json) is **red today** on pre-existing
coach-judge WIP (`packet.ts` `Removal[]`→`string[]`; `judge.test.ts` /
`priority.test.ts` `Severity`/`ref`), unrelated to this work. `priority.ts` and
`priority.test.ts` are in this plan's footprint, so new red would be
indistinguishable from inherited red — and vitest is green (895/895) while `tsc`
is not, which is a false-confidence trap. Before Bucket 1:
- **Preferred:** get those errors green (or stash/commit the WIP) so the label
  work builds on a green typecheck.
- **Fallback:** if the WIP is out of scope, record the exact expected
  pre-existing `tsc` error list so the implementer can diff against it.

## Sequencing (cheapest / highest-value first)

1. **`pfa-check-turn`** (Bucket 1) — near-copy of `pfa-check-flop`; proves the
   turn-label pattern (new per-street set + turn predicate + fixture) end to end
   with the least new code. Do first.
2. **River raises** (Bucket 3) — `raised && facedBet` on the river is a clean
   predicate; extends existing river families, no new family.
3. **Facing aggression family** (Bucket 2) — most design work (new family, new
   hypothesis, barrel semantics, over-folding direction, output-shape change).
   Code lands **last**, but **front-load its rubric/guardrail design** now: the
   fold-label `unless` and blindness check are the hardest judgement in the plan
   and must not be improvised at the end.

## Overfitting guard

- The *structural* claim (missing turn / facing / raise axes) is verifiable in
  `labels.ts` and holds on any dataset — adding the predicates is safe.
- What is at risk of overfit is *calibration*: bucket sizes, new `BASE_PRIORITY`
  weights, and Bucket 2's over-fold lean. `BASE_PRIORITY` already carries a
  `TODO: calibrate against the videos … not measured bb/100`; new weights
  inherit that unmeasured status. Set them **conservatively** and defer tuning
  to the same video-calibration TODO, not to these 17 hands.
- The system self-protects: `sharedFacets` yields nothing below n=2
  (labels.ts:219-227) and `throughlineHolds` needs ≥2 distinct leaking labels,
  so a thin/new label surfaces no fabricated rule. That is *why* adding a family
  on structural grounds is cheap even if this session's signal is weak.

## Guardrails (must hold)

- **Results-blindness.** New labels feed the same blind packet; never leak
  outcome. `BOARD_SEEN` already cuts the board per street. **Fold labels are the
  sharpest new risk**: the honest question is "given the price
  (`facedSizing`→`requiredEquity`/`mdf`) and showdown class, was folding
  defensible", never "you folded the winner". Their `cues` must be gated on
  price + hand class only, and their `unless` must include an explicit "a fold
  can be correct — do not assume over-fold" brake (mirroring `NOT_THE_NUTS`).
  Confirm the packet never carries what the fold folded to.
- **Never coach opening frequency.** The `rfiFolds` n=1 preflop carve-out stays
  the only preflop check; all new labels are postflop. The turn barreling labels
  must inherit `pfa-check-flop`'s discipline — name a *specific decision with its
  texture*, never a rate ("barrel more turns" is banned).
- A label is a candidate, not a verdict — the judge / `unless` decides.

## Open questions

- **Over-fold lean (resolved to a direction, magnitude deferred).** The
  direction is **inherited**, not open: `river-call-marginal`'s rubric already
  states the small-stakes pool under-bluffs and over-folding is the more common
  leak. Adopt that lean verbatim for `fold-to-*-barrel` for consistency; only
  the *magnitude* wants more hands to validate. It does not block Bucket 2.
- **Turn texture (deferrable).** `boardFavoursPfa`/`boardType` are deliberately
  flop-derived on every street (board.ts:42, labels.ts:36-41), and `byBoard`
  groups on that cut, so a `pfa-check-turn` reusing flop texture is *consistent*
  with `pfa-check-flop`. A turn-card-aware texture read is a v2 refinement, not
  a blocker.
