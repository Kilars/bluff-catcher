/**
 * Cold-calls: Hero flatted a raise from a non-blind seat rather than 3-betting or
 * folding. Like `rfiFolds` (rfi.ts) this is a per-hand preflop fact, sound to coach at
 * n = 1 — flatting is a specific decision, not a frequency — so every one is listed, no
 * sampling. Whether a given flat was a leak is the coach's call from the seat, the
 * opener's seat, the hand and the stack: a small pair set-mining in position is fine, a
 * dominated broadway out of position is the leak `docs/leak-coaching.md` §LEAK-COLDCALL
 * describes.
 *
 * Blind like everything else in the payload: a cold-call is knowable before the flop, the
 * cards are Hero's own, and no result rides along.
 */

import { handClass } from '../preflop/hands.ts';
import type { HandClass } from '../preflop/hands.ts';
import { depthFor } from './rfi.ts';
import type { Depth } from '../preflop/ranges.ts';
import type { HeroHand } from './hero.ts';

export interface ColdCall {
  id: string;
  /** Hero's seat. */
  position: string;
  /** Seat of the raiser Hero flatted — UTG vs BTN changes the read entirely. */
  vsPos: string | null;
  cards: string[];
  hand: HandClass;
  stackBB: number;
  depth: Depth;
  /** Limpers already in — a flat behind limpers is a multiway pot with a capped range. */
  limpersAhead: number;
}

/** Every hand Hero cold-called (flatted a raise from a non-blind seat). */
export function coldCalls(hands: HeroHand[]): ColdCall[] {
  const found: ColdCall[] = [];
  for (const h of hands) {
    if (h.role !== 'cold-call' || !h.cards) continue;
    found.push({
      id: h.id,
      position: h.position,
      vsPos: h.facingRaiserPos,
      cards: h.cards,
      hand: handClass(h.cards[0], h.cards[1]),
      stackBB: Number(h.stackBB.toFixed(1)),
      depth: depthFor(h.stackBB),
      limpersAhead: h.limpersAhead,
    });
  }
  return found;
}
