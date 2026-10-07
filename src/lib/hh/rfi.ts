/**
 * The one check that fires at n = 1: folding a hand the chart opens. Every
 * other number in the report is a frequency and needs a sample; this is a
 * per-hand fact — the chart either opens AJo from the cutoff or it does not.
 *
 * The carve-out it lives inside: `docs/leak-coaching.md` forbids coaching
 * opening *frequency*, because that is what the preflop trainer drills. A named
 * fold of a named hand from a named seat is not a frequency, and it is exactly
 * the thing the trainer cannot show you — it happened at a real table.
 */

import { handClass, strengthRank, parseHandClass, combosForClass } from '../preflop/hands.ts';
import type { HandClass } from '../preflop/hands.ts';
import {
  CASH_SEATS,
  CHART_META,
  DEPTH_META,
  getRangeSet,
  isOpen,
  rangeComboCount,
  type ChartKey,
  type Depth,
  type Position,
  type Seat,
} from '../preflop/ranges.ts';
import type { HeroHand } from './hero.ts';

/**
 * Tournament seats by players left to act behind, BTN first. The charts are
 * 9-max, and a seat's range tracks how many players it opens into — so a seat
 * reads its chart by distance from the button, never by its label.
 * `positionNames` names late seats from the button (LJ…BTN) but early seats
 * from the front (UTG, UTG1…), so a 7-handed "UTG" has four players behind it:
 * the 9-max UTG+2. Further out than the charts model clamps to UTG.
 */
const MTT_BY_DISTANCE: readonly Position[] = ['BTN', 'CO', 'HJ', 'LJ', 'UTG2', 'UTG1', 'UTG'];

/**
 * The chart seat and chart a first-in fold is read against, or null when no
 * chart applies.
 *
 * Cash reads the 6-max 100bb chart, which has the small blind (raise-or-fold)
 * and no seat earlier than the lojack: a 7+-handed early seat reads LJ, the
 * tightest there is. Tournaments read the 60bb+ / 20bb / 10bb tiers by stack,
 * which are seven non-blind seats — `isOpen('SB', …)` would throw there. The
 * big blind never has a first-in fold, and heads-up is its own game.
 */
function chartFor(h: HeroHand): { seat: Seat; key: ChartKey } | null {
  if (h.position === 'BB' || h.position === 'SB/BTN') return null;
  if (h.variant === 'cash') {
    if ((CASH_SEATS as readonly string[]).includes(h.position)) {
      return { seat: h.position as Seat, key: 'cash' };
    }
    return /^UTG\d*$/.test(h.position) ? { seat: 'LJ', key: 'cash' } : null;
  }
  if (h.position === 'SB') return null;
  const seat = MTT_BY_DISTANCE[Math.min(h.seatsToButton, MTT_BY_DISTANCE.length - 1)];
  return { seat, key: depthFor(h.stackBB) };
}

/**
 * Which chart a stack reads. The charts are 60bb / 20bb / 10bb, cut at 40bb
 * and 15bb.
 *
 * Exported because `labels.ts` buckets stack depth for its groups and a second
 * scheme would mean two answers to "how deep was this" in one payload.
 */
export function depthFor(stackBB: number): Depth {
  if (stackBB >= 40) return 'deep';
  if (stackBB >= 15) return 'mid';
  return 'short';
}

/**
 * The chart a hand's preflop spot belongs to: the one 6-max 100bb chart for
 * cash, a stack tier for a tournament. Every preflop list's `depth` reads this,
 * so a cash entry never names a tournament tier it was not played against.
 * Hero's own starting stack, not the effective stack, as for `depthFor`.
 */
export function chartKeyForHand(h: Pick<HeroHand, 'variant' | 'stackBB'>): ChartKey {
  return h.variant === 'cash' ? 'cash' : depthFor(h.stackBB);
}

/** Stacks in this span sit between two charts and match neither well. */
const NO_CHART_FROM = 28;
const NO_CHART_TO = 45;

/** Share of a range that is close enough to the edge to be a judgement call. */
const TOLERANCE = 0.03;

/** Weakest family first: an offsuit fold forgives more easily than a pair. */
const FAMILY_ORDER: Record<'offsuit' | 'suited' | 'pair', number> = {
  offsuit: 0,
  suited: 1,
  pair: 2,
};

/**
 * The bottom sliver of a range — folds inside it are never flagged.
 *
 * At least 3% of the range's combos, accumulated from its weakest class upward.
 * A flat "about 40 combos" would be 19% of UTG-deep and 6% of the button, which
 * is not one tolerance but seven different ones wearing the same number.
 *
 * "At least" because a whole class goes in or stays out — the realised band
 * runs 3.2%–5.6% depending on the seat. That errs toward staying quiet, which
 * is the right direction for a check that accuses you by name.
 *
 * Below 15bb the chart is a jam chart and there is no edge to be near: you are
 * in or you are out, so the band is empty.
 */
function toleranceBand(pos: Seat, depth: ChartKey): ReadonlySet<HandClass> {
  if (depth === 'short') return new Set();

  const budget = Math.ceil(TOLERANCE * rangeComboCount(pos, depth));
  const weakestFirst = [...getRangeSet(pos, depth)].sort((a, b) => {
    const fa = FAMILY_ORDER[parseHandClass(a).type];
    const fb = FAMILY_ORDER[parseHandClass(b).type];
    if (fa !== fb) return fa - fb;
    // strengthRank counts 0 = strongest, so the larger rank is the weaker hand.
    return strengthRank(b) - strengthRank(a);
  });

  const band = new Set<HandClass>();
  let combos = 0;
  for (const hc of weakestFirst) {
    if (combos >= budget) break;
    band.add(hc);
    combos += combosForClass(hc);
  }
  return band;
}

export interface RfiFold {
  id: string;
  /** The chart seat read, which can differ from the table label (see `chartFor`). */
  position: Seat;
  hand: HandClass;
  cards: string[];
  stackBB: number;
  /** The chart read: a tournament tier, or `'cash'` for the 6-max 100bb chart. */
  depth: ChartKey;
  /** "an open" at 20bb+ and in cash, "a jam" below 15bb — the chart's own action. */
  action: string;
  /** Set when a tournament stack sits between two charts. */
  caveat: string | null;
}

/**
 * Folds of hands the chart plays, first in, outside the tolerance band.
 *
 * Folding behind limpers is skipped: it is not a raise-first-in spot, and the
 * chart says nothing about it.
 */
export function rfiFolds(hands: HeroHand[]): RfiFold[] {
  const found: RfiFold[] = [];

  for (const h of hands) {
    if (h.role !== 'fold' || !h.firstInOpp || h.limpersAhead > 0) continue;
    if (!h.cards) continue;

    const chart = chartFor(h);
    if (!chart) continue;
    const { seat, key } = chart;

    const hand = handClass(h.cards[0], h.cards[1]);
    if (!isOpen(seat, hand, key)) continue;
    if (toleranceBand(seat, key).has(hand)) continue;

    found.push({
      id: h.id,
      position: seat,
      hand,
      cards: h.cards,
      stackBB: Number(h.stackBB.toFixed(1)),
      depth: key,
      action: CHART_META[key].actionNoun,
      // Tournament only: cash has the one 100bb chart, so there is no "between".
      caveat:
        key !== 'cash' && h.stackBB >= NO_CHART_FROM && h.stackBB <= NO_CHART_TO
          ? `${Math.round(h.stackBB)}bb sits between the 20bb and 60bb charts; read against ${DEPTH_META[key].label}`
          : null,
    });
  }

  return found;
}
