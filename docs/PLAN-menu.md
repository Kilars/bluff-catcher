# Plan: menu cleanup — group the preflop drills by the decision

Status: decided, 2026-10-04. Base: `origin/main` (3260020). Local `main` and
`btn-4bet` are behind it and do not have Seat vs open.

## Goal

Today the menu lists seven modes, and the names describe the table instead of
the decision: Facing open, BB defend, BTN vs 3-bet, Open vs 3-bet, Seat vs open.
Two of them (BTN vs 3-bet and Open vs 3-bet) answer the same question. Seat vs
open mixes cold 3-bet spots with SB spots, and the SB spots belong with BB defend.

After the change there are five modes, with the preflop ones grouped by the raise
you are answering:

```
POSTFLOP
  Odds          Chance you improve by the river
PREFLOP
  Open          Open or fold, by seat and stack            (was Preflop RFI)
  3-bet         Fold, call or 3-bet vs an open             (Facing open + Seat vs open, non-blind seats)
  4-bet         Fold, call or 4-bet after a 3-bet          (BTN vs 3-bet + Open vs 3-bet)
  Blinds        Defend the SB and BB vs an open            (BB defend + Seat vs open's SB spots)
```

## Mode map

| New mode (id · label) | Absorbs | Buckets, MTT | Buckets, cash |
|---|---|---|---|
| `preflop` · Open | Preflop RFI | unchanged (depth tiers) | unchanged |
| `threebet` · 3-bet | `facing`, `seatvsopen` minus SB | BTN early/late, HJ vs LJ, CO vs HJ | BTN cashEarly/cashCo, CO vs HJ |
| `fourbet` · 4-bet | `btn4bet`, `open4bet` | BTN vs SB/BB 3-bet | BTN vs 3-bet + LJ/HJ/CO open vs 3-bet |
| `blinds` · Blinds | `bbdefend`, `seatvsopen` SB | BB vs every opener, SB vs CO, SB vs BTN | BB vs LJ–SB, SB vs BTN |

The `preflop` id stays as it is, so the RFI stats key and the briefed ids don't move.

Side effect: 4-bet now follows the format switch. In MTT it deals only the BTN
spots, and in cash it deals both. Open vs 3-bet's "cash only, whatever the switch
says" special case goes away (`hasFormatChoice`, `FACING_BRIEFING_ID.open4`,
`STATS_KEY.open4bet`, `useFacingDrill`'s `format` override).

## Phases

### 1. Mode → bucket set (lib, no UI)

- `Drill` stays as the chart family on each `BucketMeta`. It records where a
  chart came from, not a menu entry.
- Add `MODE_DRILLS` in `facing.ts` (or a new `modes.ts`): for each facing mode,
  a predicate over `BucketMeta`. `threebet` = `drill==='btn' || (drill==='seat' && hero!=='SB')`;
  `blinds` = `drill==='bb' || (drill==='seat' && hero==='SB')`; `fourbet` = `btn4 | open4`.
- `bucketsFor(format, drill)` → `bucketsForMode(format, mode)`. The dealer,
  `facingRangePages` and the range sheet all read through it, so the merged modes
  page through every chart they deal.
- **Dealer weighting.** Right now `dealFacingSpot` picks a bucket uniformly.
  Blinds in MTT has 10 buckets and only 2 of them are SB, so the SB would come up
  20% of the time. Pick the source family first (uniformly), then a bucket within
  it, the same way the BTN drill's "bucket 50/50, then opener" works. See open
  question 2.
- Tests: rework `spots.test.ts` "every curated spot and only those come up" to
  run per mode, plus a dealer test that each family shows up in every merged mode.

### 2. App state and persistence

- `AppMode` = `'odds' | 'preflop' | 'threebet' | 'fourbet' | 'blinds'`, plus new
  `MODES`, `MODE_LABEL`, and `FACING_DRILL_OF` → `FACING_MODES` (a set).
- `loadMode` migrates old ids: `facing|seatvsopen → threebet`,
  `btn4bet|open4bet → fourbet`, `bbdefend → blinds`. Keep it in place for good,
  because it costs nothing and phones keep old localStorage for a long time.
- `hasOpponentsChoice` → `mode === 'fourbet' && format === 'cash'`. Better still,
  derive it from `bucketsForMode(...).some(hasOpponentsRead)` so it can't drift.
- Stats: new keys `bluff-catcher:{threebet,fourbet,blinds}[-cash]:v1`. Do a
  one-time migration on first load: sum `hands`/`correct`, take the max
  `bestStreak`, reset `streak` to 0, and leave the old keys alone. See open
  question 3 for seatvsopen.
- Briefing ids: new ids for each merged mode, so the briefing shows once more.
  The content changes, so that's intended.

### 3. Copy: labels, chips, briefings

- `Header.brandSub`, `App.contextLabelFor`, and the `*_CHIP_LABEL` /
  `*_CONTEXT_LABEL` constants in `facingMeta.ts`: one per new mode, with old
  ones deleted.
- Briefings (`facingBriefing.tsx`): each merged mode builds its briefing from the
  existing sections. 3-bet = `FACING_BRIEFING` + the non-SB part of
  `seatBriefing`. 4-bet = `BTN4_BRIEFING` + `OPEN4_BRIEFING` in cash. Blinds =
  `BB_BRIEFING` + the SB part of `seatBriefing`. `seatBriefing` takes a hero
  filter.
- The prompt and plaque already name the hero seat and the chart (`openerTag`),
  so a mixed stream still says where you're sitting. Check that the BTN and BB
  buckets also show the hero seat, since they didn't need it while their mode
  had a fixed seat.

### 4. Menu restyle (desktop `Menu` + `PhoneMenuSheet`)

- One source for mode items: move `MODE_ITEMS` (label, note, section) out of
  `PhoneMenuSheet` into `useAppPrefs` or a `menuItems.ts`. Then the desktop
  dropdown gets the same notes, and the two menus can't drift apart (they already
  have: desktop has no notes and a different group order).
- Sections: **Postflop** (Odds) and **Preflop** (Open, 3-bet, 4-bet, Blinds) as
  group labels, using the existing `groupLabel` style. Settings come after them
  in a fixed order: Format, Opponents, Stack depth, Odds drill, Tools, and
  Session (phone only).
- Desktop dropdown: render the note line under each mode (`itemNote`, which
  already exists for format/depth), and widen the dropdown if needed. Notes are
  per format, the same way phone does it.
- Notes should say which seats a mode covers, e.g. 3-bet MTT "BTN, HJ, CO vs an
  open · 40–50bb+". Derive them from `bucketsForMode` the way `seatSpotsNote`
  does now, so a new chart updates the note by itself.
- Check visually with the headless Chrome workaround: desktop dropdown, phone
  sheet, and phone context chip, in both formats.

### 5. Cleanup and docs

- Delete `seatvsopen`, `open4bet`, `btn4bet`, `bbdefend` and `facing` as modes,
  plus their stats-key, chip-label and briefing-id entries.
- `DECISIONS.md`: add an entry for "modes are grouped by the decision (raise
  faced), not by seat. Source family is chart metadata."
- Update the "What exists" table in `CLAUDE.md` (trainer list).
- `App.integration.test.tsx`, `PhoneMenuSheet.test.tsx` and `PhoneTopBar.test.tsx`
  test against the new labels, and add a test for the mode-id migration.

## Decisions (2026-10-04)

1. **Labels:** Open / 3-bet / 4-bet / Blinds. "Preflop RFI" becomes "Open".
2. **Spot choice:** merged modes deal a weighted mix (family first, then
   bucket). There's no sub-picker in v1.
3. **Old stats:** migrated exactly, and Seat vs open's counts go to 3-bet. The
   old keys are kept.
4. **4-bet** follows the format switch. Tournament deals the BTN spots, cash
   deals the BTN and open-vs-3-bet spots.

## Order and size

Phases 1–2 are one commit (the behaviour change, with tests). Phase 3 is copy,
phase 4 is the menu restyle, and phase 5 is cleanup. Each phase leaves `npm test`,
`typecheck` and `lint` green. The work branches from `origin/main`, not
`btn-4bet`.
