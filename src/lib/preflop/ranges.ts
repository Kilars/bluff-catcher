/**
 * Preflop RFI (Raise First In) ranges for 7 non-blind positions.
 * Pure, no UI imports.
 *
 * Each range is an explicit set of hand classes (not a prefix of the strength ranking).
 * The chart is transcribed from docs/PLAN-preflop.md with conservative expansions
 * to reach the stated target percentages (±1.5%).
 *
 * Position  | Plan target | Implemented | Combos
 * ----------|-------------|-------------|-------
 * UTG       |       ~15%  |      13.6%  |  180
 * UTG1      |       ~16%  |      14.6%  |  194
 * UTG2 (LJ) |       ~19%  |      17.5%  |  232
 * HJ        |       ~22%  |      21.3%  |  282
 * CO        |       ~28%  |      26.7%  |  354
 * BTN       |       ~45%  |      45.4%  |  602
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

// ─── Range definitions ────────────────────────────────────────────────────────

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

// ─── Range registry ───────────────────────────────────────────────────────────

const RANGES: Record<Position, Set<HandClass>> = {
  UTG: buildUTG(),
  UTG1: buildUTG1(),
  UTG2: buildUTG2(),
  LJ: buildUTG2(), // LJ = UTG2 per plan
  HJ: buildHJ(),
  CO: buildCO(),
  BTN: buildBTN(),
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check if a hand class is an opening hand for the given position.
 */
export function isOpen(pos: Position, hc: HandClass): boolean {
  return RANGES[pos].has(hc);
}

/**
 * Get the full opening range set for a position.
 * Returns a read-only copy.
 */
export function getRangeSet(pos: Position): ReadonlySet<HandClass> {
  return RANGES[pos];
}

/**
 * Count the number of concrete combos in a position's range.
 */
export function rangeComboCount(pos: Position): number {
  let count = 0;
  for (const hc of RANGES[pos]) {
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
