# bluff-catcher — implementation plan

Phased build. Read `DECISIONS.md` first — it is the source of truth. The design pixel spec
is `../design_handoff_runout/README.md`; the reference logic is in that folder's
`design/Runout.dc.html` `<script data-dc-script>` block.

Delegation: **Opus scaffolds (Phase 0) and owns the risky correctness core (Phases 1–2
reviewed closely). Haiku subagents execute the well-specified phases** against tight specs
and acceptance criteria, and Opus verifies each with tests / by running the app before
moving on.

Dependency order is linear except where noted. Each phase lists: goal, files, spec pointers,
and **acceptance criteria** (how we know it's done).

---

## Phase 0 — Scaffold  *(Opus)*

**Goal:** a running, typed, tested-capable Vite app with tokens + fonts wired.

- `npm create vite@latest . -- --template react-ts` in `~/Code/bluff-catcher` (keep
  `docs/` and `design_handoff_runout/`).
- Add: `vitest`, `@testing-library/react`, `jsdom`, `vite-plugin-pwa`.
- Self-host Inter (weights 400/500); wire `--font-heading`/`--font-body`.
- Copy Nocturne `:root` tokens into `src/styles/tokens.css`; add the 4 functional colours.
- Folder skeleton: `src/lib/`, `src/components/`, `src/hooks/`, `src/styles/`, `src/test/`.
- `git init`, `.gitignore` (node_modules, dist), initial commit. **Do not** create the
  GitHub remote until the owner confirms (see Phase 8).

**Acceptance:** `npm run dev` serves a blank tokenised page; `npm run test` runs (0 tests);
`tsc --noEmit` clean.

---

## Phase 1 — Odds engine  *(Haiku, Opus-reviewed)*

**Goal:** pure, tested `lib/odds.ts`.

- Port `fullDeck`, `hasFlush`, `hasStraight`, `pairsUp`, `analyse` from the reference logic.
- Types: `Card` (`"As"` string form + a parsed `{rank,suit}` helper), `Analysis`
  (`{ outs, outsList, unseen, streets, total, quick }`).
- Keep both correctness guards (rank-named `hits`; error on zero non-backdoor outs).
- `lib/fixtures.ts`: the ten verified spots from DECISIONS as typed data.

**Acceptance:** `odds.test.ts` asserts every fixture's `outs` and `total` (±0.05), asserts
the zero-outs guard fires on a mis-specified spot, and the backdoor path yields 4.2%.
All green.

---

## Phase 2 — Classifier + dealer  *(Haiku, Opus-reviewed — the hard part)*

**Goal:** `classify()` + weighted rejection-sampling generator. This is the "hardest part
of the product" (DECISIONS). Build test-first.

- `lib/classify.ts`: `classify(hero: Card[], board: Card[]) => DrawRead | null`
  - Detects each taxonomy category with **rank-/suit-named** predicates (never generic
    "pairs up"). Returns `{ category, name, note, outs, outsList }`.
  - Returns `null`/`made`/`air` for non-keepers. A hand that is already made (straight,
    flush, trips, two-pair+) is NOT a draw → reject.
  - Ordering matters: combo before flushDraw/openEnder; doubleGutshot before gutshot;
    backdoor only when exactly 3 to a suit and 0 one-card outs.
- `lib/deal.ts`: `dealSpot(opts) => Spot`
  - Weighted category pick → deal random hero+board (flop or turn) → `classify` → accept
    iff category matches → dedupe board vs `seenBoards` → else re-deal (cap attempts, then
    fall back to any keeper).
  - Deterministic mode: accept an injected RNG seed for tests.

**Acceptance:** `classify.test.ts` returns the expected category for all ten fixtures;
returns null for a made hand and for air; never mislabels bottom-pair kicker as an out.
`deal.test.ts` (seeded) produces only keepers, respects no-repeat, and hits every category
over N deals with the expected rough distribution.

---

## Phase 3 — Explanation copy generator  *(Haiku)*

**Goal:** `lib/explain.ts` — generate the sheet copy from a `DrawRead` + `Analysis`.

- Per-category templates for step 01 title/body, step 02 multiplier text, and the
  conditional step 03 drift correction (see DECISIONS). Slot in count, suit/rank names,
  out-cards, overlap warning. Backdoor special-cased.
- The head-maths line (`9 × 4 = 36%`), true-number, and "worth memorising" table data.

**Acceptance:** `explain.test.ts` snapshot per fixture reads naturally, matches the
prototype's terseness, and renders step 03 only when the shortcut is actually wrong.

---

## Phase 4 — Desktop UI (pixel-accurate)  *(Haiku, per-component)*

**Goal:** recreate the 1280×860 design exactly. One subagent per component, each handed the
matching README section verbatim.

- `App.tsx` — the state blob (`i`→random spot, `guess`, `hover`, `showExplain`, `errors`,
  `streak`, `hands`, `bands`) + handlers (commit, next→`dealSpot`, keyboard).
- `components/Header.tsx` — brand + stat pairs + band tally (README "Header").
- `components/Table.tsx` — felt, villain, street line, board/blank/hero cards (README "Table").
- `components/GuessRail.tsx` — the core mechanic: no thumb, hover ghost, tap-to-commit,
  commit marks + error gap + label push-apart, keyboard (README "The guess rail").
- `components/Dock.tsx` — left hand-read column + right question/result column (README "Dock").
- `components/ExplainSheet.tsx` — bottom sheet, two columns, footer (no `margin-top:auto`),
  `riseSheet` animation, full-screen variant (README "Explanation").

**Acceptance:** side-by-side with the prototype HTML the desktop view matches on colours,
type, spacing, and every interaction state (hover ghost, commit, near-miss label spread,
focus rings). All interactions in the README's behaviour table work.

---

## Phase 5 — Responsive / phone layout  *(Haiku)*

**Goal:** portrait-phone vertical stack (DECISIONS "Layout").

- Breakpoint(s) reflow the dock columns into a single column; felt + cards scale; rail
  pinned in the thumb zone; header compresses; sheet becomes near-full-height.
- No landscape lock. Touch: `touch-action:none` on the rail, tap = commit.

**Acceptance:** at 390×844 the whole loop is usable one-thumbed; nothing clips; desktop
view unchanged.

---

## Phase 6 — Persistence + stats  *(Haiku)*

**Goal:** `hooks/useStats.ts` over localStorage (DECISIONS "Persistence").

- Load/restore totals + perCategory; write on each commit; `bestStreak`; `Reset stats`.
- `seenBoards` in-memory only.

**Acceptance:** reload preserves hands/streak/avg-error/bands and per-category; reset
clears; per-category updates on the right category each commit.

---

## Phase 7 — PWA + polish + verify  *(Haiku, then Opus /polish + /verify)*

- `vite-plugin-pwa`: manifest (name, icons, dark theme), offline app-shell.
- Run the `/polish` pass (alignment, spacing, states) and `/verify` the full loop on
  desktop and at phone width.

**Acceptance:** installable (add-to-home-screen), loads offline, polish pass clean.

---

## Phase 8 — Git remote  *(Opus, owner-gated)*

- Confirm with owner, then `gh repo create Kilars/bluff-catcher`, push `main`.
- (Outward-facing — do not run before explicit go-ahead.)

---

## Delegation notes for Haiku subagents

- Always read `docs/DECISIONS.md` and the relevant `../design_handoff_runout/README.md`
  section before writing code. Take exact values from the tokens, never hardcode.
- Do not port the `<x-dc>`/`DCLogic` runtime — recreate in idiomatic React + hooks.
- Keep `lib/` pure and UI-free; all randomness injectable for tests.
- Every phase must leave `tsc --noEmit` and `npm run test` green before handing back.
