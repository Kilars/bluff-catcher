/**
 * boundary — the companion sentence for an unlabelled range grid.
 *
 * PLAN-phone §3.1 drops the 169 cell labels on the phone, because 169 labels at
 * 10px is noise and 6px is illegible. The grid then shows *shape* only, and two
 * things give the shape words again: the drag-scrub readout (one cell, live),
 * and this — one derived sentence naming where the range stops:
 *
 *     HJ opens A2s+ suited, 33+ pairs, A8o+ offsuit
 *
 * It needs no new data. Every chart in `ranges.ts` is a set of hand classes, so
 * each hi-rank row of the matrix is scanned for its lowest included lo-rank and
 * the standard "+"-shorthand falls out. The verb comes from `DEPTH_META`: the
 * 10bb tier jams, it does not open.
 *
 * Pure. No UI imports, no React.
 */

import { RANKS } from '../odds';
import type { HandClass } from './hands';
import {
  DEFAULT_DEPTH,
  DEPTH_META,
  getRangeSet,
  type Depth,
  type Position,
} from './ranges';

// ─── Seat labels ──────────────────────────────────────────────────────────────

/**
 * Short seat names, as written in the sentence and on a phone tab.
 * `UTG1` is a position *id*; "UTG+1" is what a player calls the seat.
 */
const POSITION_LABELS: Record<Position, string> = {
  UTG: 'UTG',
  UTG1: 'UTG+1',
  UTG2: 'UTG+2',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
};

/** The seat's short display name, e.g. `UTG1` → "UTG+1". */
export function positionLabel(pos: Position): string {
  return POSITION_LABELS[pos];
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Which of the three families of the matrix a boundary describes. */
export type Family = 'pair' | 'suited' | 'offsuit';

/**
 * One row of the matrix, summarised by where the range stops.
 *
 * A row is a hi-rank: the suited `A` row is A2s…AKs, the offsuit `K` row is
 * K2o…KQo. Pairs are a single pseudo-row whose `hi` is the lowest pair's rank.
 */
export interface BoundaryRow {
  family: Family;
  /** The row's hi rank, e.g. 'A'. For pairs, the lowest pair's rank. */
  hi: string;
  /** Lowest lo-rank included in the row, e.g. '2'. For pairs, same as `hi`. */
  lo: string;
  /** Standard shorthand for the row, e.g. "A2s+", "K3s+", "A8o+", "33+". */
  label: string;
  /** How many hand classes of this row are in the range. */
  count: number;
  /**
   * True when the "+" shorthand is exactly right: the included classes form an
   * unbroken run from `lo` up to the top of the row (AKs for the suited ace
   * row, AA for pairs). Every chart in `ranges.ts` is built from `expand*`
   * helpers, so all of them are exact — `boundary.test.ts` asserts it across
   * all 21 charts, which is what keeps the shorthand honest if a chart is ever
   * hand-edited into a gap.
   */
  exact: boolean;
}

/** The full scan of one seat's chart at one depth. */
export interface RangeBoundary {
  position: Position;
  depth: Depth;
  /** "opens" at 40bb+/20bb, "jams" at 10bb. */
  verb: string;
  /** The pair row, or null when the range holds no pair. */
  pairs: BoundaryRow | null;
  /** Suited rows, hi-rank descending (A first). Rows with no entries omitted. */
  suited: BoundaryRow[];
  /** Offsuit rows, hi-rank descending. Rows with no entries omitted. */
  offsuit: BoundaryRow[];
  /** The widest suited row — the sentence's headline. Null if none. */
  suitedHeadline: BoundaryRow | null;
  /** The widest offsuit row. Null if none. */
  offsuitHeadline: BoundaryRow | null;
  /** The companion sentence. */
  sentence: string;
}

// ─── Row scanning ─────────────────────────────────────────────────────────────

/**
 * Scan one hi-rank row of the matrix.
 *
 * `RANKS` is ascending ('2' … 'A'), so a row's lo-ranks are the indices below
 * `hiIdx`. Returns null when the range holds none of them.
 */
function scanRow(
  set: ReadonlySet<HandClass>,
  hiIdx: number,
  suffix: 's' | 'o'
): BoundaryRow | null {
  const hi = RANKS[hiIdx];
  let lowest = -1;
  let highest = -1;
  let count = 0;

  for (let lo = 0; lo < hiIdx; lo++) {
    if (!set.has(hi + RANKS[lo] + suffix)) continue;
    if (lowest < 0) lowest = lo;
    highest = lo;
    count++;
  }
  if (count === 0) return null;

  // Exact when the run is unbroken (no holes) and reaches the top of the row.
  const unbroken = highest - lowest + 1 === count;
  const reachesTop = highest === hiIdx - 1;

  return {
    family: suffix === 's' ? 'suited' : 'offsuit',
    hi,
    lo: RANKS[lowest],
    label: `${hi}${RANKS[lowest]}${suffix}+`,
    count,
    exact: unbroken && reachesTop,
  };
}

/** Scan the pocket pairs as one row: "66+" and whether that is exact. */
function scanPairs(set: ReadonlySet<HandClass>): BoundaryRow | null {
  let lowest = -1;
  let highest = -1;
  let count = 0;

  for (let i = 0; i <= 12; i++) {
    if (!set.has(RANKS[i] + RANKS[i])) continue;
    if (lowest < 0) lowest = i;
    highest = i;
    count++;
  }
  if (count === 0) return null;

  const rank = RANKS[lowest];
  return {
    family: 'pair',
    hi: rank,
    lo: rank,
    label: `${rank}${rank}+`,
    count,
    // "66+" claims every pair from 66 to AA.
    exact: highest - lowest + 1 === count && highest === 12,
  };
}

/**
 * The row that reaches furthest down the matrix — the one worth naming.
 *
 * Lowest lo-rank wins; ties break to the higher hi-rank, so a button holding
 * A2s, K2s and Q2s is described by its ace row, the anchor every RFI chart is
 * read from.
 */
function headline(rows: BoundaryRow[]): BoundaryRow | null {
  let best: BoundaryRow | null = null;
  for (const row of rows) {
    if (best === null) {
      best = row;
      continue;
    }
    const loDelta = RANKS.indexOf(row.lo) - RANKS.indexOf(best.lo);
    if (loDelta < 0 || (loDelta === 0 && RANKS.indexOf(row.hi) > RANKS.indexOf(best.hi))) {
      best = row;
    }
  }
  return best;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan a seat's chart at a depth and derive every row boundary plus the
 * companion sentence.
 *
 * `depth` is trailing and optional, matching every other lookup in
 * `ranges.ts`: callers that predate the tiers read the 40bb+ chart.
 */
export function rangeBoundary(pos: Position, depth: Depth = DEFAULT_DEPTH): RangeBoundary {
  const set = getRangeSet(pos, depth);

  const suited: BoundaryRow[] = [];
  const offsuit: BoundaryRow[] = [];
  // Descending hi-rank: A first, and no row below 3 exists (32s is the '3' row).
  for (let hiIdx = 12; hiIdx >= 1; hiIdx--) {
    const s = scanRow(set, hiIdx, 's');
    if (s) suited.push(s);
    const o = scanRow(set, hiIdx, 'o');
    if (o) offsuit.push(o);
  }

  const pairs = scanPairs(set);
  const suitedHeadline = headline(suited);
  const offsuitHeadline = headline(offsuit);
  const verb = DEPTH_META[depth].action === 'jam' ? 'jams' : 'opens';

  // Suited leads: suited aces are the first hands into every RFI range and the
  // last ones out of it, so that clause is the one that moves seat to seat.
  const clauses: string[] = [];
  if (suitedHeadline) clauses.push(`${suitedHeadline.label} suited`);
  if (pairs) clauses.push(`${pairs.label} pairs`);
  if (offsuitHeadline) clauses.push(`${offsuitHeadline.label} offsuit`);

  const sentence =
    clauses.length === 0
      ? `${POSITION_LABELS[pos]} folds everything`
      : `${POSITION_LABELS[pos]} ${verb} ${clauses.join(', ')}`;

  return {
    position: pos,
    depth,
    verb,
    pairs,
    suited,
    offsuit,
    suitedHeadline,
    offsuitHeadline,
    sentence,
  };
}

/**
 * Just the sentence: "HJ opens A2s+ suited, 33+ pairs, A8o+ offsuit".
 *
 * This is what the phone range view prints under the scrub readout.
 */
export function boundarySentence(pos: Position, depth: Depth = DEFAULT_DEPTH): string {
  return rangeBoundary(pos, depth).sentence;
}
