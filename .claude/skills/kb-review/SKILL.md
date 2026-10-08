---
name: kb-review
description: Review the coach knowledge base changes that kb-nightly staged, and merge the approved ones into the live briefs. Use when the user says kb-review, asks to review staged coaching notes, or the digest says videos are waiting.
---

# KB review: approve staged brief changes

`kb-nightly` stages, and this skill is the only way changes reach the live
briefs that `hand-review` loads. See `research/nightly-kb-plan.md`.
`KB=research/coaching-transcripts`.

## Walk

1. List `$KB/staging/*.md`, oldest first. Report how many there are and which
   videos they cover.
2. Go family by family across **all** staging files, not file by file, so
   duplicates and reinforcements collapse into one decision. For each family,
   present the items with AskUserQuestion (multiSelect, at most 4 options per
   question, several questions per call). Show each item's claim, stance or
   population, and citation. Recommend approve or reject per item, with a
   reason. Weight GTO Wizard as the baseline. An exploit must name its
   population.
3. **Conflicts** are never merged as they stand. Ask the user which claim wins,
   whether to keep both under separate population tags, or to drop both.
4. Ask before anything changes `labels.ts` or `docs/leak-coaching.md`. Those
   need their own per-item approval and a dev-hat change, and approval here
   doesn't cover them. An `unmapped` item can be approved into the label
   proposal list at `$KB/kb/label-proposals.md`.

## Merge

Approved items go into `$KB/kb/briefs/<slug>.md`. Create the file if it's
missing, in this shape:

```markdown
# <slug>: <what it covers>

## Baseline (GTO)
- <claim> [<channel> <id> <ts>]

## Exploits
- <claim>. Population: <pool>. [<channel> <id> <ts>]

## What costs chips
- <the typical mistake and why it's expensive> [<cites>]
```

- A reinforcement adds its citation to the existing bullet. It doesn't add a
  new bullet.
- Keep each brief short enough to read during a review (about 60 bullets at
  most). When one grows past that, propose merging overlapping bullets.
- Approved index terms go into `$KB/kb/index.md`: `term: gloss → brief slug
  [cites]`.

Then move each fully decided staging file to `$KB/staging/done/`, and add a
line to the top of `$KB/digest.md`: `reviewed <n> videos: <a> approved,
<r> rejected, <c> conflicts resolved`.

If `state.json` is paused and the user adds channels or wants to continue,
set `paused: false` and `lowNoveltyStreak: 0`.
