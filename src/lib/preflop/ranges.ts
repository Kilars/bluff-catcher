/**
 * Preflop RFI (Raise First In) ranges for 7 non-blind seats, at three
 * tournament stack depths. Pure, no UI imports.
 *
 * ── Where these charts come from ──────────────────────────────────────────
 * Every chart below is transcribed from a solver-derived 9-handed MTT chart
 * set (PokerCoaching's published 40bb / 25bb / 15bb GTO packs), cross-checked
 * against published solver widths (ThinkGTO, RangeConverter, GTO Wizard) and
 * Nash push/fold data for the 10bb tier. Each transcription was verified
 * against the combo count printed on the source chart, so the widths below
 * are exact, not eyeballed.
 *
 * Assumptions baked into the charts:
 *   - 9-handed, **with antes** (standard modern MTT). No-ante charts are a
 *     couple of points tighter, mostly in late position.
 *   - chipEV, not ICM. Near a pay jump every chart here is too wide.
 *   - Open size ~2.2–2.5bb at 60bb+, ~2bb at 20bb, all-in at 10bb.
 *
 * ── The three tiers ───────────────────────────────────────────────────────
 * RFI hand selection barely moves between 40bb and 100bb, so the deep chart
 * is labelled 60bb+ and covers everything from 40bb up — 60bb is the figure
 * written on the felt because it sits in the middle of that span. What changes
 * is the
 * way *down*:
 *
 *   deep  (60bb+) — the baseline. Full playability: set-mining and suited
 *                   connectors are worth their seat in the range.
 *   mid   (20bb)  — **late position tightens, early position does not.**
 *                   This is the counter-intuitive bit. The button's edge is
 *                   playability, and playability is what 20bb takes away, so
 *                   BTN drops ~7 points while UTG is flat. The shape moves
 *                   too: implied-odds hands out, suited aces/kings in.
 *   short (10bb)  — jam or fold. Raw showdown equity plus fold equity, so
 *                   every pair and every suited ace goes in from every seat,
 *                   and the small connectors wait for late position.
 *                   Note the widths are *similar* to the deep chart, not
 *                   wider — a 10bb jam range is about as wide as a 60bb open
 *                   range, it is simply built out of different hands.
 *
 * ── Implemented widths (% of 1326 combos) ─────────────────────────────────
 * Position  | deep 60bb+ | mid 20bb | short 10bb
 * ----------|------------|----------|-----------
 * UTG       |     16.1%  |   16.7%  |    16.1%
 * UTG+1     |     17.5%  |   18.7%  |    17.6%
 * UTG+2     |     20.5%  |   20.5%  |    19.8%
 * LJ        |     23.5%  |   22.6%  |    23.4%
 * HJ        |     28.7%  |   25.9%  |    28.2%
 * CO        |     36.5%  |   32.4%  |    34.8%
 * BTN       |     50.8%  |   43.3%  |    50.8%
 *
 * (The exact combo counts are asserted in ranges.test.ts, which is the source
 * of truth if this table drifts.)
 *
 * A simplification worth knowing about: these are pure binary charts. Real
 * solver output mixes — at 10bb it still min-raises part of the range rather
 * than jamming all of it, and at every depth some hands are opened at a
 * frequency. A trainer that asked for frequencies would teach worse, so the
 * charts round to the majority action.
 */

import { combosForClass, type HandClass } from './hands.ts';
import { RANKS } from '../odds.ts';
import { CASH_RFI, CASH_SEATS } from './cashRanges.ts';

// ─── Position enum ────────────────────────────────────────────────────────────

export const POSITIONS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN'] as const;
export type Position = (typeof POSITIONS)[number];

// UTG+2 and LJ are adjacent but distinct seats at a 9-handed table, and the
// reference charts treat them that way — roughly 3 percentage points apart at
// 60bb. They get their own ranges.

/**
 * Any seat a drill can put hero in: the 9-max non-blind seats plus the SB,
 * which only the cash chart opens from (docs/PLAN-cash.md). `Position` stays
 * the narrow 9-max type — `lib/hh` parses against it and must never see SB.
 */
export type Seat = Position | 'SB';

/**
 * Any seat at the table, the big blind included. Only the facing drills need
 * it: BB defend seats hero there, and in BTN vs 3-bet the BB is a 3-bettor.
 * Kept out of `Seat` so the RFI chart tables never need a BB entry.
 */
export type TableSeat = Seat | 'BB';

/**
 * Display names for every seat, so no component keeps its own copy.
 *   short — tab strips, plaques, the seat ladder ("UTG+1")
 *   long  — the felt's centre heading ("Under the gun")
 *   title — range-sheet headings ("Under the Gun (UTG)")
 */
export const SEAT_META: Record<Seat, { short: string; long: string; title: string }> = {
  UTG: { short: 'UTG', long: 'Under the gun', title: 'Under the Gun (UTG)' },
  UTG1: { short: 'UTG+1', long: 'UTG + 1', title: 'UTG+1' },
  UTG2: { short: 'UTG+2', long: 'UTG + 2', title: 'UTG+2' },
  LJ: { short: 'LJ', long: 'Lojack', title: 'Lojack (LJ)' },
  HJ: { short: 'HJ', long: 'Hijack', title: 'Hijack (HJ)' },
  CO: { short: 'CO', long: 'Cutoff', title: 'Cutoff (CO)' },
  BTN: { short: 'BTN', long: 'Button', title: 'Button (BTN)' },
  SB: { short: 'SB', long: 'Small blind', title: 'Small Blind (SB)' },
};

// ─── Format ───────────────────────────────────────────────────────────────────

/** Tournament (9-max, antes, three stack tiers) or cash (6-max, 100bb, no ante). */
export const FORMATS = ['mtt', 'cash'] as const;
export type Format = (typeof FORMATS)[number];

/** Menu copy per format, so the choice says what it changes. */
export const FORMAT_META: Record<Format, { label: string; note: string }> = {
  mtt: { label: 'Tournament', note: '9-max · antes · three stack depths' },
  cash: { label: 'Cash', note: '6-max · 100bb · no ante' },
};

// ─── Stack depth ──────────────────────────────────────────────────────────────

/** The three tournament stack tiers, deepest first. */
export const DEPTHS = ['deep', 'mid', 'short'] as const;
export type Depth = (typeof DEPTHS)[number];

/** The tier every existing caller gets when it does not name one. */
export const DEFAULT_DEPTH: Depth = 'deep';

/**
 * The chart an RFI spot is graded against: one of the tournament tiers, or the
 * single cash chart. Prefs persist `format` and `depth` separately and resolve
 * to this one key (`chartKeyFor`), which then indexes the ranges, the display
 * meta, the briefing id and the stats key.
 */
export type ChartKey = Depth | 'cash';

/** Every chart key, in the order range browsers list them. */
export const CHART_KEYS: readonly ChartKey[] = [...DEPTHS, 'cash'];

export function chartKeyFor(format: Format, depth: Depth): ChartKey {
  return format === 'cash' ? 'cash' : depth;
}

export function formatOf(key: ChartKey): Format {
  return key === 'cash' ? 'cash' : 'mtt';
}

export interface DepthMeta {
  id: ChartKey;
  /** The seats hero can be dealt, in action order. */
  seats: readonly Seat[];
  /** Stack size as shown in tabs and menus, e.g. "60bb+". */
  label: string;
  /** One-word tier name, e.g. "Deep". */
  name: string;
  /** Stack figure written on the felt plaques, e.g. "60+ bb". */
  stackLabel: string;
  /** The aggressive action at this depth. Fold is always the other option. */
  action: 'open' | 'jam';
  /** Button / key-hint label for the aggressive action. */
  actionLabel: string;
  /** Noun phrase for verdict copy: "Wrong — this is an open". */
  actionNoun: string;
  /** Kicker above a range chart: "Opening range" / "Jamming range". */
  rangeKicker: string;
  /** The prompt on the felt: "Open or fold?" / "Jam or fold?". */
  prompt: string;
  /** One line on what makes this tier different. */
  tagline: string;
}

export const CHART_META: Record<ChartKey, DepthMeta> = {
  deep: {
    id: 'deep',
    seats: POSITIONS,
    label: '60bb+',
    name: 'Deep',
    stackLabel: '60+ bb',
    action: 'open',
    actionLabel: 'Open',
    actionNoun: 'an open',
    rangeKicker: 'Opening range',
    prompt: 'Open or fold?',
    tagline:
      'Full playability — enough chips behind to set-mine and to win a big pot with a suited connector.',
  },
  mid: {
    id: 'mid',
    seats: POSITIONS,
    label: '20bb',
    name: 'Mid',
    stackLabel: '20 bb',
    action: 'open',
    actionLabel: 'Open',
    actionNoun: 'an open',
    rangeKicker: 'Opening range',
    prompt: 'Open or fold?',
    tagline:
      'Implied odds are gone. Late position tightens hardest — playability was the button’s edge, and it just disappeared.',
  },
  short: {
    id: 'short',
    seats: POSITIONS,
    label: '10bb',
    name: 'Short',
    stackLabel: '10 bb',
    action: 'jam',
    actionLabel: 'Jam',
    actionNoun: 'a jam',
    rangeKicker: 'Jamming range',
    prompt: 'Jam or fold?',
    tagline:
      'No raise-folding left. Every chip goes in or none do, so raw equity plus fold equity decides it.',
  },
  cash: {
    id: 'cash',
    seats: CASH_SEATS,
    label: 'Cash',
    name: '6-max',
    stackLabel: '100 bb',
    action: 'open',
    actionLabel: 'Open',
    actionNoun: 'an open',
    rangeKicker: 'Opening range',
    prompt: 'Open or fold?',
    tagline:
      '6-max, 100bb, no ante. Tighter than the tournament charts — no dead money to fight for, and rake taxes small pots.',
  },
};

/**
 * The seat a range browser shows when it switches to a chart that lacks the
 * seat on screen: 9-max UTG…UTG+2 fold into 6-max LJ (the first seat to act),
 * and the SB — cash only — maps to the tournament BTN. Every other seat exists
 * on both, so it stays put and flipping back restores the pick.
 */
export function seatOnChart(seat: Seat, key: ChartKey): Seat {
  const seats = CHART_META[key].seats;
  if (seats.includes(seat)) return seat;
  return key === 'cash' ? seats[0] : 'BTN';
}

/**
 * The seat `delta` steps from `seat` along a chart's seat list, or `seat`
 * itself at either end. Both range browsers page seats with it.
 */
export function stepSeat(seat: Seat, key: ChartKey, delta: number): Seat {
  const seats = CHART_META[key].seats;
  const next = seats.indexOf(seatOnChart(seat, key)) + delta;
  return next < 0 || next >= seats.length ? seat : seats[next];
}

/** The tournament tiers' meta — the subset of `CHART_META` that `Depth` indexes. */
export const DEPTH_META: Record<Depth, DepthMeta> = {
  deep: CHART_META.deep,
  mid: CHART_META.mid,
  short: CHART_META.short,
};

// ─── Range expansion helpers ─────────────────────────────────────────────────

/**
 * Expand a suited "hi-x+" shorthand to all suited classes from hiLo up to hi(hi-1).
 * e.g. expandSuited('A', 'T') → ['ATs', 'AJs', 'AQs', 'AKs']
 * e.g. expandSuited('K', 'T') → ['KTs', 'KJs', 'KQs']
 */
function expandSuited(hiRank: string, loRankMin: string): HandClass[] {
  const hiIdx = RANKS.indexOf(hiRank);
  const loMinIdx = RANKS.indexOf(loRankMin);
  const result: HandClass[] = [];
  for (let lo = loMinIdx; lo < hiIdx; lo++) {
    result.push(hiRank + RANKS[lo] + 's');
  }
  return result;
}

/**
 * Expand a suited range for a specific hi rank between two lo ranks (inclusive).
 * e.g. expandSuitedRange('A', '5', '2') → ['A5s', 'A4s', 'A3s', 'A2s']
 */
function expandSuitedRange(hiRank: string, loRankHi: string, loRankLo: string): HandClass[] {
  const hiIdx = RANKS.indexOf(hiRank);
  const loHiIdx = RANKS.indexOf(loRankHi);
  const loLoIdx = RANKS.indexOf(loRankLo);
  const result: HandClass[] = [];
  for (let lo = loLoIdx; lo <= loHiIdx; lo++) {
    if (lo < hiIdx) {
      result.push(hiRank + RANKS[lo] + 's');
    }
  }
  return result;
}

/**
 * Expand a pocket pair range: all pairs from loRank up to AA.
 * e.g. expandPairs('5') → ['55', '66', '77', '88', '99', 'TT', 'JJ', 'QQ', 'KK', 'AA']
 */
function expandPairs(loRank: string): HandClass[] {
  const loIdx = RANKS.indexOf(loRank);
  const result: HandClass[] = [];
  for (let i = loIdx; i <= 12; i++) {
    result.push(RANKS[i] + RANKS[i]);
  }
  return result;
}

/**
 * Expand an offsuit "hi-x+" shorthand to all offsuit classes from hiLo up to hi(hi-1).
 * e.g. expandOffsuit('A', 'J') → ['AJo', 'AQo', 'AKo']
 */
function expandOffsuit(hiRank: string, loRankMin: string): HandClass[] {
  const hiIdx = RANKS.indexOf(hiRank);
  const loMinIdx = RANKS.indexOf(loRankMin);
  const result: HandClass[] = [];
  for (let lo = loMinIdx; lo < hiIdx; lo++) {
    result.push(hiRank + RANKS[lo] + 'o');
  }
  return result;
}

// ─── Range definitions — deep (60bb+) ─────────────────────────────────────────
/*
 * The shape to internalise, seat by seat: suited aces and suited kings come
 * in *first*, small suited connectors come in *last*. A9s opens from UTG and
 * 65s does not — the connector needs a multiway pot and a deep stack behind
 * it to be worth anything, while any suited ace makes the nut flush and
 * blocks the hands that punish you.
 */

/**
 * UTG @ 60bb+ — 66+, A3s+, K8s+, Q9s+, J9s+, T9s, ATo+, KJo+
 *
 * 9 pairs (54) + 22 suited (88) + 6 offsuit (72) = 214 = 16.1%
 */
function buildUTG(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('6'),
    ...expandSuited('A', '3'), // every suited ace except A2s
    ...expandSuited('K', '8'),
    ...expandSuited('Q', '9'),
    ...expandSuited('J', '9'),
    'T9s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'J'),
  ]);
}

/**
 * UTG+1 @ 60bb+ — 55+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, ATo+, KJo+
 *
 * 10 pairs (60) + 25 suited (100) + 6 offsuit (72) = 232 = 17.5%
 */
function buildUTG1(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('5'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '8'),
    ...expandSuited('Q', '9'),
    ...expandSuited('J', '9'),
    ...expandSuited('T', '8'),
    '98s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'J'),
  ]);
}

/**
 * UTG+2 @ 60bb+ — 55+, A2s+, K6s+, Q9s+, J8s+, T8s+, 98s, 87s, ATo+, KTo+, QJo
 *
 * 10 pairs (60) + 29 suited (116) + 8 offsuit (96) = 272 = 20.5%
 */
function buildUTG2(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('5'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '6'),
    ...expandSuited('Q', '9'),
    ...expandSuited('J', '8'),
    ...expandSuited('T', '8'),
    '98s',
    '87s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'T'),
    'QJo',
  ]);
}

/**
 * LJ @ 60bb+ — 55+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s,
 *              A9o+, KTo+, QJo, JTo
 *
 * The first seat that opens an offsuit ace below ATo.
 *
 * 10 pairs (60) + 33 suited (132) + 10 offsuit (120) = 312 = 23.5%
 */
function buildLJ(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('5'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '5'),
    ...expandSuited('Q', '8'),
    ...expandSuited('J', '8'),
    ...expandSuited('T', '8'),
    ...expandSuited('9', '7'),
    '87s',
    '76s',
    ...expandOffsuit('A', '9'),
    ...expandOffsuit('K', 'T'),
    'QJo',
    'JTo',
  ]);
}

/**
 * HJ @ 60bb+ — 33+, A2s+, K3s+, Q7s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s,
 *              A8o+, KTo+, QTo+, JTo
 *
 * 12 pairs (72) + 41 suited (164) + 12 offsuit (144) = 380 = 28.7%
 */
function buildHJ(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('3'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '3'),
    ...expandSuited('Q', '7'),
    ...expandSuited('J', '7'),
    ...expandSuited('T', '7'),
    ...expandSuited('9', '7'),
    ...expandSuited('8', '6'),
    '76s',
    '65s',
    '54s',
    ...expandOffsuit('A', '8'),
    ...expandOffsuit('K', 'T'),
    ...expandOffsuit('Q', 'T'),
    'JTo',
  ]);
}

/**
 * CO @ 60bb+ — 33+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 86s+, 75s+, 65s, 54s,
 *              A5o+, K8o+, Q9o+, JTo
 *
 * 12 pairs (72) + 49 suited (196) + 18 offsuit (216) = 484 = 36.5%
 */
function buildCO(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('3'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '2'),
    ...expandSuited('Q', '4'),
    ...expandSuited('J', '6'),
    ...expandSuited('T', '6'),
    ...expandSuited('9', '6'),
    ...expandSuited('8', '6'),
    ...expandSuited('7', '5'),
    '65s',
    '54s',
    ...expandOffsuit('A', '5'),
    ...expandOffsuit('K', '8'),
    ...expandOffsuit('Q', '9'),
    'JTo',
  ]);
}

/**
 * BTN @ 60bb+ — 22+, A2s+, K2s+, Q2s+, J3s+, T4s+, 95s+, 85s+, 75s+, 64s+, 54s,
 *               A2o+, K5o+, Q8o+, J8o+, T8o+, 98o
 *
 * Just over half of all hands. Two players left to get through and position
 * for the rest of the hand.
 *
 * 13 pairs (78) + 59 suited (236) + 30 offsuit (360) = 674 = 50.8%
 */
function buildBTN(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '2'),
    ...expandSuited('Q', '2'),
    ...expandSuited('J', '3'),
    ...expandSuited('T', '4'),
    ...expandSuited('9', '5'),
    ...expandSuited('8', '5'),
    ...expandSuited('7', '5'),
    ...expandSuited('6', '4'),
    '54s',
    ...expandOffsuit('A', '2'),
    ...expandOffsuit('K', '5'),
    ...expandOffsuit('Q', '8'),
    ...expandOffsuit('J', '8'),
    ...expandOffsuit('T', '8'),
    '98o',
  ]);
}

// ─── Range definitions — mid (20bb) ───────────────────────────────────────────
/*
 * Anchored on the 25bb reference charts, trimmed toward 15bb in the seats
 * where the two packs actually disagree — which is late position, not early.
 *
 * The width story, 60bb+ → 20bb:
 *   UTG   16.1% → 16.7%   (flat, marginally wider)
 *   LJ    23.5% → 22.6%
 *   HJ    28.7% → 25.9%
 *   CO    36.5% → 32.4%
 *   BTN   50.8% → 43.3%   (the whole move is here)
 *
 * Why: the button's opening range is subsidised by position — it can call a
 * flop, float a turn, and win pots with nothing. 20bb deletes that subsidy,
 * so the bottom of the button's range stops showing a profit. UTG's range was
 * never built on playability, so it barely moves; the antes even push it a
 * touch wider.
 *
 * The shape moves too, in both directions: 85s/64s out, every suited king in.
 */

/**
 * UTG @ 20bb — 66+, A4s+, K7s+, Q9s+, J9s+, T8s+, 98s, ATo+, KJo+
 *
 * 9 pairs (54) + 24 suited (96) + 6 offsuit (72) = 222 = 16.7%
 */
function buildMidUTG(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('6'),
    ...expandSuited('A', '4'),
    ...expandSuited('K', '7'),
    ...expandSuited('Q', '9'),
    ...expandSuited('J', '9'),
    ...expandSuited('T', '8'),
    '98s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'J'),
  ]);
}

/**
 * UTG+1 @ 20bb — 55+, A3s+, K7s+, Q8s+, J9s+, T8s+, 98s, ATo+, KTo+
 *
 * 10 pairs (60) + 26 suited (104) + 7 offsuit (84) = 248 = 18.7%
 */
function buildMidUTG1(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('5'),
    ...expandSuited('A', '3'),
    ...expandSuited('K', '7'),
    ...expandSuited('Q', '8'),
    ...expandSuited('J', '9'),
    ...expandSuited('T', '8'),
    '98s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'T'),
  ]);
}

/**
 * UTG+2 @ 20bb — 55+, A2s+, K6s+, Q8s+, J8s+, T8s+, 98s, ATo+, KTo+, QJo
 *
 * Same width as the deep chart at this seat (272 both), different hands:
 * Q8s in, 87s out.
 *
 * 10 pairs (60) + 29 suited (116) + 8 offsuit (96) = 272 = 20.5%
 */
function buildMidUTG2(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('5'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '6'),
    ...expandSuited('Q', '8'),
    ...expandSuited('J', '8'),
    ...expandSuited('T', '8'),
    '98s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'T'),
    'QJo',
  ]);
}

/**
 * LJ @ 20bb — 55+, A2s+, K6s+, Q8s+, J8s+, T8s+, 98s, 87s, A9o+, KTo+, QJo, JTo
 *
 * 10 pairs (60) + 30 suited (120) + 10 offsuit (120) = 300 = 22.6%
 */
function buildMidLJ(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('5'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '6'),
    ...expandSuited('Q', '8'),
    ...expandSuited('J', '8'),
    ...expandSuited('T', '8'),
    '98s',
    '87s',
    ...expandOffsuit('A', '9'),
    ...expandOffsuit('K', 'T'),
    'QJo',
    'JTo',
  ]);
}

/**
 * HJ @ 20bb — 55+, A2s+, K4s+, Q6s+, J7s+, T7s+, 97s+, 87s, 76s,
 *             A8o+, KTo+, QJo, JTo
 *
 * 10 pairs (60) + 38 suited (152) + 11 offsuit (132) = 344 = 25.9%
 */
function buildMidHJ(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('5'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '4'),
    ...expandSuited('Q', '6'),
    ...expandSuited('J', '7'),
    ...expandSuited('T', '7'),
    ...expandSuited('9', '7'),
    '87s',
    '76s',
    ...expandOffsuit('A', '8'),
    ...expandOffsuit('K', 'T'),
    'QJo',
    'JTo',
  ]);
}

/**
 * CO @ 20bb — 44+, A2s+, K3s+, Q5s+, J6s+, T7s+, 97s+, 86s+, 76s, 65s,
 *             A5o+, K9o+, QTo+, JTo
 *
 * 11 pairs (66) + 43 suited (172) + 16 offsuit (192) = 430 = 32.4%
 */
function buildMidCO(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('4'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '3'),
    ...expandSuited('Q', '5'),
    ...expandSuited('J', '6'),
    ...expandSuited('T', '7'),
    ...expandSuited('9', '7'),
    ...expandSuited('8', '6'),
    '76s',
    '65s',
    ...expandOffsuit('A', '5'),
    ...expandOffsuit('K', '9'),
    ...expandOffsuit('Q', 'T'),
    'JTo',
  ]);
}

/**
 * BTN @ 20bb — 22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 86s+, 75s+, 65s, 54s,
 *              A2o+, K7o+, Q8o+, J9o+, T9o
 *
 * 7.5 points tighter than the deep button, and that is the whole lesson of
 * this tier: 85s, T4s, J3s, K5o and Q2s were profitable *because* of what
 * happens after the flop, and after the flop is now an all-in.
 *
 * 13 pairs (78) + 49 suited (196) + 25 offsuit (300) = 574 = 43.3%
 */
function buildMidBTN(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '2'),
    ...expandSuited('Q', '4'),
    ...expandSuited('J', '6'),
    ...expandSuited('T', '6'),
    ...expandSuited('9', '6'),
    ...expandSuited('8', '6'),
    ...expandSuited('7', '5'),
    '65s',
    '54s',
    ...expandOffsuit('A', '2'),
    ...expandOffsuit('K', '7'),
    ...expandOffsuit('Q', '8'),
    ...expandOffsuit('J', '9'),
    'T9o',
  ]);
}

// ─── Range definitions — short (10bb, jam or fold) ────────────────────────────
/*
 * At 10bb an open commits you, so the chart collapses to shove-or-muck. What
 * a hand is worth changes with it:
 *
 *   - Every pocket pair jams from every seat. 22 is a coinflip against two
 *     overcards and it never has to play a turn.
 *   - Every suited ace jams from every seat: nut-flush equity plus the ace
 *     blocker against the calls behind.
 *   - Small suited connectors stay out until late position. They are the
 *     worst hands to get called by — they need to make something.
 *   - The button jams half its hands, because only two players can call.
 *
 * Widths land close to the deep chart rather than far above it. Fold equity
 * buys the bottom of the range; being unable to fold to a re-raise sells the
 * top back. The hands are what differ, not the count.
 *
 * Caveat kept out of the UI copy on purpose: solvers do not play pure jam at
 * 10bb — with antes they min-raise a slice of the range (min-raising AA from
 * UTG beats jamming it). Jam-or-fold is the simplification, and it is the one
 * every push/fold chart makes.
 */

/**
 * UTG @ 10bb jam — 22+, A2s+, K9s+, QTs+, JTs, ATo+, KQo
 *
 * 13 pairs (78) + 19 suited (76) + 5 offsuit (60) = 214 = 16.1%
 */
function buildShortUTG(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '9'),
    ...expandSuited('Q', 'T'),
    'JTs',
    ...expandOffsuit('A', 'T'),
    'KQo',
  ]);
}

/**
 * UTG+1 @ 10bb jam — 22+, A2s+, K8s+, QTs+, JTs, T9s, ATo+, KJo+
 *
 * 13 pairs (78) + 21 suited (84) + 6 offsuit (72) = 234 = 17.6%
 */
function buildShortUTG1(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '8'),
    ...expandSuited('Q', 'T'),
    'JTs',
    'T9s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'J'),
  ]);
}

/**
 * UTG+2 @ 10bb jam — 22+, A2s+, K7s+, Q9s+, J9s+, T9s, 98s, ATo+, KJo+, QJo
 *
 * 13 pairs (78) + 25 suited (100) + 7 offsuit (84) = 262 = 19.8%
 */
function buildShortUTG2(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '7'),
    ...expandSuited('Q', '9'),
    ...expandSuited('J', '9'),
    'T9s',
    '98s',
    ...expandOffsuit('A', 'T'),
    ...expandOffsuit('K', 'J'),
    'QJo',
  ]);
}

/**
 * LJ @ 10bb jam — 22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 98s, 87s,
 *                 A9o+, KTo+, QJo
 *
 * 13 pairs (78) + 31 suited (124) + 9 offsuit (108) = 310 = 23.4%
 */
function buildShortLJ(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '5'),
    ...expandSuited('Q', '8'),
    ...expandSuited('J', '8'),
    ...expandSuited('T', '8'),
    '98s',
    '87s',
    ...expandOffsuit('A', '9'),
    ...expandOffsuit('K', 'T'),
    'QJo',
  ]);
}

/**
 * HJ @ 10bb jam — 22+, A2s+, K3s+, Q7s+, J7s+, T7s+, 97s+, 87s, 76s,
 *                 A7o+, KTo+, QJo, JTo
 *
 * 13 pairs (78) + 38 suited (152) + 12 offsuit (144) = 374 = 28.2%
 */
function buildShortHJ(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '3'),
    ...expandSuited('Q', '7'),
    ...expandSuited('J', '7'),
    ...expandSuited('T', '7'),
    ...expandSuited('9', '7'),
    '87s',
    '76s',
    ...expandOffsuit('A', '7'),
    ...expandOffsuit('K', 'T'),
    'QJo',
    'JTo',
  ]);
}

/**
 * CO @ 10bb jam — 22+, A2s+, K2s+, Q5s+, J6s+, T6s+, 96s+, 86s+, 75s+, 65s, 54s,
 *                 A5o+, K9o+, QTo+, JTo
 *
 * 13 pairs (78) + 48 suited (192) + 16 offsuit (192) = 462 = 34.8%
 */
function buildShortCO(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '2'),
    ...expandSuited('Q', '5'),
    ...expandSuited('J', '6'),
    ...expandSuited('T', '6'),
    ...expandSuited('9', '6'),
    ...expandSuited('8', '6'),
    ...expandSuited('7', '5'),
    '65s',
    '54s',
    ...expandOffsuit('A', '5'),
    ...expandOffsuit('K', '9'),
    ...expandOffsuit('Q', 'T'),
    'JTo',
  ]);
}

/**
 * BTN @ 10bb jam — 22+, A2s+, K2s+, Q2s+, J4s+, T5s+, 95s+, 85s+, 74s+, 64s+,
 *                  53s+, A2o+, K5o+, Q8o+, J8o+, T8o+, 98o
 *
 * Seven players are already gone and only the blinds can call, so this is the
 * widest chart in the app — just over half of all hands.
 *
 * 13 pairs (78) + 59 suited (236) + 30 offsuit (360) = 674 = 50.8%
 */
function buildShortBTN(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '2'),
    ...expandSuited('Q', '2'),
    ...expandSuited('J', '4'),
    ...expandSuited('T', '5'),
    ...expandSuited('9', '5'),
    ...expandSuited('8', '5'),
    ...expandSuited('7', '4'),
    ...expandSuited('6', '4'),
    ...expandSuitedRange('5', '4', '3'), // 54s, 53s
    ...expandOffsuit('A', '2'),
    ...expandOffsuit('K', '5'),
    ...expandOffsuit('Q', '8'),
    ...expandOffsuit('J', '8'),
    ...expandOffsuit('T', '8'),
    '98o',
  ]);
}

// ─── Range registry ───────────────────────────────────────────────────────────

const RANGES: Record<ChartKey, Partial<Record<Seat, ReadonlySet<HandClass>>>> = {
  deep: {
    UTG: buildUTG(),
    UTG1: buildUTG1(),
    UTG2: buildUTG2(),
    LJ: buildLJ(),
    HJ: buildHJ(),
    CO: buildCO(),
    BTN: buildBTN(),
  },
  mid: {
    UTG: buildMidUTG(),
    UTG1: buildMidUTG1(),
    UTG2: buildMidUTG2(),
    LJ: buildMidLJ(),
    HJ: buildMidHJ(),
    CO: buildMidCO(),
    BTN: buildMidBTN(),
  },
  short: {
    UTG: buildShortUTG(),
    UTG1: buildShortUTG1(),
    UTG2: buildShortUTG2(),
    LJ: buildShortLJ(),
    HJ: buildShortHJ(),
    CO: buildShortCO(),
    BTN: buildShortBTN(),
  },
  cash: CASH_RFI,
};

// ─── Public API ───────────────────────────────────────────────────────────────
//
// `depth` is a trailing optional argument on every lookup so that callers that
// predate the tiers — and every existing test — keep reading the deep chart
// without change. It takes any `ChartKey`, so the cash chart reads the same way.

/** The stored set for a seat, or a thrown error if that chart has no such seat. */
function rangeFor(pos: Seat, depth: ChartKey): ReadonlySet<HandClass> {
  const set = RANGES[depth][pos];
  if (!set) throw new Error(`no ${depth} chart for ${pos}`);
  return set;
}

/**
 * Check if a hand class is played (opened at 60bb+/20bb/cash, jammed at 10bb)
 * from the given seat.
 */
export function isOpen(pos: Seat, hc: HandClass, depth: ChartKey = DEFAULT_DEPTH): boolean {
  return rangeFor(pos, depth).has(hc);
}

/**
 * Get the full range set for a seat on a chart.
 * Returns a read-only view of the stored set (same reference across calls).
 */
export function getRangeSet(pos: Seat, depth: ChartKey = DEFAULT_DEPTH): ReadonlySet<HandClass> {
  return rangeFor(pos, depth);
}

/**
 * Count the number of concrete combos in a seat's range on a chart.
 */
export function rangeComboCount(pos: Seat, depth: ChartKey = DEFAULT_DEPTH): number {
  let count = 0;
  for (const hc of rangeFor(pos, depth)) count += combosForClass(hc);
  return count;
}
