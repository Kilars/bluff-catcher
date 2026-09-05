/**
 * Preflop spot dealer.
 * Pure, no UI imports. All randomness is injectable via opts.rng.
 *
 * Deals a (position, cards, handClass, correct) tuple for the RFI trainer.
 * Uses a pluggable Pool strategy for combo sampling.
 */

import type { Card } from '../odds';
import {
  type HandClass,
  handClass,
  HAND_STRENGTH_RANKING,
  strengthRank,
  combosForClass,
} from './hands';
import { type Position, POSITIONS, isOpen, getRangeSet } from './ranges';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PreflopSpot {
  position: Position;
  cards: [Card, Card];
  handClass: HandClass;
  correct: 'open' | 'fold';
}

export interface DealPreflopOpts {
  /** Injectable RNG (default Math.random). Must return [0, 1). */
  rng?: () => number;
  /** Override pool strategy. Default: ACTIVE_POOL. */
  pool?: Pool;
}

// ─── Pool strategy interface ──────────────────────────────────────────────────

/**
 * A Pool strategy maps (position, handClass) → relative weight for sampling.
 * Weight must be > 0 for every hand class (no zeros — every class must be reachable).
 */
export interface Pool {
  readonly name: string;
  weight(pos: Position, hc: HandClass): number;
}

// ─── Built-in pool strategies ─────────────────────────────────────────────────

/**
 * Uniform pool: equal weight for all 1326 combos.
 * Pure unbiased sampling.
 */
export const uniformPool: Pool = {
  name: 'uniform',
  weight(_pos: Position, _hc: HandClass): number {
    return 1;
  },
};

/**
 * Edge-skew pool:
 *   - Base weight: 1× (all classes)
 *   - ~2× for classes near the position's range boundary (in the strength-ranking band
 *     straddling the weakest included class and the strongest excluded class)
 *   - ~0.25× for obvious-trash classes (weakest tier — well below every position's range
 *     and not near any edge)
 *
 * "Near boundary" = within EDGE_BAND_HALF_WIDTH ranks of the boundary index
 *   in HAND_STRENGTH_RANKING.
 * "Trash tier" = rank index > TRASH_THRESHOLD in HAND_STRENGTH_RANKING.
 */

/** How many positions each side of the boundary constitute the "edge band". */
const EDGE_BAND_HALF_WIDTH = 12;

/**
 * Rank index (in HAND_STRENGTH_RANKING) beyond which a class is considered trash
 * for weighting purposes. Set to a threshold well below any position's open range.
 * BTN opens ~45% so its weakest hands are around rank ~100 or higher.
 * We set trash threshold at rank 135 (of 169) — safely below every position's edge.
 */
const TRASH_THRESHOLD = 135;

/** Weight multipliers for edge and trash classes. */
const EDGE_WEIGHT = 2.0;
const TRASH_WEIGHT = 0.25;

/**
 * Precompute boundary information for a position:
 * - weakestOpenRank: the strength rank of the weakest included class (highest rank index)
 * - strongestFoldRank: the strength rank of the strongest excluded class (lowest rank index
 *   among all excluded classes)
 * - boundaryMidRank: midpoint used to define the edge band
 */
function computeBoundary(pos: Position): {
  weakestOpenRank: number;
  strongestFoldRank: number;
  boundaryMidRank: number;
} {
  const rangeSet = getRangeSet(pos);

  let weakestOpenRank = -1;
  let strongestFoldRank = HAND_STRENGTH_RANKING.length;

  for (let i = 0; i < HAND_STRENGTH_RANKING.length; i++) {
    const hc = HAND_STRENGTH_RANKING[i];
    if (rangeSet.has(hc)) {
      if (i > weakestOpenRank) weakestOpenRank = i;
    } else {
      if (i < strongestFoldRank) strongestFoldRank = i;
    }
  }

  // The boundary band straddles these two anchors
  const boundaryMidRank = (weakestOpenRank + strongestFoldRank) / 2;

  return { weakestOpenRank, strongestFoldRank, boundaryMidRank };
}

/** Cached boundary data per position. */
const BOUNDARY_CACHE = new Map<Position, ReturnType<typeof computeBoundary>>();

function getBoundary(pos: Position): ReturnType<typeof computeBoundary> {
  if (!BOUNDARY_CACHE.has(pos)) {
    BOUNDARY_CACHE.set(pos, computeBoundary(pos));
  }
  return BOUNDARY_CACHE.get(pos)!;
}

export const edgeSkewPool: Pool = {
  name: 'edgeSkew',
  weight(pos: Position, hc: HandClass): number {
    const rank = strengthRank(hc);
    if (rank === -1) return 1; // shouldn't happen

    const { boundaryMidRank } = getBoundary(pos);
    const distance = Math.abs(rank - boundaryMidRank);

    if (distance <= EDGE_BAND_HALF_WIDTH) {
      // Near the boundary: boost weight
      return EDGE_WEIGHT;
    }

    if (rank > TRASH_THRESHOLD) {
      // Weak trash class: downweight
      return TRASH_WEIGHT;
    }

    return 1; // base weight
  },
};

// ─── Active pool constant — swap here to change global strategy ───────────────

export const ACTIVE_POOL: Pool = edgeSkewPool;

// ─── Sampling helpers ─────────────────────────────────────────────────────────

/** Fisher-Yates shuffle using injectable rng. Mutates in place. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Sample a hand class from the 169 classes weighted by the pool strategy.
 * Uses combo-count weighting (pairs 6x, suited 4x, offsuit 12x) combined with
 * the pool's per-class weight.
 */
function sampleHandClass(pos: Position, pool: Pool, rng: () => number): HandClass {
  const total169 = HAND_STRENGTH_RANKING;

  // Compute total weight
  let totalWeight = 0;
  const weights: number[] = new Array(total169.length);
  for (let i = 0; i < total169.length; i++) {
    const hc = total169[i];
    const w = pool.weight(pos, hc) * combosForClass(hc);
    weights[i] = w;
    totalWeight += w;
  }

  // Pick
  let pick = rng() * totalWeight;
  for (let i = 0; i < total169.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return total169[i];
  }
  return total169[total169.length - 1];
}

/**
 * Given a hand class, deal a random concrete (Card, Card) pair.
 * Uses a full deck to ensure no duplicates.
 */
function dealConcreteCards(hc: HandClass, rng: () => number): [Card, Card] {
  const hiRank = hc[0];
  const isPair = hc.length === 2;
  const loRank = isPair ? hc[1] : hc[1];
  const isSuited = !isPair && hc[2] === 's';
  const suits = ['s', 'h', 'd', 'c'];

  if (isPair) {
    // Pick 2 of the 4 suits for this rank
    const shuffledSuits = shuffle([...suits], rng);
    return [
      (hiRank + shuffledSuits[0]) as Card,
      (loRank + shuffledSuits[1]) as Card,
    ];
  }

  if (isSuited) {
    // Pick one suit for both
    const suit = suits[Math.floor(rng() * 4)];
    return [
      (hiRank + suit) as Card,
      (loRank + suit) as Card,
    ];
  }

  // Offsuit: pick two different suits
  const shuffledSuits = shuffle([...suits], rng);
  return [
    (hiRank + shuffledSuits[0]) as Card,
    (loRank + shuffledSuits[1]) as Card,
  ];
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Deal a random preflop RFI spot.
 *
 * 1. Pick a position uniformly over the 7 non-blind seats.
 * 2. Sample a hand class via the pool strategy (default: edgeSkewPool).
 * 3. Deal a random concrete card pair for that hand class.
 * 4. Derive correct action from isOpen(pos, handClass).
 *
 * @param opts.rng - Injectable RNG for deterministic tests
 * @param opts.pool - Override pool strategy (default: ACTIVE_POOL)
 */
export function dealPreflopSpot(opts?: DealPreflopOpts): PreflopSpot {
  const rng = opts?.rng ?? Math.random;
  const pool = opts?.pool ?? ACTIVE_POOL;

  // 1. Pick position uniformly
  const posIdx = Math.floor(rng() * POSITIONS.length);
  const position = POSITIONS[posIdx];

  // 2. Sample hand class
  const hc = sampleHandClass(position, pool, rng);

  // 3. Deal concrete cards
  const cards = dealConcreteCards(hc, rng);

  // 4. Verify hand class matches (sanity check)
  const verifiedClass = handClass(cards[0], cards[1]);

  // 5. Derive correct action
  const correct: 'open' | 'fold' = isOpen(position, verifiedClass) ? 'open' : 'fold';

  return {
    position,
    cards,
    handClass: verifiedClass,
    correct,
  };
}
