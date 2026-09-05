/**
 * Weighted rejection-sampling spot generator.
 * Pure, no UI imports. All randomness is injectable via opts.rng for deterministic tests.
 */

import { type Card, fullDeck } from './odds';
import { classify, type Category, type DrawRead } from './classify';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Spot {
  hero: Card[];
  board: Card[];
  street: 'flop' | 'turn';
  read: DrawRead;
}

export interface DealOptions {
  /** Injectable RNG (default Math.random). Must return [0, 1). */
  rng?: () => number;
  /** Board canonical keys already shown this session (no-repeat). */
  seen?: Set<string>;
  /** Per-category weights. Defaults applied for any missing key. */
  weights?: Partial<Record<Category, number>>;
  /** Force a street, or 'any' to randomise. Default 'any'. */
  street?: 'flop' | 'turn' | 'any';
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default category weights (DECISIONS). */
const DEFAULT_WEIGHTS: Record<Category, number> = {
  flushDraw: 3,
  openEnder: 3,
  gutshot: 2,
  doubleGutshot: 1,
  combo: 1,
  pairImproving: 2,
  overcards: 2,
  setDraw: 1,
  backdoor: 1,
};

/** Maximum attempts before falling back to any keeper. */
const MAX_ATTEMPTS = 20_000;
/**
 * If a fallback keeper exists and we still haven't hit the target category
 * after this many attempts, give up and use the fallback. Keeps rare categories
 * (e.g. setDraw) from exhausting the full budget every deal cycle.
 */
const FALLBACK_CUTOFF = 2_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Canonical sorted board key — same board cards always map to the same key. */
export function boardKey(board: Card[]): string {
  return [...board].sort().join(',');
}

/** Pick a category by weight using rng. */
function pickCategory(
  weights: Record<Category, number>,
  rng: () => number
): Category {
  const categories = Object.keys(weights) as Category[];
  const total = categories.reduce((s, c) => s + weights[c], 0);
  let pick = rng() * total;
  for (const cat of categories) {
    pick -= weights[cat];
    if (pick <= 0) return cat;
  }
  return categories[categories.length - 1];
}

/** Fisher-Yates shuffle using injectable rng. Mutates the array in place. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Deal hero(2) + board(n) from a shuffled full deck. Returns {hero, board}. */
function dealCards(
  boardSize: 3 | 4,
  rng: () => number
): { hero: Card[]; board: Card[] } {
  const deck = shuffle(fullDeck(), rng);
  const hero = deck.slice(0, 2) as Card[];
  const board = deck.slice(2, 2 + boardSize) as Card[];
  return { hero, board };
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Deal a classified spot using weighted rejection sampling.
 *
 * Algorithm:
 * 1. Pick a target category by weight.
 * 2. Deal random hero+board (flop or turn).
 * 3. classify() it. Accept iff primaryCategory === target AND board key not in seen.
 * 4. Else re-deal. After MAX_ATTEMPTS, fall back to any keeper.
 * 5. Add accepted board key to seen.
 */
export function dealSpot(opts?: DealOptions): Spot {
  const rng = opts?.rng ?? Math.random;
  const seen = opts?.seen;
  const streetOpt = opts?.street ?? 'any';

  // Merge weights with defaults
  const weights: Record<Category, number> = {
    ...DEFAULT_WEIGHTS,
    ...(opts?.weights ?? {}),
  };

  const target = pickCategory(weights, rng);

  let fallback: Spot | null = null;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;

    // Determine street
    let street: 'flop' | 'turn';
    if (streetOpt === 'flop') {
      street = 'flop';
    } else if (streetOpt === 'turn') {
      street = 'turn';
    } else {
      street = rng() < 0.5 ? 'flop' : 'turn';
    }
    const boardSize: 3 | 4 = street === 'flop' ? 3 : 4;

    const { hero, board } = dealCards(boardSize, rng);
    const read = classify(hero, board);

    if (!read) continue; // not a keeper

    const key = boardKey(board);

    if (read.primaryCategory === target) {
      const notSeen = !seen || !seen.has(key);
      if (notSeen) {
        seen?.add(key);
        return { hero, board, street, read };
      }
      // Right category but already seen — store as fallback, keep trying
      if (!fallback) fallback = { hero, board, street, read };
    } else if (!fallback) {
      // Wrong category but a valid keeper — store first fallback found
      if (!seen || !seen.has(key)) {
        fallback = { hero, board, street, read };
      }
    }

    // Once we have a fallback and have spent enough attempts hunting for the
    // exact target, bail early rather than burning the full budget.
    if (fallback && attempts >= FALLBACK_CUTOFF) break;
  }

  // Cap reached — use fallback (any keeper we found)
  if (fallback) {
    const key = boardKey(fallback.board);
    seen?.add(key);
    return fallback;
  }

  // Absolute last resort: deal anything classify accepts (should never happen)
  for (;;) {
    const street: 'flop' | 'turn' = rng() < 0.5 ? 'flop' : 'turn';
    const boardSize: 3 | 4 = street === 'flop' ? 3 : 4;
    const { hero, board } = dealCards(boardSize, rng);
    const read = classify(hero, board);
    if (read) {
      seen?.add(boardKey(board));
      return { hero, board, street, read };
    }
  }
}
