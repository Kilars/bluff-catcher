# Extract coaching notes — step 2

Turns each cleaned MTT transcript into structured notes. One **Sonnet** subagent
per transcript; humans read the notes, never the raw. Every entry cites a
timestamp. Feeds step 3 (synthesis → per-item approval → `labels.ts` /
`docs/leak-coaching.md`).

## How to run

Spawn one subagent **per file** in `research/coaching-transcripts/clean/`, in
parallel:

- Tool: `Agent` · `subagent_type: "general-purpose"` · **`model: "sonnet"`**
  (required — do not use opus/haiku for extraction; sonnet is the chosen tier
  for this bulk-read pass).
- `description`: `"extract coaching notes <ID>"`.
- `prompt`: the block below with `{ID}` and `{COACH}` filled from `manifest.md`.
- Each subagent writes exactly one file: `research/coaching-transcripts/notes/{ID}.yaml`
  and returns a 3–5 line summary (counts per section + anything notable). Nothing
  else is applied — no edits to code or docs.

Pilot set = every file in `clean/` (currently 7); read coach + title from
`manifest.md`. Includes two amateur/small-stakes common-mistake videos
(`lSvyX-Ryi0M` JL, `4wGRlpNxDBs` Aaron Baroni/Upswing) added to weight the
corpus toward the leaks recreational players actually make.

---

## Subagent prompt (pass verbatim, substituting {ID} / {COACH})

```
You are a Sonnet extraction subagent. Read ONE cleaned MTT poker-coaching
transcript and distil it into structured notes. You are mining how a recognised
coach actually coaches, to inform a hand-history leak-detector's rubric — you are
NOT coaching anyone and NOT judging any hand yourself.

INPUT (read it in full):
  research/coaching-transcripts/clean/{ID}.md
Coach: {COACH}   Video id: {ID}

OUTPUT (write exactly this one file, valid YAML, nothing else):
  research/coaching-transcripts/notes/{ID}.yaml

Mine four things:
  1. focus_order — the coach's attention hierarchy: which factors they reach for
     first and weight most, across the whole session.
  2. moments — per-decision coaching: the reasoning rubric (when a line is
     wrong / right, in the coach's own logic).
  3. candidate_labels — spots that could become a deterministic label.
  4. vocabulary — recurring terms/framing the coach uses.

SCHEMA:
  video: {ID}
  coach: {COACH}
  focus_order:            # ordered, most-emphasised first
    - factor: "stack depth (effective bb)"
      note: "opens most reads with it"
      src: "3:20"
  moments:
    - spot: "check the flop as PFR"     # the coach's own name for the spot
      street: flop|turn|river|preflop
      looks_at: ["board texture","range advantage","spr"]  # in the ORDER stated
      wrong_when: "concrete criterion in the coach's logic"
      right_when: "concrete criterion, or omit if not stated"
      priority: high|med|low            # how heavily the coach weights it
      labelable: yes|no|maybe
      predicate: "sketch over the fields listed below, or 'needs: <missing data>'"
      quote: "<=15 words verbatim from the transcript"
      src: "12:04"
  candidate_labels:
    - name: donk-bet
      predicate: "street=='flop' && pfa==false && kind=='bet' && !facedBet"
      fact_not_verdict: true            # states what happened, not a verdict
      attested: ["3:20","41:10"]
  vocabulary:
    - term: "capped range"
      means: "short gloss"
      src: "12:04"

HARD RULES:
  - Ground everything. Every entry needs a src timestamp that exists in the file.
    If you cannot cite it, do not write it.
  - Extract only what THIS coach actually says. Do not add standard theory the
    coach did not state, and do not invent thresholds or frequencies.
  - MTT frame. If a criterion is cash-only logic (deep-stack, no ICM), either
    drop it or mark it `cash_caveat: true` on that moment.
  - A label is a FACT, not a verdict (e.g. "checked the flop as raiser" is a
    label; "made a mistake" is not). Only propose candidate_labels that state
    what happened. Set fact_not_verdict accordingly.
  - Ignore intros, subscribe pitches, book plugs, chat/banter, giveaways.
  - Do not grade results. You have no chip outcomes and must not infer any.
  - Prefer fewer, well-cited entries over many thin ones. Empty sections are a
    valid result.

LABELABLE JUDGEMENT — a spot is `labelable: yes` only if it is computable from
fields the parser already produces per decision:
  street (preflop|flop|turn|river); kind/action (bet|call|check|raise|fold);
  position; stackBB; depth (short|mid|deep); spr; sizing (fraction of pot, null
  for check/call/fold/all-in); allIn; pfa (was Hero the preflop aggressor);
  facedBet; cards (Hero hole); board (to the acted street); handClass
  (strong|marginal-made|draw|air); boardType (dry-high-mine|wet-high-mine|
  middling-theirs|paired|monotone); removals (board-possible hands Hero's cards
  block).
If the spot needs data not in that list (multiway count, ICM stage, villain
type, bet-count on a street), set `labelable: no` (or `maybe`) and name the
missing data in `predicate` as `needs: <thing>`.

Return to the caller: file path written, and counts
(focus_order / moments / candidate_labels / vocabulary), plus one line on the
coach's single strongest emphasis.
```

---

## After all subagents finish

- Sanity-check each `notes/{ID}.yaml` parses and every `src` resolves.
- Proceed to step 3 (synthesis): merge across videos, group by target, dedupe
  overlapping findings, cite, and present for per-item approval. Only approved
  items reach `labels.ts` / `docs/leak-coaching.md`. Nothing is auto-applied.
