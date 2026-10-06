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
import { type HandClass, ALL_169, expandCombos, handClass, sampleClassByCombos } from './hands.ts';
import { cellClass } from './grid.ts';
import {
  type Bucket,
  type Drill,
  type FacingAction,
  type ThreeBetKind,
  BUCKETS,
  BUCKET_CHART,
  BUCKET_META,
  BUCKET_REACHABLE,
  BTN_SOURCE_CHARTS,
  bucketChartAction,
  bucketsFor,
  bucketsForMode,
  chartAction,
  type FacingMode,
} from './facing.ts';
import type { Opponents } from './lowStakes.ts';
import type { Format, TableSeat } from './ranges.ts';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FacingSpot {
  /**
   * The seat that raised into hero: the opener, or in BTN vs 3-bet the
   * 3-bettor. The felt shows the real seat.
   */
  opener: TableSeat;
  /** The chart hero is graded against (BTN drill: `bucketFor`; BB drill: the opener's own). */
  bucket: Bucket;
  cards: [Card, Card];
  handClass: HandClass;
  correct: FacingAction;
  /** Set only when `correct` is a re-raise from a chart that splits them, for the verdict text. */
  kind?: ThreeBetKind;
}

/**
 * A FacingPool maps (bucket, handClass) → relative weight for sampling.
 * Weight must be > 0 for every dealable hand class (no zeros — every class
 * in the bucket's dealt range must be reachable).
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
  /** Tournament (default) or cash. Picks the buckets, openers and charts. */
  format?: Format;
  /** Hero on the button facing an open (default), in the big blind, or facing a 3-bet. */
  drill?: Drill;
  /**
   * A menu mode: deal from every drill in it, picking the drill first so a
   * family with few charts (the SB in Blinds) is not drowned out. Overrides `drill`.
   */
  mode?: FacingMode;
  /**
   * Who the grade assumes across the table (default 'balanced', the source).
   * Only changes the value/bluff kind of a cash 4-bet, never the action, so
   * the deal itself is the same either way.
   */
  opponents?: Opponents;
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
 *     chart (fold / call / re-raise; value vs bluff is not a different action).
 *   - trash:  folds in every source chart of the format (BTN drill) or in the
 *     bucket's own chart (BB defend, BTN vs 3-bet), and no neighbour continues
 *     there either. Disjoint from border by construction.
 *   - mid:    everything else.
 */
export type FacingTier = 'border' | 'mid' | 'trash';

export const TIER_WEIGHT: Record<FacingTier, number> = {
  border: 4,
  mid: 1,
  trash: 0.25,
};

function computeTier(bucket: Bucket, hc: HandClass): FacingTier {
  const own = bucketChartAction(bucket, hc).action;
  const near = neighbours(hc);
  if (near.some((n) => bucketChartAction(bucket, n).action !== own)) return 'border';
  // The BB and BTN-vs-3-bet drills grade every raiser on its own chart, so
  // their trash tier is measured against that chart alone — BB defends so
  // wide vs the late seats that almost nothing folds in all of them.
  const meta = BUCKET_META[bucket];
  const sources = meta.drill === 'btn' ? BTN_SOURCE_CHARTS[meta.format] : [BUCKET_CHART[bucket]];
  const foldsEverywhere = (c: HandClass) =>
    sources.every((chart) => chartAction(chart, c).action === 'fold');
  if (foldsEverywhere(hc) && near.every(foldsEverywhere)) return 'trash';
  return 'mid';
}

/** Tier per bucket per class, computed once — the dealer asks 169× per deal. */
function tiersFor(bucket: Bucket): ReadonlyMap<HandClass, FacingTier> {
  return new Map(ALL_169.map((hc) => [hc, computeTier(bucket, hc)]));
}

const TIER_CACHE = Object.fromEntries(BUCKETS.map((b) => [b, tiersFor(b)])) as Record<
  Bucket,
  ReadonlyMap<HandClass, FacingTier>
>;

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

/**
 * The classes a bucket deals from: its dealt range (`BUCKET_REACHABLE`, hero's
 * open range from the seat), or all 169 where it has none (the BB).
 */
const DEALABLE = Object.fromEntries(
  BUCKETS.map((b) => {
    const reachable = BUCKET_REACHABLE[b];
    return [b, reachable ? ALL_169.filter((hc) => reachable.has(hc)) : ALL_169];
  })
) as Record<Bucket, readonly HandClass[]>;

/** The hand classes a bucket can deal (see `DEALABLE`). */
export function dealableClasses(bucket: Bucket): readonly HandClass[] {
  return DEALABLE[bucket];
}

/** Weighted pick over the bucket's dealable classes: pool weight × combo count. */
function sampleHandClass(bucket: Bucket, pool: FacingPool, rng: () => number): HandClass {
  return sampleClassByCombos(DEALABLE[bucket], (hc) => pool.weight(bucket, hc), rng);
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Deal a random facing-open spot.
 *
 * 1. With a mode, pick one of its drills uniformly first. Then pick a bucket
 *    uniformly (the BTN drill: 50/50), then an opener uniformly within it. Both
 *    charts get equal practice; a uniform pick over six seats would give Late 4/6.
 * 2. Sample a hand class via the pool (default: borderSkewFacingPool).
 * 3. Deal one of that class's concrete combos uniformly.
 * 4. Grade it against the bucket's chart (`bucketChartAction`).
 *
 * @param opts.rng - Injectable RNG for deterministic tests
 * @param opts.pool - Override pool strategy (default: ACTIVE_FACING_POOL)
 */
export function dealFacingSpot(opts?: DealFacingOpts): FacingSpot {
  const rng = opts?.rng ?? Math.random;
  const pool = opts?.pool ?? ACTIVE_FACING_POOL;
  const format = opts?.format ?? 'mtt';
  let buckets = opts?.mode ? bucketsForMode(format, opts.mode) : bucketsFor(format, opts?.drill);
  if (buckets.length === 0) {
    throw new Error(`No ${opts?.mode ?? opts?.drill ?? 'btn'} charts in ${format} (open vs 3-bet is cash only)`);
  }

  // 1. Drill (mode only), then bucket, then opener within it
  if (opts?.mode) {
    const drills = [...new Set(buckets.map((b) => BUCKET_META[b].drill))];
    const drill = drills[Math.floor(rng() * drills.length)];
    buckets = buckets.filter((b) => BUCKET_META[b].drill === drill);
  }
  const bucket = buckets[Math.floor(rng() * buckets.length)];
  const seats = BUCKET_META[bucket].openers;
  const opener = seats[Math.floor(rng() * seats.length)];

  // 2. Hand class
  const hc = sampleHandClass(bucket, pool, rng);

  // 3. Concrete cards
  const combos = expandCombos(hc);
  const cards = combos[Math.floor(rng() * combos.length)];
  const verifiedClass = handClass(cards[0], cards[1]);

  // 4. Grade
  const { action, kind } = bucketChartAction(bucket, verifiedClass, opts?.opponents);

  return {
    opener,
    bucket,
    cards,
    handClass: verifiedClass,
    correct: action,
    ...(kind ? { kind } : {}),
  };
}
