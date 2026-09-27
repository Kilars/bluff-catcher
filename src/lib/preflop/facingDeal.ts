/**
 * Facing-open spot dealer: someone opens, it folds to hero on the button.
 * Pure, no UI imports. All randomness is injectable via opts.rng.
 *
 * Deals an (opener, bucket, cards, handClass, correct) tuple for the 3-bet
 * trainer. Its pool has its own signature rather than reusing the RFI `Pool`:
 * that one is keyed by (position, depth) and finds its boundary through
 * `getRangeSet`, and neither exists here. The edge in this drill is the
 * border between *three* actions in a bucket's chart, so it is found on the
 * grid instead of along a strength ranking.
 */

import type { Card } from '../odds.ts';
import { type HandClass, ALL_169, combosForClass, expandCombos, handClass } from './hands.ts';
import { cellClass } from './grid.ts';
import {
  type Bucket,
  type FacingAction,
  type Opener,
  type ThreeBetKind,
  BUCKETS,
  BUCKET_META,
  OPENERS,
  bucketChartAction,
  chartAction,
  facingAction,
} from './facing.ts';
import { FACING_SOURCES } from './facingSources.ts';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FacingSpot {
  /** The seat that opened. The felt shows the real seat. */
  opener: Opener;
  /** The chart hero is graded against: `BUCKET_OF[opener]`. */
  bucket: Bucket;
  cards: [Card, Card];
  handClass: HandClass;
  correct: FacingAction;
  /** Set only when `correct` is '3bet', for the verdict text. */
  kind?: ThreeBetKind;
}

/**
 * A FacingPool maps (bucket, handClass) → relative weight for sampling.
 * Weight must be > 0 for every hand class (no zeros — every class must be
 * reachable).
 */
export interface FacingPool {
  readonly name: string;
  weight(bucket: Bucket, hc: HandClass): number;
}

export interface DealFacingOpts {
  /** Injectable RNG (default Math.random). Must return [0, 1). */
  rng?: () => number;
  /** Override pool strategy. Default: ACTIVE_FACING_POOL. */
  pool?: FacingPool;
}

// ─── Grid neighbours ──────────────────────────────────────────────────────────

/** Every class's (row, col) in the 13×13 grid, inverted from `cellClass`. */
const CELL_OF: ReadonlyMap<HandClass, readonly [number, number]> = (() => {
  const map = new Map<HandClass, readonly [number, number]>();
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) map.set(cellClass(row, col), [row, col]);
  }
  return map;
})();

/**
 * A class's neighbours, defined exactly so the pool weights are testable:
 *   - the up-to-4 orthogonal cells in the 13×13 grid, plus
 *   - its suitedness twin — same two ranks, other half of the grid
 *     (AJs ↔ AJo). Pairs have no twin.
 *
 * The twin matters: AJs and AJo sit in mirrored cells and never touch, yet
 * "AJo 3-bets, AJs calls" is exactly the kind of border the drill is for.
 */
export function neighbours(hc: HandClass): HandClass[] {
  const cell = CELL_OF.get(hc);
  if (!cell) return [];
  const [row, col] = cell;
  const out: HandClass[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < 13 && c >= 0 && c < 13) out.push(cellClass(r, c));
  }
  if (hc.length === 3) out.push(hc.slice(0, 2) + (hc[2] === 's' ? 'o' : 's'));
  return out;
}

// ─── Pool tiers ───────────────────────────────────────────────────────────────

/**
 * Which weighting tier a class falls in for a bucket:
 *   - border: at least one neighbour has a different action in the bucket's
 *     chart (fold / call / 3-bet; value vs bluff is not a different action).
 *   - trash:  folds in all six source charts, and no neighbour continues in
 *     any of them. Disjoint from border by construction.
 *   - mid:    everything else.
 */
export type FacingTier = 'border' | 'mid' | 'trash';

export const TIER_WEIGHT: Record<FacingTier, number> = {
  border: 4,
  mid: 1,
  trash: 0.25,
};

const SOURCE_CHARTS = OPENERS.map((o) => FACING_SOURCES[o]);

function foldsEverywhere(hc: HandClass): boolean {
  return SOURCE_CHARTS.every((chart) => chartAction(chart, hc).action === 'fold');
}

function computeTier(bucket: Bucket, hc: HandClass): FacingTier {
  const own = bucketChartAction(bucket, hc).action;
  const near = neighbours(hc);
  if (near.some((n) => bucketChartAction(bucket, n).action !== own)) return 'border';
  if (foldsEverywhere(hc) && near.every(foldsEverywhere)) return 'trash';
  return 'mid';
}

/** Tier per bucket per class, computed once — the dealer asks 169× per deal. */
function tiersFor(bucket: Bucket): ReadonlyMap<HandClass, FacingTier> {
  return new Map(ALL_169.map((hc) => [hc, computeTier(bucket, hc)]));
}

const TIER_CACHE: Record<Bucket, ReadonlyMap<HandClass, FacingTier>> = {
  early: tiersFor('early'),
  late: tiersFor('late'),
};

/** The weighting tier of a class in a bucket (see `FacingTier`). */
export function facingTier(bucket: Bucket, hc: HandClass): FacingTier {
  return TIER_CACHE[bucket].get(hc) ?? 'mid';
}

// ─── Built-in pool strategies ─────────────────────────────────────────────────

/** Uniform pool: equal weight for all 1326 combos. */
export const uniformFacingPool: FacingPool = {
  name: 'uniform',
  weight(): number {
    return 1;
  },
};

/** Border-skew pool: 4× border, 1× mid, 0.25× trash, per `facingTier`. */
export const borderSkewFacingPool: FacingPool = {
  name: 'borderSkew',
  weight(bucket: Bucket, hc: HandClass): number {
    return TIER_WEIGHT[facingTier(bucket, hc)];
  },
};

// ─── Active pool constant — swap here to change global strategy ───────────────

export const ACTIVE_FACING_POOL: FacingPool = borderSkewFacingPool;

// ─── Sampling ─────────────────────────────────────────────────────────────────

/** Weighted pick over the 169 classes: pool weight × combo count. */
function sampleHandClass(bucket: Bucket, pool: FacingPool, rng: () => number): HandClass {
  let total = 0;
  const weights: number[] = new Array(ALL_169.length);
  for (let i = 0; i < ALL_169.length; i++) {
    const w = pool.weight(bucket, ALL_169[i]) * combosForClass(ALL_169[i]);
    weights[i] = w;
    total += w;
  }

  let pick = rng() * total;
  for (let i = 0; i < ALL_169.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return ALL_169[i];
  }
  return ALL_169[ALL_169.length - 1];
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Deal a random facing-open spot.
 *
 * 1. Pick a bucket 50/50, then an opener uniformly within it. Both charts get
 *    equal practice; a uniform pick over six seats would give Late 4/6.
 * 2. Sample a hand class via the pool (default: borderSkewFacingPool).
 * 3. Deal one of that class's concrete combos uniformly.
 * 4. Grade it with facingAction(opener, handClass).
 *
 * @param opts.rng - Injectable RNG for deterministic tests
 * @param opts.pool - Override pool strategy (default: ACTIVE_FACING_POOL)
 */
export function dealFacingSpot(opts?: DealFacingOpts): FacingSpot {
  const rng = opts?.rng ?? Math.random;
  const pool = opts?.pool ?? ACTIVE_FACING_POOL;

  // 1. Bucket, then opener within it
  const bucket = BUCKETS[Math.floor(rng() * BUCKETS.length)];
  const seats = BUCKET_META[bucket].openers;
  const opener = seats[Math.floor(rng() * seats.length)];

  // 2. Hand class
  const hc = sampleHandClass(bucket, pool, rng);

  // 3. Concrete cards
  const combos = expandCombos(hc);
  const cards = combos[Math.floor(rng() * combos.length)];
  const verifiedClass = handClass(cards[0], cards[1]);

  // 4. Grade
  const { action, kind } = facingAction(opener, verifiedClass);

  return {
    opener,
    bucket,
    cards,
    handClass: verifiedClass,
    correct: action,
    ...(kind ? { kind } : {}),
  };
}
