# bluff-catcher — BB defend trainer plan

A fourth drill, separate from the BTN facing-open drill. Someone opens, it folds to hero in the
**big blind**, and hero chooses **Fold / Call / 3-bet**. Read `PLAN-3bet.md` and `PLAN-cash.md`
first: this plan reuses their conventions (`lib/` pure and tested, injectable RNG, `tsc --noEmit`
+ tests green every phase, values from tokens) and most of their code.

Branch: `claude/jolly-faraday-rdlzho`.

---

## What we are building

- **New mode `bbdefend`, menu label "BB defend".** Its own mode, stats, briefing and range
  sheet. The BTN facing drill is untouched.
- **Hero seat: BB only.** Opener is any seat that can open into the BB:
  - Tournament (9-max): UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN, **SB**.
  - Cash (6-max): LJ, HJ, CO, BTN, **SB**.
  - SB vs BB is included: it's the most common BB spot at a real table and the source has it.
    The felt shows SB raising (raise chip), not a posted blind.
- **Both formats**, following the existing format switch (`bluff-catcher:format:v1`). The depth
  picker stays hidden in this mode, like the BTN facing drill.
- **Same answer loop and keys as the BTN facing drill:** F = Fold, J = Call, K = 3-bet, Space /
  Enter next, R range sheet, I briefing, Escape closes.
- **Pure charts, no mixing.** One right answer per hand. The source is already pure.
- **No value/bluff label.** The source does not split 3-bets by kind, so the chart is a
  `PlainChart` (one 3-bet colour), exactly like the cash BTN charts.
- **Solver baseline**, no exploit variant.

---

## Source

**`jensbaagaard/poker-practice`, `data/openSourcePokerData/`** — the same repo the cash drills
already vendor (`research/cash-100-pto.json`, owner decision in `PLAN-cash.md`).

- Keys: `3BetBBvs<seat>` and `CallBBvs<seat>`, 169 hands each, values 0/1 only (PTO = pure).
  Fold = neither. Seat names: `EP1 EP2 EP3 LJ HJ CO BTN SB` (9-max) → our `UTG UTG1 UTG2 LJ HJ
  CO BTN SB`.
- **Cash:** `Cash_100_PTO.json` (6-max, 100bb, 2.5bb opens, SB 3bb). Add the BB keys for
  LJ/HJ/CO/BTN/SB to the existing vendored subset.
- **Tournament:** `MTT_<N>_PTO.json`. The pack has 100 / 40 / 20bb. **Default: 40bb, labelled
  "40bb"** — the RFI drill's deep chart is also solved at 40bb, and 40bb is a common MTT stack.
  (Owner can pick 100bb instead; it's a one-file swap.) Vendored as
  `research/mtt-40-pto-bb.json` (BB keys only, with a `_source` block like the cash file).
- **Validation in B0:** for every chart, assert the two sets are disjoint, the combo totals are
  pinned in tests, and defend % rises monotonically-ish from UTG → BTN (sanity, not a hard rule
  — SB is its own shape). Record the combo counts in this doc once extracted.
- **Transcription:** charts live as TS sets (like `cashRanges.ts`), generated once from the JSON
  by a small checked-in script, and a test re-reads the JSON and asserts the TS sets match
  cell for cell. The JSON is the source of truth; nobody hand-edits the sets.

---

## Buckets: decided from the data in B0

BB defend changes far more across openers than BTN defend (vs UTG is tight, vs BTN / SB is very
wide), so the PLAN-3bet bucket choice can't be copied.

- **Method (same as PLAN-3bet):** build the opener × opener distance table (combos with a
  different answer, of 1326), try every contiguous split into 2, 3 and 4 buckets, and weight by
  how often each seat is the opener into the BB.
- **Rule:** pick the fewest buckets where the real-weighted average error is **≤ ~2% of combos
  (≈ 26)**, with **SB always its own bucket** (BvB is a different game: wider opens, SB is OOP
  postflop, and no one else is left).
- Cash has 5 openers: if 5 exact charts ≤ 4 buckets + error, just ship **exact charts per
  opener** in cash (zero bucket error).
- `BUCKET_OF_IN` stays a table, so any later split is a data change.
- The chosen split, its error table and "what the shapes teach" (3-5 bullets) go into this doc
  at the end of B0 before B1 starts.

---

## Architecture: generalize, don't copy

The BTN facing drill already has almost everything: `PlainChart`, `chartAction`,
`facingComboCounts`, the border/mid/trash pool, `useFacingDrill`, `FacingTrainer`,
`PhoneFacingTrainer`, `RangeGrid`'s `threeBet` colour, `fixedChart` range sheets, the `opener`
seat state. The new drill should be the same machinery with a different **spot spec**, not a
second copy.

- **`FacingSpec`** (new, `lib/preflop/facingSpec.ts`): everything that differs between the two
  drills, as data:
  - `hero: Seat` (`'BTN'` or `'BB'`)
  - `openersIn: Record<Format, readonly OpenerSeat[]>`
  - `bucketOfIn: Record<Format, Partial<Record<OpenerSeat, Bucket>>>`
  - `bucketChart: Record<Bucket, FacingChart>`, `bucketMeta: Record<Bucket, BucketMeta>`
  - `sources` (per format, the per-opener exact charts, for the pool's trash tier and tests)
  - `briefingId: Record<Format, string>`, `statsKey: Record<Format, string>`
  - `chipLabel` / `contextLabel` per format
- **Bucket ids become spec-local.** Today `Bucket` is one global union
  (`'early' | 'late' | 'cashEarly' | 'cashCo'`). Add the BB buckets to that union with a `bb`
  prefix (`bbEarly`, `bbSb`, …) rather than making `Bucket` generic — less type churn, and
  `BUCKET_META` / `BUCKET_CHART` stay single records. `bucketsFor(format)` becomes
  `bucketsFor(spec, format)`.
- **Opener type:** `Opener` today is `UTG…CO` (no BTN, no SB). Add `OpenerSeat = Opener | 'BTN' |
  'SB'` for the BB spec; the BTN spec keeps using `Opener`.
- **Dealer:** `dealFacingSpot({ rng, pool, format, spec })`, `spec` defaulting to the BTN spec so
  every existing caller and **golden.test.ts deal sequences are unchanged**. Bucket first
  (uniform over the format's buckets), then opener uniform within it — same as today.
- **Hook / views:** `useFacingDrill(format, spec)` and `FacingTrainer` / `PhoneFacingTrainer`
  take the spec. The BTN spec is the default, so the `facing` mode renders byte-identical.
- **Table:** `buildSeats(heroPos, opener)` already supports any hero seat and an opener before
  hero. Two gaps for hero = BB:
  - **SB as opener:** SB is rendered as a blind (`type: 'sb'`). When SB is the opener it must
    render as `opener` with the raise chip (SB open = 3bb in cash, per source; MTT size from
    the source file's metadata or 2.5bb if unstated). Folded SB (any other opener) keeps its
    dead 0.5bb blind chip, since the blind is posted.
  - **Hero is the BB:** hero's own plaque shows the posted 1bb; no separate BB seat in the ring.
  - Phone ladder (`PhoneSeatLadder` / `ladderSlots.ts`): same two cases.
- **App wiring:** `AppMode` gains `'bbdefend'`; `MODES`, `loadMode`, `contextLabelFor`,
  `STATS_KEY`, Header, PhoneTopBar, PhoneStatsPill, PhoneStatsSheet, Menu, PhoneMenuSheet all
  get the fourth case (switches, no `mode === 'facing'` two-way checks left behind).
  - Stats keys: `bluff-catcher:bbdefend:v1`, `bluff-catcher:bbdefend-cash:v1`.
  - Briefing ids: `bbdefend`, `bbdefend-cash`.

---

## Phases

### Phase B0 — Data + charts
- Vendor the BB keys (cash + MTT 40bb) into `research/`, with `_source` blocks.
- Distance table + bucket choice (rule above); write results into this doc.
- `lib/preflop/bbDefend.ts`: the bucket charts (`PlainChart`), `BB_SOURCES` per format.
- **Tests (`bbDefend.test.ts`):** TS sets == JSON cell for cell; sets disjoint; combo counts
  pinned per chart; per-opener bucket error pinned (like `facing.test.ts`); spot checks from
  the data (e.g. AA 3-bets vs every opener; 72o folds vs UTG).

### Phase B1 — Spec + dealer
- `FacingSpec`, BTN spec extracted from current constants (no behaviour change), BB spec added.
- `dealFacingSpot` takes `spec`. Pool generalised to take `spec` (border from the bucket
  chart, trash = folds in every source chart of that spec+format).
- **Tests:** existing facing / facingDeal / golden tests pass unchanged; BB deals: `correct`
  matches the chart, every opener reachable, SB only in its bucket, bucket split uniform ±2%,
  all 169 classes reachable, weight ratios within ±15%.

### Phase B2 — Mode, table, UI
- `bbdefend` mode through App / prefs / menus / header / phone chrome.
- Table + ladder: hero on BB, SB-as-opener, folded SB keeps its blind.
- Hook + trainers take the spec; briefing content for BB (see B3).
- **Tests:** reload restores `bbdefend`; header + stats pill per mode; F/J/K commit; SB opener
  renders a raise chip; existing mode tests unchanged.

### Phase B3 — Range sheet, briefing, verify
- Range sheet titles e.g. "BB vs Late (CO, BTN)", hero cell marked, legend 3-bet / call / fold,
  one-line footnote per bucket on where it's off.
- Briefing (short): which seats map to which chart; BB gets a price (closing the action, 1bb
  already in) so it defends far wider than the BTN; 3-bets are bigger OOP; SB vs BB is its own
  chart; J = call. Depth caveat for MTT: "solved at 40bb".
- `tsc`, lint, tests green; run the app at desktop + 390×844 and click through deal → commit →
  verdict → range → next in both formats.

---

## Out of scope
- Other defend seats (SB, CO, HJ facing opens).
- Multiway (opener + caller) / squeezes.
- Facing a 3-bet, 20bb/10bb BB defend tiers (the pack has 20bb — natural follow-up).
- Hand-history (`lib/hh`) support for BB defend decisions.
