/**
 * The one check that fires at n = 1: folding a hand the chart opens.
 *
 * Every other number in the report is a frequency and needs a sample. This is
 * a per-hand fact — the chart either opens AJo from the cutoff or it does not —
 * so it is the only finding that means something after one session.
 *
 * The carve-out it lives inside: `docs/leak-coaching.md` forbids coaching
 * opening *frequency*, because that is what the preflop trainer drills. A named
 * fold of a named hand from a named seat is not a frequency, and it is exactly
 * the thing the trainer cannot show you — it happened at a real table.
 */

import { handClass, strengthRank, parseHandClass, combosForClass } from '../preflop/hands.ts';
import type { HandClass } from '../preflop/hands.ts';
import {
  DEPTH_META,
  POSITIONS,
  getRangeSet,
  isOpen,
  rangeComboCount,
  type Depth,
  type Position,
} from '../preflop/ranges.ts';
import type { HeroHand } from './hero.ts';

/**
 * Map a parsed table label onto a chart seat, or null when no chart applies.
 *
 * The blinds have no RFI chart — `ranges.ts` is seven non-blind seats — and
 * `isOpen('SB', …)` would throw on the lookup. Heads-up is its own game.
 * Deeper early seats than the charts model (a 10-handed UTG+3) clamp to UTG,
 * which is the tightest chart there is.
 *
 * Short tables need no special case: `positionNames` already labels seats by
 * distance from the button, so a 6-max lojack and a 9-max lojack are the same
 * seat and read the same chart.
 */
export function chartPosition(label: string): Position | null {
  if (label === 'SB' || label === 'BB' || label === 'SB/BTN') return null;
  if (/^UTG[3-9]$/.test(label)) return 'UTG';
  return (POSITIONS as readonly string[]).includes(label) ? (label as Position) : null;
}

/** Which chart a stack reads. The charts are 60bb+ / 20bb / 10bb. */
export function depthFor(stackBB: number): Depth {
  if (stackBB >= 40) return 'deep';
  if (stackBB >= 15) return 'mid';
  return 'short';
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
 * 3% of the range's combos, accumulated from its weakest class upward. A flat
 * "about 40 combos" would be 19% of UTG-deep and 6% of the button, which is not
 * one tolerance but seven different ones wearing the same number.
 *
 * Below 15bb the chart is a jam chart and there is no edge to be near: you are
 * in or you are out, so the band is empty.
 */
export function toleranceBand(pos: Position, depth: Depth): ReadonlySet<HandClass> {
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
  position: Position;
  hand: HandClass;
  cards: string[];
  stackBB: number;
  depth: Depth;
  /** "an open" at 20bb+, "a jam" below 15bb — the chart's own action. */
  action: string;
  /** Set when the stack sits between two charts. */
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
    if (!h.cards || h.cards.length < 2) continue;

    const pos = chartPosition(h.position);
    if (!pos) continue;

    const depth = depthFor(h.stackBB);
    const hand = handClass(h.cards[0], h.cards[1]);
    if (!isOpen(pos, hand, depth)) continue;
    if (toleranceBand(pos, depth).has(hand)) continue;

    found.push({
      id: h.id,
      position: pos,
      hand,
      cards: h.cards,
      stackBB: Number(h.stackBB.toFixed(1)),
      depth,
      action: DEPTH_META[depth].actionNoun,
      caveat:
        h.stackBB >= NO_CHART_FROM && h.stackBB <= NO_CHART_TO
          ? `${Math.round(h.stackBB)}bb sits between the 20bb and 60bb charts — read against the ${DEPTH_META[depth].label} chart, which is the nearer of the two`
          : null,
    });
  }

  return found;
}
