/**
 * Pure, typed odds engine for poker draw analysis.
 * No React or UI imports.
 */

export type Card = string; // e.g. 'As', 'Td', '2c'
export type Suit = 's' | 'h' | 'd' | 'c';

export const RANKS = '23456789TJQKA';

export interface Analysis {
  outs: number;
  outsList: Card[];
  unseen: number;
  streets: number;
  total: number;
  /** The rule-of-2-and-4 shortcut: outs × 4 on the flop, × 2 on the turn. */
  quick: number;
}

/**
 * A spot is hero + board + the composite `hits` predicate the classifier built.
 * There is no second shape: backdoors were removed from the drill (DECISIONS.md,
 * "Backdoors are out"), and with them the runner-runner branch that used to
 * bypass `hits` and return zero outs.
 */
export interface Spot {
  hero: Card[];
  board: Card[];
  hits: (cards: Card[], hero: Card[]) => boolean;
}

/**
 * Parse a card code into rank and suit.
 * @param code e.g. 'As' -> { rank: 'A', suit: 's' }
 */
export function parseCard(code: Card): { rank: string; suit: Suit } {
  return {
    rank: code[0],
    suit: code[1] as Suit,
  };
}

/**
 * Generate a full 52-card deck.
 */
export function fullDeck(): Card[] {
  const out: Card[] = [];
  for (const r of RANKS) {
    for (const s of 'shdc') {
      out.push((r + s) as Card);
    }
  }
  return out;
}

/**
 * Count suits in a card list.
 */
function suitCounts(cs: Card[]): Record<string, number> {
  const n: Record<string, number> = {};
  for (const c of cs) {
    n[c[1]] = (n[c[1]] || 0) + 1;
  }
  return n;
}

/**
 * Check if a card list contains a flush (5 of one suit).
 */
export function hasFlush(cs: Card[]): boolean {
  const n = suitCounts(cs);
  return Object.keys(n).some((k) => n[k] >= 5);
}

/**
 * Check if a card list contains a straight (5 consecutive ranks).
 * Ace plays low as rank index -1.
 */
export function hasStraight(cs: Card[]): boolean {
  const set: Record<number, boolean> = {};
  for (const c of cs) {
    set[RANKS.indexOf(c[0])] = true;
  }
  if (set[12]) set[-1] = true; // ace plays low
  for (let lo = -1; lo <= 8; lo++) {
    let ok = true;
    for (let i = 0; i < 5; i++) {
      if (!set[lo + i]) ok = false;
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Check if any hole card (by rank) appears at least n times in the full card list.
 * Used by hits predicates for pair-improving hands.
 */
export function pairsUp(
  hero: Card[],
  cs: Card[],
  n: number
): boolean {
  return hero.some((h) => cs.filter((c) => c[0] === h[0]).length >= n);
}

/**
 * Analyse a poker draw: calculate outs, unseen cards, streets, and odds.
 *
 * Correctness invariants:
 * - hits predicates must be rank-specific (no generic "pairs")
 * - a spot with 0 outs is logged as an error (mis-specified)
 */
export function analyse(spot: Spot): Analysis {
  const known = spot.hero.concat(spot.board);
  const rest = fullDeck().filter((c) => known.indexOf(c) === -1);
  const n = rest.length;
  const streets = 5 - spot.board.length;

  // Count outs via the hits predicate.
  const outs = rest.filter((c) => spot.hits(known.concat([c]), spot.hero));
  const o = outs.length;

  if (o === 0) {
    console.error('Spot has no single-card outs — mis-specified hand:', spot.hero, spot.board);
  }

  // Two streets (flop): "at least one out" formula
  // One street (turn): simple ratio
  const total =
    streets === 2
      ? (1 - ((n - o) * (n - o - 1)) / (n * (n - 1))) * 100
      : (o / n) * 100;

  return {
    outs: o,
    outsList: outs,
    unseen: n,
    streets,
    total: Math.round(total * 10) / 10,
    quick: o * (streets === 2 ? 4 : 2),
  };
}
