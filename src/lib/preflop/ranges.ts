/**
 * Preflop RFI (Raise First In) ranges for 7 non-blind positions, at three
 * tournament stack depths.
 * Pure, no UI imports.
 *
 * Each range is an explicit set of hand classes (not a prefix of the strength
 * ranking). The deep chart is transcribed from docs/PLAN-preflop.md; the two
 * shorter charts are derived from it (see the per-depth notes below).
 *
 * ── Why three depths, and only three ──────────────────────────────────────
 * RFI hand selection barely moves between 40bb and 100bb — a "60bb chart" and
 * a "100bb chart" differ by a couple of combos, which is noise to a learner.
 * So the deep chart is labelled 40bb+ and covers everything from 40bb up.
 * What actually changes in a tournament is the way *down*:
 *
 *   deep  (40bb+) — full playability. Suited connectors and small pairs are
 *                   worth opening because there is money behind to win.
 *   mid   (20bb)  — same overall width, different shape. Implied odds are
 *                   gone (no set-mining, no big suited-connector pots), so
 *                   the weak connectors/gappers come out and high-card equity
 *                   (Ax, offsuit broadways, suited kings) goes in. Early
 *                   position tightens; late position widens, because fold
 *                   equity is worth more than playability.
 *   short (10bb)  — raise-folding no longer exists. You are jamming or
 *                   folding, so the chart is driven by raw showdown equity
 *                   plus fold equity: every pair, every suited ace, and a
 *                   much wider late-position range than any deep chart.
 *
 * ── Implemented widths (% of 1326 combos) ─────────────────────────────────
 * Position  | deep 40bb+ | mid 20bb | short 10bb
 * ----------|------------|----------|-----------
 * UTG       |     13.6%  |   12.5%  |    15.2%
 * UTG1      |     14.6%  |   13.6%  |    16.7%
 * UTG2 (LJ) |     17.8%  |   17.3%  |    20.1%
 * HJ        |     21.3%  |   21.6%  |    24.3%
 * CO        |     26.7%  |   27.9%  |    32.1%
 * BTN       |     45.4%  |   44.8%  |    50.2%
 *
 * (The exact figures are asserted in ranges.test.ts, which is the source of
 * truth if this table drifts.)
 *
 * Expansion decisions are documented inline.
 */

import type { HandClass } from './hands';
import { RANKS } from '../odds';

// ─── Position enum ────────────────────────────────────────────────────────────

export const POSITIONS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN'] as const;
export type Position = (typeof POSITIONS)[number];

// Note: Per the plan, UTG2 and LJ refer to the same seat.
// The positions enum includes both for completeness; the range for 'LJ' equals 'UTG2'.

// ─── Stack depth ──────────────────────────────────────────────────────────────

/** The three tournament stack tiers, deepest first. */
export const DEPTHS = ['deep', 'mid', 'short'] as const;
export type Depth = (typeof DEPTHS)[number];

/** The tier every existing caller gets when it does not name one. */
export const DEFAULT_DEPTH: Depth = 'deep';

export interface DepthMeta {
  id: Depth;
  /** Stack size as shown in tabs and menus, e.g. "40bb+". */
  label: string;
  /** One-word tier name, e.g. "Deep". */
  name: string;
  /** Stack figure written on the felt plaques, e.g. "40+ bb". */
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

export const DEPTH_META: Record<Depth, DepthMeta> = {
  deep: {
    id: 'deep',
    label: '40bb+',
    name: 'Deep',
    stackLabel: '40+ bb',
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
    label: '20bb',
    name: 'Mid',
    stackLabel: '20 bb',
    action: 'open',
    actionLabel: 'Open',
    actionNoun: 'an open',
    rangeKicker: 'Opening range',
    prompt: 'Open or fold?',
    tagline:
      'Implied odds are gone. Weak connectors out, high-card hands in — and late position widens on fold equity.',
  },
  short: {
    id: 'short',
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

// ─── Range definitions — deep (40bb+) ─────────────────────────────────────────

/**
 * Build the UTG opening range.
 *
 * Plan: 55+; ATs+, KTs+, QTs+, JTs, T9s, 98s; AJo+, KQo
 * Plan gives 156 combos = 11.8% (target ~15%).
 * Expanded: added 87s, 76s, 65s (suited connectors) and KJo to reach ~13.6% (180 combos).
 * Rationale: suited connectors down to 65s are standard UTG inclusions in many charts;
 * KJo is a common UTG addition in 6-max-adjacent full-ring charts.
 *
 * Final: 10 pairs (60) + 15 suited (60) + 5 offsuit (60) = 180 = 13.6%
 */
function buildUTG(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 55+
    ...expandPairs('5'),

    // Suited: ATs+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s
    ...expandSuited('A', 'T'),     // ATs, AJs, AQs, AKs
    ...expandSuited('K', 'T'),     // KTs, KJs, KQs
    ...expandSuited('Q', 'T'),     // QTs, QJs
    'JTs',
    'T9s',
    '98s',
    '87s',   // expanded: added
    '76s',   // expanded: added
    '65s',   // expanded: added

    // Offsuit: AJo+, KQo, KJo
    ...expandOffsuit('A', 'J'),    // AJo, AQo, AKo
    'KQo',
    'KJo',   // expanded: added
  ]);
}

/**
 * Build the UTG+1 opening range.
 *
 * Plan: 44+; A9s+ (+A5s–A4s), KTs+, QTs+, J9s+, T9s, 98s; AJo+, KQo
 * Plan gives 178 combos = 13.4% (target ~16%).
 * Expanded: added 87s and KJo to reach ~14.6% (194 combos).
 * Rationale: mirrors UTG expansion; 87s bridges connectivity gap; KJo natural addition.
 *
 * Final: 11 pairs (66) + 17 suited (68) + 5 offsuit (60) = 194 = 14.6%
 */
function buildUTG1(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 44+
    ...expandPairs('4'),

    // Suited: A9s+, A5s-A4s, KTs+, QTs+, J9s+, T9s, 98s, 87s
    ...expandSuited('A', '9'),     // A9s, ATs, AJs, AQs, AKs (5 classes)
    ...expandSuitedRange('A', '5', '4'), // A5s, A4s (wheel aces — plan note)
    ...expandSuited('K', 'T'),     // KTs, KJs, KQs
    ...expandSuited('Q', 'T'),     // QTs, QJs
    ...expandSuited('J', '9'),     // J9s, JTs
    'T9s',
    '98s',
    '87s',   // expanded: added

    // Offsuit: AJo+, KQo, KJo
    ...expandOffsuit('A', 'J'),    // AJo, AQo, AKo
    'KQo',
    'KJo',   // expanded: added
  ]);
}

/**
 * Build the UTG+2 / LJ opening range.
 *
 * Plan: 33+; A8s+ (+A5s–A2s), K9s+, QTs+, J9s+, T9s, 98s, 87s; ATo+, KJo+
 * Plan gives 228 combos = 17.2% (target ~19%).
 * Expanded: added 76s and 65s suited to reach 17.8% (236 combos).
 * Rationale: natural connectivity extension; both are standard LJ suited connectors.
 *
 * Final: 12 pairs (72) + 23 suited (92) + 6 offsuit (72) = 236 = 17.8%
 */
function buildUTG2(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 33+
    ...expandPairs('3'),

    // Suited: A8s+, A5s-A2s, K9s+, QTs+, J9s+, T9s, 98s, 87s, 76s, 65s
    ...expandSuited('A', '8'),     // A8s, A9s, ATs, AJs, AQs, AKs (6 classes)
    ...expandSuitedRange('A', '5', '2'), // A5s, A4s, A3s, A2s (wheel aces progressive)
    ...expandSuited('K', '9'),     // K9s, KTs, KJs, KQs
    ...expandSuited('Q', 'T'),     // QTs, QJs
    ...expandSuited('J', '9'),     // J9s, JTs
    'T9s',
    '98s',
    '87s',
    '76s',   // expanded: added
    '65s',   // expanded: added

    // Offsuit: ATo+, KJo+
    ...expandOffsuit('A', 'T'),    // ATo, AJo, AQo, AKo
    ...expandOffsuit('K', 'J'),    // KJo, KQo
  ]);
}

/**
 * Build the HJ opening range.
 *
 * Plan: 22+; A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+; ATo+, KTo+, QJo
 * Plan gives 282 combos = 21.3% (target ~22%).
 * No expansion needed — 21.3% is within the ±1.5% window of 22% (range: 20.5–23.5%).
 *
 * Final: 13 pairs (78) + 27 suited (108) + 8 offsuit (96) = 282 = 21.3%
 */
function buildHJ(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 22+
    ...expandPairs('2'),

    // Suited: A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+
    ...expandSuited('A', '2'),     // A2s through AKs (12 classes)
    ...expandSuited('K', '9'),     // K9s, KTs, KJs, KQs
    ...expandSuited('Q', '9'),     // Q9s, QTs, QJs
    ...expandSuited('J', '9'),     // J9s, JTs
    ...expandSuited('T', '8'),     // T8s, T9s
    ...expandSuited('9', '7'),     // 97s, 98s
    ...expandSuited('8', '6'),     // 86s, 87s

    // Offsuit: ATo+, KTo+, QJo
    ...expandOffsuit('A', 'T'),    // ATo, AJo, AQo, AKo
    ...expandOffsuit('K', 'T'),    // KTo, KJo, KQo
    'QJo',
  ]);
}

/**
 * Build the CO opening range.
 *
 * Plan: 22+; A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+; A9o+, KTo+, QTo+, JTo
 * Plan gives 342 combos = 25.8% (target ~28%).
 * Expanded: changed A9o+ to A8o+ (+12 combos) to reach 26.7% (354 combos).
 * Rationale: A8o is a standard CO open in most charts; A9o+ was conservative.
 *
 * Final: 13 pairs (78) + 33 suited (132) + 12 offsuit (144) = 354 = 26.7%
 */
function buildCO(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 22+
    ...expandPairs('2'),

    // Suited: A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+
    ...expandSuited('A', '2'),     // A2s through AKs (12 classes)
    ...expandSuited('K', '7'),     // K7s through KQs (6 classes)
    ...expandSuited('Q', '8'),     // Q8s through QJs (4 classes)
    ...expandSuited('J', '8'),     // J8s, J9s, JTs (3 classes)
    ...expandSuited('T', '8'),     // T8s, T9s (2 classes)
    ...expandSuited('9', '7'),     // 97s, 98s (2 classes)
    ...expandSuited('8', '6'),     // 86s, 87s (2 classes)
    ...expandSuited('7', '5'),     // 75s, 76s (2 classes)

    // Offsuit: A8o+, KTo+, QTo+, JTo
    // Expanded: plan had A9o+; changed to A8o+ (+1 class = +12 combos)
    ...expandOffsuit('A', '8'),    // A8o, A9o, ATo, AJo, AQo, AKo
    ...expandOffsuit('K', 'T'),    // KTo, KJo, KQo
    ...expandOffsuit('Q', 'T'),    // QTo, QJo
    'JTo',
  ]);
}

/**
 * Build the BTN opening range.
 *
 * Plan: 22+; A2s+, K5s+, Q6s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s; A7o+, K9o+, Q9o+, J9o+, T9o
 * Plan gives 458 combos = 34.5% (target ~45%).
 * The plan's offsuit range was heavily expanded to reach ~45%.
 * Expanded offsuit: A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+ (29 classes instead of 17).
 * Rationale: BTN at 45% requires a much broader offsuit range; standard GTO BTN charts
 * include Axo, K7o+, Q8o+ etc. The suited range from the plan is kept as-is.
 *
 * Final: 13 pairs (78) + 44 suited (176) + 29 offsuit (348) = 602 = 45.4%
 */
function buildBTN(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 22+
    ...expandPairs('2'),

    // Suited (from plan, unchanged):
    // A2s+, K5s+, Q6s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s
    ...expandSuited('A', '2'),     // A2s through AKs (12 classes)
    ...expandSuited('K', '5'),     // K5s through KQs (8 classes)
    ...expandSuited('Q', '6'),     // Q6s through QJs (6 classes)
    ...expandSuited('J', '7'),     // J7s through JTs (4 classes)
    ...expandSuited('T', '7'),     // T7s, T8s, T9s (3 classes)
    ...expandSuited('9', '6'),     // 96s, 97s, 98s (3 classes)
    ...expandSuited('8', '5'),     // 85s, 86s, 87s (3 classes)
    ...expandSuited('7', '5'),     // 75s, 76s (2 classes)
    ...expandSuited('6', '4'),     // 64s, 65s (2 classes)
    '54s',

    // Offsuit (expanded from plan's A7o+, K9o+, Q9o+, J9o+, T9o):
    // Plan gave only 17 offsuit classes = 204 combos → not enough for 45%.
    // Expanded to: A2o+, K7o+, Q8o+, J8o+, T8o+, 97o+ = 29 classes = 348 combos
    ...expandOffsuit('A', '2'),    // A2o through AKo (12 classes)
    ...expandOffsuit('K', '7'),    // K7o through KQo (6 classes)
    ...expandOffsuit('Q', '8'),    // Q8o through QJo (4 classes)
    ...expandOffsuit('J', '8'),    // J8o, J9o, JTo (3 classes)
    ...expandOffsuit('T', '8'),    // T8o, T9o (2 classes)
    ...expandOffsuit('9', '7'),    // 97o, 98o (2 classes)
  ]);
}


// ─── Range definitions — mid (20bb) ───────────────────────────────────────────
/*
 * The 20bb charts are the deep charts re-shaped, not simply tightened.
 *
 * What comes out: hands whose whole value was implied odds. Small suited
 * connectors and gappers (65s, 76s, 85s, 64s), and small pairs from early
 * position — with 20bb behind you cannot set-mine at 7.5:1 and you cannot win
 * a stack with 65s on a good board, because there is no stack left to win.
 *
 * What goes in: hands that win at showdown or fold out better hands. Suited
 * aces (blockers to the jams behind), offsuit broadways, suited kings.
 *
 * Net effect: early position tightens a point or two, late position widens a
 * point or two. The width barely moves; the shape moves a lot. That is the
 * lesson this tier is here to teach.
 */

/**
 * UTG @ 20bb.
 *
 * vs deep: 98s, 87s, 76s, 65s and KJo out (no implied odds, and KJo plays
 * badly against the calls it gets); 44, A9s and A5s in.
 *
 * 11 pairs (66) + 13 suited (52) + 4 offsuit (48) = 166 = 12.5%
 */
function buildMidUTG(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 44+ — 33/22 open-fold poorly at 20bb from the first seat
    ...expandPairs('4'),

    // Suited: A9s+, A5s, KTs+, QTs+, JTs, T9s
    ...expandSuited('A', '9'),           // A9s, ATs, AJs, AQs, AKs
    'A5s',                               // the one wheel ace — blocker + nut flush
    ...expandSuited('K', 'T'),           // KTs, KJs, KQs
    ...expandSuited('Q', 'T'),           // QTs, QJs
    'JTs',
    'T9s',

    // Offsuit: AJo+, KQo
    ...expandOffsuit('A', 'J'),          // AJo, AQo, AKo
    'KQo',
  ]);
}

/**
 * UTG+1 @ 20bb.
 *
 * vs deep: 87s, 98s and KJo out; 33 and A8s in.
 *
 * 12 pairs (72) + 15 suited (60) + 4 offsuit (48) = 180 = 13.6%
 */
function buildMidUTG1(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 33+
    ...expandPairs('3'),

    // Suited: A8s+, A5s-A4s, KTs+, QTs+, JTs, T9s
    ...expandSuited('A', '8'),           // A8s through AKs (6 classes)
    ...expandSuitedRange('A', '5', '4'), // A5s, A4s
    ...expandSuited('K', 'T'),           // KTs, KJs, KQs
    ...expandSuited('Q', 'T'),           // QTs, QJs
    'JTs',
    'T9s',

    // Offsuit: AJo+, KQo
    ...expandOffsuit('A', 'J'),
    'KQo',
  ]);
}

/**
 * UTG+2 / LJ @ 20bb.
 *
 * vs deep: 76s and 65s out, J9s out; 22, A7s and K9s-shape kept, 98s kept.
 *
 * 13 pairs (78) + 20 suited (80) + 6 offsuit (72) = 230 = 17.3%
 */
function buildMidUTG2(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 22+
    ...expandPairs('2'),

    // Suited: A7s+, A5s-A2s, K9s+, QTs+, JTs, T9s, 98s
    ...expandSuited('A', '7'),           // A7s through AKs (7 classes)
    ...expandSuitedRange('A', '5', '2'), // A5s, A4s, A3s, A2s
    ...expandSuited('K', '9'),           // K9s, KTs, KJs, KQs
    ...expandSuited('Q', 'T'),           // QTs, QJs
    'JTs',
    'T9s',
    '98s',

    // Offsuit: ATo+, KJo+
    ...expandOffsuit('A', 'T'),          // ATo through AKo
    ...expandOffsuit('K', 'J'),          // KJo, KQo
  ]);
}

/**
 * HJ @ 20bb.
 *
 * vs deep: T8s, 97s and 86s out (the gappers); K8s, 87s, and A9o+ instead of
 * ATo+ in. Nearly identical width (286 vs 282), visibly different chart.
 *
 * 13 pairs (78) + 25 suited (100) + 9 offsuit (108) = 286 = 21.6%
 */
function buildMidHJ(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 22+
    ...expandPairs('2'),

    // Suited: A2s+, K8s+, Q9s+, J9s+, T9s, 98s, 87s
    ...expandSuited('A', '2'),           // A2s through AKs (12 classes)
    ...expandSuited('K', '8'),           // K8s through KQs (5 classes)
    ...expandSuited('Q', '9'),           // Q9s, QTs, QJs
    ...expandSuited('J', '9'),           // J9s, JTs
    'T9s',
    '98s',
    '87s',

    // Offsuit: A9o+, KTo+, QJo
    ...expandOffsuit('A', '9'),          // A9o through AKo (5 classes)
    ...expandOffsuit('K', 'T'),          // KTo, KJo, KQo
    'QJo',
  ]);
}

/**
 * CO @ 20bb.
 *
 * vs deep: wider, not tighter — the CO's fold equity against two blinds is
 * worth more at 20bb than the playability it gives up. K6s+ and A7o+ in,
 * 86s and 75s trimmed to the connectors that still flop well.
 *
 * 13 pairs (78) + 31 suited (124) + 14 offsuit (168) = 370 = 27.9%
 */
function buildMidCO(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 22+
    ...expandPairs('2'),

    // Suited: A2s+, K6s+, Q8s+, J8s+, T8s+, 98s, 87s, 76s
    ...expandSuited('A', '2'),           // 12 classes
    ...expandSuited('K', '6'),           // K6s through KQs (7 classes)
    ...expandSuited('Q', '8'),           // Q8s through QJs (4 classes)
    ...expandSuited('J', '8'),           // J8s, J9s, JTs
    ...expandSuited('T', '8'),           // T8s, T9s
    '98s',
    '87s',
    '76s',

    // Offsuit: A7o+, K9o+, QTo+, JTo
    ...expandOffsuit('A', '7'),          // A7o through AKo (7 classes)
    ...expandOffsuit('K', '9'),          // K9o through KQo (4 classes)
    ...expandOffsuit('Q', 'T'),          // QTo, QJo
    'JTo',
  ]);
}

/**
 * BTN @ 20bb.
 *
 * vs deep: every suited king (K2s+) instead of K5s+ — a suited king is a
 * blocker and a top-pair hand, both of which matter more at 20bb than the
 * 85s/64s speculative hands it replaces. Offsuit bottom trimmed (97o out).
 *
 * 13 pairs (78) + 45 suited (180) + 28 offsuit (336) = 594 = 44.8%
 */
function buildMidBTN(): Set<HandClass> {
  return new Set<HandClass>([
    // Pairs: 22+
    ...expandPairs('2'),

    // Suited: A2s+, K2s+, Q6s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s
    ...expandSuited('A', '2'),           // 12 classes
    ...expandSuited('K', '2'),           // K2s through KQs (11 classes)
    ...expandSuited('Q', '6'),           // Q6s through QJs (6 classes)
    ...expandSuited('J', '7'),           // J7s through JTs (4 classes)
    ...expandSuited('T', '7'),           // T7s, T8s, T9s
    ...expandSuited('9', '6'),           // 96s, 97s, 98s
    ...expandSuited('8', '6'),           // 86s, 87s
    ...expandSuited('7', '5'),           // 75s, 76s
    '65s',
    '54s',

    // Offsuit: A2o+, K7o+, Q8o+, J8o+, T8o+, 98o
    ...expandOffsuit('A', '2'),          // 12 classes
    ...expandOffsuit('K', '7'),          // K7o through KQo (6 classes)
    ...expandOffsuit('Q', '8'),          // Q8o through QJo (4 classes)
    ...expandOffsuit('J', '8'),          // J8o, J9o, JTo
    ...expandOffsuit('T', '8'),          // T8o, T9o
    '98o',
  ]);
}

// ─── Range definitions — short (10bb, jam or fold) ────────────────────────────
/*
 * At 10bb there is no raise-fold: an open commits you, so the only two actions
 * are shove and fold. That changes what a hand is worth.
 *
 *   - Every pocket pair jams from every seat. 22 is a coinflip against two
 *     overcards and it never has to play a turn.
 *   - Every suited ace jams from every seat, for the same reason plus the
 *     ace blocker against the calls behind.
 *   - Small suited connectors mostly stay out until late position: they are
 *     the worst hands to get called by, since they need to make something.
 *   - Late position explodes. The BTN jams over half its hands because seven
 *     players are already out and only two blinds can call.
 *
 * Widths are noticeably wider than the deep chart at every seat — that is
 * correct, and it is the counter-intuitive bit worth drilling. Jamming buys
 * fold equity that a raise-fold line never gets.
 */

/**
 * UTG @ 10bb jam.
 *
 * 13 pairs (78) + 19 suited (76) + 4 offsuit (48) = 202 = 15.2%
 */
function buildShortUTG(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),                 // every pair jams
    ...expandSuited('A', '2'),           // every suited ace jams
    ...expandSuited('K', '9'),           // K9s through KQs (4 classes)
    ...expandSuited('Q', 'T'),           // QTs, QJs
    'JTs',
    ...expandOffsuit('A', 'J'),          // AJo, AQo, AKo
    'KQo',
  ]);
}

/**
 * UTG+1 @ 10bb jam.
 *
 * 13 pairs (78) + 21 suited (84) + 5 offsuit (60) = 222 = 16.7%
 */
function buildShortUTG1(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '8'),           // K8s through KQs (5 classes)
    ...expandSuited('Q', 'T'),           // QTs, QJs
    'JTs',
    'T9s',
    ...expandOffsuit('A', 'T'),          // ATo through AKo (4 classes)
    'KQo',
  ]);
}

/**
 * UTG+2 / LJ @ 10bb jam.
 *
 * 13 pairs (78) + 26 suited (104) + 7 offsuit (84) = 266 = 20.1%
 */
function buildShortUTG2(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '6'),           // K6s through KQs (7 classes)
    ...expandSuited('Q', '9'),           // Q9s, QTs, QJs
    ...expandSuited('J', '9'),           // J9s, JTs
    'T9s',
    '98s',
    ...expandOffsuit('A', 'T'),          // ATo through AKo
    ...expandOffsuit('K', 'J'),          // KJo, KQo
    'QJo',
  ]);
}

/**
 * HJ @ 10bb jam.
 *
 * 13 pairs (78) + 34 suited (136) + 9 offsuit (108) = 322 = 24.3%
 */
function buildShortHJ(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '2'),           // every suited king (11 classes)
    ...expandSuited('Q', '8'),           // Q8s through QJs (4 classes)
    ...expandSuited('J', '8'),           // J8s, J9s, JTs
    ...expandSuited('T', '8'),           // T8s, T9s
    '98s',
    '87s',
    ...expandOffsuit('A', '9'),          // A9o through AKo (5 classes)
    ...expandOffsuit('K', 'T'),          // KTo, KJo, KQo
    'QJo',
  ]);
}

/**
 * CO @ 10bb jam.
 *
 * 13 pairs (78) + 45 suited (180) + 14 offsuit (168) = 426 = 32.1%
 */
function buildShortCO(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),
    ...expandSuited('K', '2'),           // 11 classes
    ...expandSuited('Q', '5'),           // Q5s through QJs (7 classes)
    ...expandSuited('J', '7'),           // J7s through JTs (4 classes)
    ...expandSuited('T', '7'),           // T7s, T8s, T9s
    ...expandSuited('9', '6'),           // 96s, 97s, 98s
    ...expandSuited('8', '6'),           // 86s, 87s
    ...expandSuited('7', '5'),           // 75s, 76s
    '65s',
    ...expandOffsuit('A', '7'),          // A7o through AKo (7 classes)
    ...expandOffsuit('K', '9'),          // K9o through KQo (4 classes)
    ...expandOffsuit('Q', 'T'),          // QTo, QJo
    'JTo',
  ]);
}

/**
 * BTN @ 10bb jam.
 *
 * Seven players are already gone and only the blinds can call, so this is the
 * widest chart in the app — over half of all hands.
 *
 * 13 pairs (78) + 57 suited (228) + 30 offsuit (360) = 666 = 50.2%
 */
function buildShortBTN(): Set<HandClass> {
  return new Set<HandClass>([
    ...expandPairs('2'),
    ...expandSuited('A', '2'),           // 12 classes
    ...expandSuited('K', '2'),           // 11 classes
    ...expandSuited('Q', '2'),           // 10 classes
    ...expandSuited('J', '5'),           // J5s through JTs (6 classes)
    ...expandSuited('T', '6'),           // T6s through T9s (4 classes)
    ...expandSuited('9', '5'),           // 95s through 98s (4 classes)
    ...expandSuited('8', '5'),           // 85s, 86s, 87s
    ...expandSuited('7', '4'),           // 74s, 75s, 76s
    ...expandSuited('6', '4'),           // 64s, 65s
    ...expandSuited('5', '3'),           // 53s, 54s
    ...expandOffsuit('A', '2'),          // 12 classes
    ...expandOffsuit('K', '5'),          // K5o through KQo (8 classes)
    ...expandOffsuit('Q', '8'),          // Q8o through QJo (4 classes)
    ...expandOffsuit('J', '8'),          // J8o, J9o, JTo
    ...expandOffsuit('T', '8'),          // T8o, T9o
    '98o',
  ]);
}

// ─── Range registry ───────────────────────────────────────────────────────────

const RANGES: Record<Depth, Record<Position, Set<HandClass>>> = {
  deep: {
    UTG: buildUTG(),
    UTG1: buildUTG1(),
    UTG2: buildUTG2(),
    LJ: buildUTG2(), // LJ = UTG2 per plan
    HJ: buildHJ(),
    CO: buildCO(),
    BTN: buildBTN(),
  },
  mid: {
    UTG: buildMidUTG(),
    UTG1: buildMidUTG1(),
    UTG2: buildMidUTG2(),
    LJ: buildMidUTG2(),
    HJ: buildMidHJ(),
    CO: buildMidCO(),
    BTN: buildMidBTN(),
  },
  short: {
    UTG: buildShortUTG(),
    UTG1: buildShortUTG1(),
    UTG2: buildShortUTG2(),
    LJ: buildShortUTG2(),
    HJ: buildShortHJ(),
    CO: buildShortCO(),
    BTN: buildShortBTN(),
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────
//
// `depth` is a trailing optional argument on every lookup so that callers that
// predate the tiers — and every existing test — keep reading the deep chart
// without change.

/**
 * Check if a hand class is played (opened at 40bb+/20bb, jammed at 10bb) from
 * the given position.
 */
export function isOpen(pos: Position, hc: HandClass, depth: Depth = DEFAULT_DEPTH): boolean {
  return RANGES[depth][pos].has(hc);
}

/**
 * Get the full range set for a position at a depth.
 * Returns a read-only view of the stored set (same reference across calls).
 */
export function getRangeSet(
  pos: Position,
  depth: Depth = DEFAULT_DEPTH
): ReadonlySet<HandClass> {
  return RANGES[depth][pos];
}

/**
 * Count the number of concrete combos in a position's range at a depth.
 */
export function rangeComboCount(pos: Position, depth: Depth = DEFAULT_DEPTH): number {
  let count = 0;
  for (const hc of RANGES[depth][pos]) {
    const { type } = (() => {
      if (hc.length === 2) return { type: 'pair' as const };
      return { type: (hc[2] === 's' ? 'suited' : 'offsuit') as 'suited' | 'offsuit' };
    })();
    if (type === 'pair') count += 6;
    else if (type === 'suited') count += 4;
    else count += 12;
  }
  return count;
}
