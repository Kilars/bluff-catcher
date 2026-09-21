/**
 * Flop texture in five buckets.
 *
 * Nothing here looks at a hole card — texture is what you read *before* your
 * own hand, and it is the single biggest thing a flat c-bet percentage hides.
 *
 * "mine" and "theirs" are written from the preflop raiser's seat: a high card
 * is in the raising range and largely not in the calling range, a middling
 * board is the other way round. The labels do not change when Hero is the
 * caller — the board is the board — so read `middling-theirs` as "this one
 * favours whoever called".
 */

import { RANKS } from '../odds.ts';
import type { Street } from './parse.ts';

/**
 * How much of the board had been dealt when Hero acted on a given street.
 *
 * `Hand.board` is always the full runout, including cards dealt after Hero
 * folded, so every consumer that shows a board to a reader has to cut it here
 * first. Two of them do — the payload and the labels — and two copies of this
 * map is one copy too many to keep honest.
 */
export const BOARD_SEEN: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

export type BoardType =
  | 'dry-high-mine'
  | 'wet-high-mine'
  | 'middling-theirs'
  | 'paired'
  | 'monotone';

/** Index in RANKS: 0 = '2', 12 = 'A'. */
const TEN = RANKS.indexOf('T');

/** How far apart the three ranks sit. 4 or less is a connected board. */
const CONNECTED_SPAN = 4;

/**
 * Classify a flop. Takes the first three board cards; returns null if fewer
 * than three were dealt.
 *
 * Precedence matters: a paired monotone flop is reported as monotone, because
 * the flush is the thing that changes how the hand plays.
 */
export function boardType(board: readonly string[]): BoardType | null {
  const flop = board.slice(0, 3);
  if (flop.length < 3) return null;

  const ranks = flop.map((c) => RANKS.indexOf(c[0]));
  const suits = flop.map((c) => c[1]);

  if (suits[0] === suits[1] && suits[1] === suits[2]) return 'monotone';
  if (new Set(ranks).size < 3) return 'paired';

  const high = Math.max(...ranks);
  if (high < TEN) return 'middling-theirs';

  const twoTone = new Set(suits).size === 2;
  const connected = high - Math.min(...ranks) <= CONNECTED_SPAN;
  return twoTone || connected ? 'wet-high-mine' : 'dry-high-mine';
}
