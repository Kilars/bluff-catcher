/**
 * The two facets of PLAN-coach.md §3 that need Hero's hole cards: what the
 * hand is, and which of the board's possible hands Hero's cards take away.
 *
 * Board texture is not here — it is read before your own cards are, so it
 * lives in hh/board.ts. Both functions here take the board as an argument and
 * nothing else, so that `vulnerable`, which needs players-in and flop SPR,
 * cannot end up half-owned by two modules when it is eventually built.
 */

import { classify, suitName } from './classify.ts';
import { analyse, hasFlush, hasStraight, RANKS, type Card } from './odds.ts';

// ─── Public types ───────────────────────────────────────────────────────────

export type HandClass = 'strong' | 'marginal-made' | 'draw' | 'air';

/**
 * One board-possible hand that a card in Hero's hand takes out of the deck.
 *
 * The two fields are the whole statement — "A♥ removes flushes in hearts, the
 * nut flush included" — because the consumer is a model reading a payload, not
 * code. Nothing here says whether that removal is good or bad: the direction
 * flips by street and by who is betting (strategy-notes §4), and deciding it
 * needs a villain range, which §3 forbids. Stating the fact is the job.
 */
export interface Removal {
  /** The hole card doing the removing, e.g. 'Ah'. */
  card: Card;
  /** What it takes away, e.g. 'full houses with 7s'. */
  removes: string;
}

// ─── Card counting ──────────────────────────────────────────────────────────

/** Rank index, 0 = '2' … 12 = 'A'. */
function ri(card: Card): number {
  return RANKS.indexOf(card[0]);
}

function ofRank(cs: readonly Card[], rank: string): number {
  return cs.filter((c) => c[0] === rank).length;
}

function ofSuit(cs: readonly Card[], suit: string): number {
  return cs.filter((c) => c[1] === suit).length;
}

/** The ranks appearing two or more times in a card list. */
function repeats(cs: readonly Card[]): string[] {
  return [...new Set(cs.map((c) => c[0]))].filter((r) => ofRank(cs, r) >= 2);
}

// ─── Hand class ─────────────────────────────────────────────────────────────

/** §3: eight or more outs. A four-out gutshot is not a draw here. */
const DRAW_OUTS = 8;

/** "Top pair with a Q-or-better kicker" — the Q is the boundary, inclusive. */
const GOOD_KICKER = RANKS.indexOf('Q');

/**
 * Label a hand on the strong / marginal-made / draw / air axis.
 *
 * **Precedence: made strength first, draws only after.** A set with a flush
 * draw is `strong`, not `draw`. The axis exists to be crossed with an action,
 * and what the action turns on is whether the hand wins anything unimproved: a
 * made hand can check down and still win, a draw cannot. Calling the set a
 * draw would bucket it with hands that must hit, and promoting a weak pair
 * with a flush draw to `draw` would hide the showdown value that makes
 * checking it back reasonable. So the order is strong → marginal-made → draw,
 * and a hand that is both is named by the half that survives a checkdown.
 *
 * **Outs come from classify(), the threshold does not.** classify() is the
 * drill's taxonomy and calls a four-out gutshot a draw, which is right for a
 * drill about counting outs and wrong for a coaching label. We take its
 * composite `hits` predicate — which is where the real work is, deduplicating
 * overlapping outs through analyse() — and apply §3's threshold ourselves.
 *
 * Two known under-calls, both deliberate:
 *
 * - A straight sitting on the board (9-8-7-6-5) is `marginal-made` even when
 *   Hero holds a card making a higher one. Separating those needs a best-five
 *   comparison, which is a card evaluator this repo does not have and would
 *   not otherwise need. Under-calling a river nut straight as marginal is a
 *   label a coach can see through; `air` would not have been.
 * - Once the fifth card is out nothing is a draw, so the outs branch is
 *   skipped entirely on the river. Four to a flush with no card to come is
 *   air, and analyse() would happily count nine outs for it.
 */
export function handClass(hole: Card[], board: Card[]): HandClass {
  const known = hole.concat(board);
  const top = Math.max(...board.map(ri));
  const pocketPair = hole[0][0] === hole[1][0];

  // Two pair or better using at least one hole card, an overpair, or top pair
  // with a Q+ kicker. Each test below names the hole card's contribution,
  // because "the board has two pair" is not Hero having two pair.
  const pairedRanks = repeats(known);
  const flush = hole.some((h) => ofSuit(known, h[1]) >= 5);
  const straight = hasStraight(known) && !hasStraight(board);
  const trips = pairedRanks.some((r) => ofRank(known, r) >= 3 && ofRank(hole, r) > 0);
  const twoPair = pairedRanks.length >= 2 && pairedRanks.some((r) => ofRank(hole, r) > 0);
  const overpair = pocketPair && ri(hole[0]) > top;
  const topPair = hole.some((h, i) => ri(h) === top && ri(hole[1 - i]) >= GOOD_KICKER);
  if (flush || straight || trips || twoPair || overpair || topPair) return 'strong';

  // Any other pair.
  if (pocketPair || hole.some((h) => ofRank(board, h[0]) > 0)) return 'marginal-made';

  // Playing the board. Only possible once all five are out — on a flop your
  // kickers still play — and only worth the name when the board's own hand is
  // two pair or better, which is showdown value that owes nothing to Hero's
  // cards. Hero's high cards playing as kickers on A-K-8-5-2 is still air.
  const boardPairs = repeats(board);
  const boardMade =
    hasStraight(board) ||
    hasFlush(board) ||
    boardPairs.length >= 2 ||
    boardPairs.some((r) => ofRank(board, r) >= 3);
  if (board.length === 5 && boardMade) return 'marginal-made';

  const read = board.length < 5 ? classify(hole, board) : null;
  if (read && analyse({ hero: hole, board, hits: read.hits }).outs >= DRAW_OUTS) return 'draw';

  return 'air';
}

// ─── Removals ───────────────────────────────────────────────────────────────

/**
 * Which of the hands this board can make are less likely because Hero holds
 * one of the cards they need.
 *
 * Board-derived, in the strict sense: the question is "what can the board
 * make", never "what does villain have". The four rules are §3's, verbatim.
 *
 * This is weaker than the worked example in strategy-notes §4 and the
 * difference is the point. There, A♥K♥ on Q♥-7♥-3♦-8♠-2♣ is a bad bluff
 * because it blocks the *missed heart draws* that were going to fold — but
 * that board holds only two hearts, so no flush is possible on it and nothing
 * here fires. "They are holding busted hearts" is a claim about a range, and
 * the moment we encode it we have built the range model §3 rules out. What we
 * can say is that on a board where the flush *is* possible, A♥K♥ removes it
 * and A♦K♦ removes nothing — same hand strength, opposite meaning — and which
 * of those two the agent is looking at is the agent's call.
 */
export function removals(hole: Card[], board: Card[]): Removal[] {
  const found: Removal[] = [];
  const held = (rank: string) => hole.filter((c) => c[0] === rank);

  // Three or more of a suit: a flush is live, and the ace of it is the nut.
  for (const suit of 'shdc') {
    if (ofSuit(board, suit) < 3) continue;
    for (const card of hole.filter((h) => h[1] === suit)) {
      const nut = card[0] === 'A' ? ', the nut flush included' : '';
      found.push({ card, removes: `flushes in ${suitName(suit)}${nut}` });
    }
  }

  // Three of the five ranks in a straight window: the two missing ranks are
  // the ones a straight needs. Windows overlap, so a rank can be missing from
  // several — collect ranks first and speak once per card.
  const present = new Set(board.map(ri));
  if (present.has(12)) present.add(-1); // the ace plays low
  const needed = new Set<string>();
  for (let lo = -1; lo <= 8; lo++) {
    const missing = [0, 1, 2, 3, 4].map((i) => lo + i).filter((i) => !present.has(i));
    if (missing.length === 2) for (const i of missing) needed.add(i === -1 ? 'A' : RANKS[i]);
  }
  for (const rank of needed) {
    for (const card of held(rank)) found.push({ card, removes: `straights that need the ${rank}` });
  }

  // A paired board rank: the boats are made of it.
  const paired = repeats(board);
  for (const rank of paired) {
    for (const card of held(rank)) found.push({ card, removes: `full houses with ${rank}s` });
  }

  // The highest board card. Skipped when it is the paired rank, where holding
  // it makes trips and nobody has top pair to remove.
  const high = RANKS[Math.max(...board.map(ri))];
  if (!paired.includes(high)) {
    for (const card of held(high)) found.push({ card, removes: `top pair of ${high}s` });
  }

  return found;
}
