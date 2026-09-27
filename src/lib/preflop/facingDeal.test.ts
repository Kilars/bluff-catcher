/**
 * Tests for the facing-open dealer.
 *
 * Uses seeded RNG for determinism. As in deal.test.ts, the distribution is
 * sampled once and every property is read off that one pass.
 */

import { describe, it, expect } from 'vitest';
import {
  ACTIVE_FACING_POOL,
  TIER_WEIGHT,
  borderSkewFacingPool,
  dealFacingSpot,
  facingTier,
  neighbours,
  type FacingTier,
} from './facingDeal';
import { bucketsFor, bucketFor, BUCKET_OF, OPENERS, bucketChartAction, facingAction, type Bucket } from './facing';
import { ALL_169, combosForClass, handClass as computeHandClass } from './hands';

/** These suites cover the tournament charts; cash has its own below. */
const MTT_BUCKETS = bucketsFor('mtt');

// Simple deterministic LCG seeded RNG (same as deal.test.ts)
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

describe('neighbours()', () => {
  it('is the orthogonal grid cells plus the suitedness twin', () => {
    // AJs: row A, col J — left AQs, right ATs, below KJs; no row above. Twin AJo.
    expect(neighbours('AJs').sort()).toEqual(['AJo', 'AQs', 'ATs', 'KJs'].sort());
    // AJo: row J, col A — above AQo, below ATo, right KJo; no col left.
    expect(neighbours('AJo').sort()).toEqual(['AJs', 'AQo', 'ATo', 'KJo'].sort());
    // Pairs have no twin.
    expect(neighbours('AA').sort()).toEqual(['AKo', 'AKs'].sort());
    expect(neighbours('88').sort()).toEqual(['87s', '98o', '98s', '87o'].sort());
  });

  it('is symmetric', () => {
    for (const hc of ALL_169) {
      for (const n of neighbours(hc)) expect(neighbours(n), `${hc} ↔ ${n}`).toContain(hc);
    }
  });
});

describe('facingTier()', () => {
  it('finds a border across the suitedness twin', () => {
    // vs Early AJo 3-bets and AJs calls: they never touch on the grid.
    expect(bucketChartAction('early', 'AJo').action).toBe('3bet');
    expect(bucketChartAction('early', 'AJs').action).toBe('call');
    expect(facingTier('early', 'AJs')).toBe('border');
    expect(facingTier('early', 'AJo')).toBe('border');
  });

  it('calls deep trash trash and the middle of a region mid', () => {
    expect(facingTier('early', '72o')).toBe('trash');
    expect(facingTier('late', '72o')).toBe('trash');
    expect(facingTier('late', 'AA')).toBe('mid');
    // Folds in every chart and so do its vs-Late neighbours, but Q8s is a CO
    // bluff: not trash.
    expect(facingTier('late', 'Q7s')).toBe('mid');
    // vs Late K7s sits under A7s, a bluff: border.
    expect(facingTier('late', 'K7s')).toBe('border');
  });

  it('never gives a class weight 0', () => {
    for (const b of MTT_BUCKETS) {
      for (const hc of ALL_169) expect(borderSkewFacingPool.weight(b, hc)).toBeGreaterThan(0);
    }
    expect(ACTIVE_FACING_POOL).toBe(borderSkewFacingPool);
  });
});

describe('dealFacingSpot() — what every spot must be', () => {
  it('is a well-formed, correctly graded spot on every deal', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 2000; i++) {
      const spot = dealFacingSpot({ rng });

      expect(OPENERS).toContain(spot.opener);
      expect(spot.bucket).toBe(BUCKET_OF[spot.opener]);
      expect(spot.cards[0]).not.toBe(spot.cards[1]);
      expect(spot.handClass).toBe(computeHandClass(spot.cards[0], spot.cards[1]));

      const answer = facingAction(spot.opener, spot.handClass);
      expect(spot.correct).toBe(answer.action);
      expect(spot.kind).toBe(answer.kind);
    }
  });
});

describe('dealFacingSpot() — distribution', () => {
  // One 40k sample, read four ways.
  const rng = makeRng(2024);
  const N = 40000;
  const counts = { early: {}, late: {} } as Record<Bucket, Record<string, number>>;
  for (const b of MTT_BUCKETS) for (const hc of ALL_169) counts[b][hc] = 0;
  const openerCounts: Record<string, number> = {};
  for (const o of OPENERS) openerCounts[o] = 0;

  for (let i = 0; i < N; i++) {
    const spot = dealFacingSpot({ rng });
    counts[spot.bucket][spot.handClass]++;
    openerCounts[spot.opener]++;
  }

  it('splits early/late 50% ± 2%, then uniformly within a bucket', () => {
    const early = OPENERS.filter((o) => BUCKET_OF[o] === 'early');
    const earlyDeals = early.reduce((sum, o) => sum + openerCounts[o], 0);
    expect(Math.abs(earlyDeals / N - 0.5)).toBeLessThan(0.02);

    for (const b of MTT_BUCKETS) {
      const seats = OPENERS.filter((o) => BUCKET_OF[o] === b);
      const expected = N / MTT_BUCKETS.length / seats.length;
      for (const o of seats) {
        expect(Math.abs(openerCounts[o] - expected) / expected, o).toBeLessThan(0.1);
      }
    }
  });

  it('deals every one of the 169 classes', () => {
    for (const hc of ALL_169) {
      expect(counts.early[hc] + counts.late[hc], hc).toBeGreaterThan(0);
    }
  });

  it('weights border 4× and trash 0.25× against mid, per combo, within ±15%', () => {
    for (const b of MTT_BUCKETS) {
      // Per-combo rate of a whole tier, so a pair's 6 combos are not read as
      // six times the luck.
      const dealt: Record<FacingTier, number> = { border: 0, mid: 0, trash: 0 };
      const combos: Record<FacingTier, number> = { border: 0, mid: 0, trash: 0 };
      for (const hc of ALL_169) {
        const tier = facingTier(b, hc);
        dealt[tier] += counts[b][hc];
        combos[tier] += combosForClass(hc);
      }
      const rate = (t: FacingTier) => dealt[t] / combos[t];

      for (const t of ['border', 'trash'] as const) {
        expect(combos[t], `${b} ${t}`).toBeGreaterThan(0);
        const ratio = rate(t) / rate('mid');
        const target = TIER_WEIGHT[t] / TIER_WEIGHT.mid;
        expect(Math.abs(ratio / target - 1), `${b} ${t}: ${ratio}`).toBeLessThan(0.15);
      }
    }
  });
});

describe('dealFacingSpot() — cash format', () => {
  const rng = makeRng(77);
  const N = 20000;
  const openerCounts: Record<string, number> = {};
  const bucketCounts: Record<string, number> = {};
  const seen = new Set<string>();
  const spots = Array.from({ length: N }, () => dealFacingSpot({ rng, format: 'cash' }));
  for (const s of spots) {
    openerCounts[s.opener] = (openerCounts[s.opener] ?? 0) + 1;
    bucketCounts[s.bucket] = (bucketCounts[s.bucket] ?? 0) + 1;
    seen.add(s.handClass);
  }

  it('only deals cash openers and cash buckets, graded without a kind', () => {
    expect(Object.keys(openerCounts).sort()).toEqual(['CO', 'HJ', 'LJ']);
    expect(Object.keys(bucketCounts).sort()).toEqual(['cashCo', 'cashEarly']);
    for (const s of spots.slice(0, 2000)) {
      expect(s.bucket).toBe(bucketFor('cash', s.opener));
      expect(s.correct).toBe(bucketChartAction(s.bucket, s.handClass).action);
      expect(s.kind).toBeUndefined();
    }
  });

  it('splits the two cash charts 50% ± 2%, LJ and HJ evenly inside vs LJ/HJ', () => {
    expect(Math.abs(bucketCounts.cashEarly / N - 0.5)).toBeLessThan(0.02);
    expect(Math.abs(openerCounts.LJ - openerCounts.HJ) / (N / 4)).toBeLessThan(0.1);
  });

  it('keeps every class reachable', () => {
    expect(seen.size).toBe(169);
  });

  it('measures "trash" against the cash charts only', () => {
    // 72o folds in every chart of both formats and has no continuing neighbour.
    expect(facingTier('cashEarly', '72o')).toBe('trash');
    // A7s folds vs LJ/HJ but 3-bets vs CO, so it is never trash in cash.
    expect(facingTier('cashEarly', 'A7s')).not.toBe('trash');
  });
});
