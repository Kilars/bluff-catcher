/**
 * The biggest hands Hero played, ranked by what Hero chose to put in — the spots
 * where the pressure was highest. `--mode pots` answers the same question with
 * the results attached, which is why the coaching agent may not read it: a lost
 * pot reads as a bad decision. This is the blind version: every decision with
 * the pot, the price and the hand strength as they stood when Hero acted, and
 * nothing about how the hand ended.
 *
 * The ranking is blind too. `grossBB` counts chips Hero committed *before* an
 * uncalled bet came back, so a river bet that got through and one that got
 * called rank the same. No showdown flag, no net, and the board stops at the
 * last street Hero acted on.
 */

import { handClass as postflopClass, type HandClass as PostflopClass } from '../read.ts';
import { handClass } from '../preflop/hands.ts';
import type { HandClass } from '../preflop/hands.ts';
import type { ChartKey } from '../preflop/ranges.ts';
import { BOARD_SEEN } from './board.ts';
import { potOdds, shoved, sizing } from './decisions.ts';
import type { HeroHand, PreflopRole } from './hero.ts';
import type { Street } from './parse.ts';
import { chartKeyForHand } from './rfi.ts';

export const BIG_SPOTS_LIMIT = 20;

export interface BigSpotDecision {
  street: Street;
  action: string;
  /** Chips this action added, in big blinds; 0 for a check or fold. */
  amountBB: number;
  /** Pot before the action, in big blinds. */
  potBB: number;
  /** What Hero had to put in to continue, in big blinds. */
  toCallBB: number;
  /** A bet or raise as a fraction of the pot, at what an opponent can call;
   * null otherwise and on an all-in. */
  sizing: number | null;
  /** All-in or all but, by the labels' rule (`shoved` in decisions.ts). */
  allIn: boolean;
  /** Pot odds on a call: the share of the final pot Hero is buying.
   * `potBB` already holds villain's bet, so this is toCall / (pot + toCall) —
   * with the pot Hero can win, which is less than `potBB` when the bet was
   * bigger than Hero's stack (`potBB` stays the printed pot). */
  equityNeeded: number | null;
  /** Hand strength on the board as it stood; null preflop. */
  handClass: PostflopClass | null;
}

export interface BigSpot {
  id: string;
  position: string;
  role: PreflopRole;
  pfa: boolean;
  cards: string[];
  hand: HandClass;
  stackBB: number;
  /** The chart the spot belongs to: `'cash'`, or a tournament stack tier. */
  depth: ChartKey;
  /** Chips Hero put in, in big blinds, blinds and antes included and before
   * any uncalled bet came back (`HeroHand.grossBB`) — the ranking key. */
  committedBB: number;
  /** The board through the last street Hero acted on. */
  board: string[];
  decisions: BigSpotDecision[];
}

const round = (n: number, d = 1) => Number(n.toFixed(d));

/** The `limit` hands where Hero committed the most, biggest first. */
export function bigSpots(hands: HeroHand[], limit = BIG_SPOTS_LIMIT): BigSpot[] {
  return hands
    .filter((h) => h.cards && h.bb > 0)
    .sort((a, b) => b.grossBB - a.grossBB)
    .slice(0, limit)
    .map((h) => {
      const cards = h.cards as string[];
      return {
        id: h.id,
        position: h.position,
        role: h.role,
        pfa: h.pfa,
        cards,
        hand: handClass(cards[0], cards[1]),
        stackBB: round(h.stackBB),
        depth: chartKeyForHand(h),
        committedBB: round(h.grossBB),
        board: h.board.slice(0, BOARD_SEEN[h.streetReached]),
        decisions: h.decisions.map((a) => {
          // The labels' all-in rule, so one action reads the same in both lists.
          const allIn = shoved(a);
          const s = allIn ? null : sizing(a);
          return {
            street: a.street,
            action: a.kind,
            amountBB: round(a.amount / h.bb),
            potBB: round(a.potBefore / h.bb),
            toCallBB: round(a.toCall / h.bb),
            sizing: s === null ? null : round(s, 2),
            allIn,
            equityNeeded:
              a.kind === 'call' && a.toCall > 0
                ? round(potOdds(a) * 100)
                : null,
            handClass:
              a.street === 'preflop'
                ? null
                : postflopClass(cards, h.board.slice(0, BOARD_SEEN[a.street])),
          };
        }),
      };
    });
}
