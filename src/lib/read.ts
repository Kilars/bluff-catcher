/**
 * The two facets of PLAN-coach.md §3 that need Hero's hole cards: what the
 * hand is, and which of the board's possible hands Hero's cards take away.
 *
 * Board texture is not here — it is read before your own cards are, so it lives
 * in hh/board.ts. Both functions take the board as an argument and nothing
 * else, so `vulnerable` cannot end up half-owned by two modules when it is
 * eventually built.
 */

import { classify, suitName } from './classify.ts';
import { analyse, hasFlush, hasStraight, RANKS, type Card } from './odds.ts';

// ─── Public types ───────────────────────────────────────────────────────────

export type HandClass = 'strong' | 'marginal-made' | 'draw' | 'air';

/**
 * One board-possible hand that a card in Hero's hand takes out of the deck.
 * The two fields are the whole statement — "A♥ removes flushes in hearts, the
 * nut flush included" — because the consumer is a model reading a payload, not
 * code. Whether a removal is good or bad is not said here; see `removals`.
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

/**
 * The full house a card list makes, as rank indices [trips, pair]: the highest
 * trips, then the highest other rank seen twice or more. Null when there is none.
 */
function boat(cs: readonly Card[]): [number, number] | null {
  const ranks = repeats(cs)
    .map((r) => RANKS.indexOf(r))
    .sort((a, b) => b - a);
  const trips = ranks.find((r) => ofRank(cs, RANKS[r]) >= 3);
  if (trips === undefined) return null;
  const pair = ranks.find((r) => r !== trips);
  return pair === undefined ? null : [trips, pair];
}

// ─── Hand class ─────────────────────────────────────────────────────────────

/** §3: eight or more outs. A four-out gutshot is not a draw here. */
const DRAW_OUTS = 8;

/** "Top pair with a Q-or-better kicker" — the Q is the boundary, inclusive. */
const GOOD_KICKER = RANKS.indexOf('Q');

/**
 * Label a hand strong / marginal-made / draw / air.
 *
 * `strong` is a hand Hero's own cards make: a flush that beats the board's, a
 * straight, trips or a set, a full house that beats the board's, two pair made
 * with both hole cards, an overpair, or top pair with a Q+ kicker. A board pair
 * beside one pair of Hero's is still one pair — the board's pair is everyone's
 * — and once the board itself shows a straight or flush, only a flush that
 * improves on it counts; everything else plays the board. On board quads a
 * pair, overpair or top pair is only a kicker, so none of them is `strong`.
 *
 * Made strength is tested first, so a set with a flush draw is `strong`: the
 * axis turns on whether the hand wins anything unimproved, and a made hand can
 * check down where a draw cannot.
 *
 * Outs come from classify(), the 8-out threshold does not — classify() calls a
 * four-out gutshot a draw, right for an outs drill and wrong here. The outs
 * branch is skipped on the river, where analyse() would still count nine outs
 * for a four-flush with no card to come.
 *
 * Deliberate under-calls, both rare: a straight on the board is
 * `marginal-made` even when Hero holds a card making a higher one, and a
 * straight flush below the lowest card of a board flush is missed. Separating
 * them needs a best-five evaluator the repo lacks, and a coach sees through
 * `marginal` where `air` would have misled.
 */
export function handClass(hole: Card[], board: Card[]): HandClass {
  const known = hole.concat(board);
  const top = Math.max(...board.map(ri));
  const pocketPair = hole[0][0] === hole[1][0];

  // A flush counts when Hero's card is in it and the board's own five don't
  // already beat it: fewer than five of the suit on board, or a hole card above
  // the lowest of them. 2h on Ah-Kh-Qh-9h-8h plays the board.
  const flush = hole.some((h) => {
    const suited = board.filter((c) => c[1] === h[1]);
    return ofSuit(known, h[1]) >= 5 && (suited.length < 5 || ri(h) > Math.min(...suited.map(ri)));
  });
  if (flush) return 'strong';

  // A straight or flush on the board outranks every hand below — pairs, sets
  // and Hero's own straight alike — so none of them is Hero's to claim.
  const boardStraightOrFlush = board.length === 5 && (hasStraight(board) || hasFlush(board));

  // Every test below names the hole card's contribution, because "the board
  // has two pair" is not Hero having two pair.
  const pairedRanks = repeats(known);
  const straight = hasStraight(known);
  // The boat as it plays, against the board's own. Hero's counts when it beats
  // the board's (44 on 9-9-9, 75 on 8-8-5-6-8); 22 or Q2 on K-K-K-Q-Q, and 9x
  // on 9-9-K-K-K, play the board's boat. Below a board boat, Hero's trips are
  // no better than the board, so only quads still count.
  // Quads on the board are everyone's best four: a pair beside them only adds
  // a kicker, so the "boat" it builds (the quads' rank over Hero's pair) is no
  // boat, and an overpair or top pair is only a kicker too.
  const boardQuads = repeats(board).some((r) => ofRank(board, r) === 4);
  const heroBoat = boat(known);
  const boardBoat = boat(board);
  const fullHouse =
    heroBoat !== null &&
    !boardQuads &&
    (boardBoat === null ||
      heroBoat[0] > boardBoat[0] ||
      (heroBoat[0] === boardBoat[0] && heroBoat[1] > boardBoat[1]));
  const quads = pairedRanks.some((r) => ofRank(known, r) === 4 && ofRank(hole, r) > 0);
  const trips =
    quads ||
    // Board quads: a pocket pair matching the fifth card only kicks.
    (boardBoat === null && !boardQuads && pairedRanks.some((r) => ofRank(known, r) >= 3 && ofRank(hole, r) > 0));
  // Both hole cards pair the board, and no board pair outranks the lower of
  // them — K7 on K-7-9-9 plays the nines, and its seven is only a kicker.
  const heroPaired = pocketPair ? [] : hole.filter((h) => ofRank(board, h[0]) > 0).map(ri);
  const twoPair =
    heroPaired.length === 2 && repeats(board).every((r) => RANKS.indexOf(r) < Math.min(...heroPaired));
  const overpair = !boardQuads && pocketPair && ri(hole[0]) > top;
  const topPair = !boardQuads && hole.some((h, i) => ri(h) === top && ri(hole[1 - i]) >= GOOD_KICKER);
  if (!boardStraightOrFlush && (straight || trips || fullHouse || twoPair || overpair || topPair))
    return 'strong';

  // Any other pair.
  if (pocketPair || hole.some((h) => ofRank(board, h[0]) > 0)) return 'marginal-made';

  // Playing the board. Only possible once all five are out — on a flop your
  // kickers still play — and only worth the name when the board's own hand is
  // two pair or better. Hero's high cards as kickers on A-K-8-5-2 is still air.
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
 * That makes this deliberately weaker than the worked example in
 * strategy-notes §4, which turns on villain holding busted draws. §3 of the
 * plan spells out where these rules go quiet, and why encoding the missing
 * piece would be the range model it rules out.
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

  // Three or four of the five ranks in a straight window: the missing ranks
  // are the ones a straight needs. Windows overlap, so a rank can be missing
  // from several — collect ranks first and speak once per card. Four of five
  // matters only at the ends, where the ace on 2-3-4-5 or T-J-Q-K sits in one
  // window and no overlapping one names it.
  const present = new Set(board.map(ri));
  if (present.has(12)) present.add(-1); // the ace plays low
  // A window no higher than a straight the board already shows makes nothing
  // that beats it: 4c on 5-6-7-8-9 removes no straight anyone wants.
  const windowMissing = (lo: number) =>
    [0, 1, 2, 3, 4].map((i) => lo + i).filter((i) => !present.has(i));
  let boardStraightLo = -2;
  for (let lo = -1; lo <= 8; lo++) if (!windowMissing(lo).length) boardStraightLo = lo;
  const needed = new Set<string>();
  for (let lo = Math.max(-1, boardStraightLo + 1); lo <= 8; lo++) {
    const missing = windowMissing(lo);
    if (missing.length === 1 || missing.length === 2) for (const i of missing) needed.add(i === -1 ? 'A' : RANKS[i]);
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
