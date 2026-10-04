/**
 * Facing a raise over Hero's own raise — the spot the `foldTo3Bet` stat counts
 * but never names a hand for. Hero opened and got 3-bet, or Hero 3-bet and got
 * 4-bet; either way the decision is fold / call / re-raise, and the chart the
 * preflop trainer drills stops at the open, so this is the first live spot it
 * does not cover. `heroRole` tells the two apart: an `open`/`iso-raise` facing a
 * 3-bet, a `3bet`/`squeeze` facing a 4-bet.
 *
 * Like `rfiFolds` and `coldCalls` this is a per-hand preflop fact, sound at
 * n = 1 — whether a fold was an over-fold is the coach's call from the seat, the
 * raiser's seat, the hand, whether a caller was already in (a squeeze, so the
 * pot is multiway and Hero's continuing range tightens) and the size faced.
 * Blind like the rest of the payload: the cards are Hero's own and no result
 * rides along.
 */

import { handClass } from '../preflop/hands.ts';
import type { HandClass } from '../preflop/hands.ts';
import { depthFor } from './rfi.ts';
import type { Depth } from '../preflop/ranges.ts';
import type { HeroHand, PreflopRole } from './hero.ts';

export interface Faced3Bet {
  id: string;
  /** Hero's seat. */
  position: string;
  /** How Hero had entered — `open` facing a 3-bet vs `3bet` facing a 4-bet. */
  heroRole: PreflopRole;
  /** Seat of the villain who raised over Hero — the pivot, as for a cold-call. */
  threeBettorPos: string | null;
  cards: string[];
  hand: HandClass;
  stackBB: number;
  depth: Depth;
  /** A caller was already in: a squeeze, so the pot is heading multiway. */
  multiway: boolean;
  /** The raise Hero faced, as a fraction of the pot it raised over. */
  sizing: number | null;
  /** What Hero did: fold / call / re-raise. */
  response: 'fold' | 'call' | '4bet' | null;
}

/** Every hand where Hero's raise was raised over the top. */
export function faced3Bets(hands: HeroHand[]): Faced3Bet[] {
  const found: Faced3Bet[] = [];
  for (const h of hands) {
    if (!h.faced3Bet || !h.cards) continue;
    found.push({
      id: h.id,
      position: h.position,
      heroRole: h.role,
      threeBettorPos: h.threeBettorPos,
      cards: h.cards,
      hand: handClass(h.cards[0], h.cards[1]),
      stackBB: Number(h.stackBB.toFixed(1)),
      depth: depthFor(h.stackBB),
      multiway: h.faced3BetMultiway,
      sizing: h.faced3BetSizing === null ? null : Number(h.faced3BetSizing.toFixed(2)),
      response: h.faced3BetResponse,
    });
  }
  return found;
}
