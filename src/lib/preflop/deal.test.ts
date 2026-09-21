/**
 * Tests for the preflop spot dealer.
 *
 * Uses seeded RNG for determinism.
 *
 * The distribution checks are the expensive part, so each pool is sampled once
 * and every property is read off that one pass. Splitting them into a test per
 * property re-deals tens of thousands of hands to learn the same thing.
 */

import { describe, it, expect } from 'vitest';
import { dealPreflopSpot, uniformPool, edgeSkewPool, ACTIVE_POOL } from './deal';
import { isOpen, DEPTHS, DEFAULT_DEPTH, type Depth } from './ranges';
import { handClass as computeHandClass, ALL_169, HAND_STRENGTH_RANKING } from './hands';
import { type Position, POSITIONS } from './ranges';

// Simple deterministic LCG seeded RNG (same as used in classify.test.ts style)
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

const N_DEALS = 5000; // enough for statistical tests without being slow

/** Combos per class — pairs 6, suited 4, offsuit 12. */
function combos(hc: string): number {
  return hc.length === 2 ? 6 : hc[2] === 's' ? 4 : 12;
}

describe('dealPreflopSpot() — what every spot must be', () => {
  it('is a well-formed, correctly graded spot on every deal', () => {
    const rng = makeRng(42);
    const ranks = new Set('23456789TJQKA');
    const suits = new Set(['s', 'h', 'd', 'c']);

    for (let i = 0; i < 500; i++) {
      const spot = dealPreflopSpot({ rng });

      expect(POSITIONS).toContain(spot.position as Position);
      expect(spot.cards).toHaveLength(2);
      expect(spot.cards[0]).not.toBe(spot.cards[1]);
      for (const card of spot.cards) {
        expect(card).toHaveLength(2);
        expect(ranks.has(card[0])).toBe(true);
        expect(suits.has(card[1])).toBe(true);
      }

      // The two derived fields are the whole answer key: a spot graded against
      // the wrong hand class teaches the player the wrong chart.
      expect(spot.handClass).toBe(computeHandClass(spot.cards[0], spot.cards[1]));
      expect(spot.correct).toBe(isOpen(spot.position, spot.handClass) ? 'open' : 'fold');
    }
  });
});

describe('dealPreflopSpot() — position distribution', () => {
  it('deals all seven seats, within 10% of uniform', () => {
    const rng = makeRng(456);
    const counts: Record<string, number> = {};
    for (const pos of POSITIONS) counts[pos] = 0;

    for (let i = 0; i < N_DEALS; i++) counts[dealPreflopSpot({ rng }).position]++;

    const expected = N_DEALS / 7;
    for (const pos of POSITIONS) {
      expect(counts[pos], pos).toBeGreaterThan(0);
      expect(Math.abs(counts[pos] - expected) / expected).toBeLessThan(0.1);
    }
  });
});

describe('edgeSkewPool distribution', () => {
  // One 20k sample, read three ways.
  const rng = makeRng(5555);
  const SAMPLE_N = 20000;
  const counts: Record<string, number> = {};
  for (const hc of ALL_169) counts[hc] = 0;
  const utgCounts: Record<string, number> = {};
  for (const hc of ALL_169) utgCounts[hc] = 0;
  let utgDeals = 0;

  for (let i = 0; i < SAMPLE_N; i++) {
    const spot = dealPreflopSpot({ rng, pool: edgeSkewPool });
    counts[spot.handClass]++;
    if (spot.position === 'UTG') {
      utgCounts[spot.handClass]++;
      utgDeals++;
    }
  }

  it('leaves no hand class unreachable', () => {
    for (const hc of ALL_169) expect(counts[hc], hc).toBeGreaterThan(0);
  });

  it('boosts the boundary band over a hand nowhere near it, and buries trash', () => {
    expect(utgDeals).toBeGreaterThan(1000);

    // Take the edge hand from the pool itself rather than naming one off a
    // chart: the charts move when the reference charts do, the weighting does
    // not.
    const edgeHand = ALL_169.find(
      (hc) => hc.endsWith('s') && edgeSkewPool.weight('UTG', hc, DEFAULT_DEPTH) === 4
    )!;
    expect(edgeHand).toBeDefined();
    expect(edgeSkewPool.weight('UTG', 'AA', DEFAULT_DEPTH)).toBe(1);

    // Per-combo rates, so a pair's 6 combos are not read as six times the luck.
    const rate = (hc: string) => utgCounts[hc] / combos(hc);
    // Loose multipliers: the exact ratio depends on the boundary band width.
    expect(rate(edgeHand)).toBeGreaterThan(rate('AA') * 1.5);
    expect(rate('72o')).toBeLessThan(rate('AA') * 0.8);
  });

  it('suppresses the bottom of the ranking against its middle', () => {
    const rateOver = (classes: readonly string[]) => {
      let dealt = 0;
      let weight = 0;
      for (const hc of classes) {
        dealt += counts[hc];
        weight += combos(hc);
      }
      return dealt / weight;
    };

    const trash = rateOver(HAND_STRENGTH_RANKING.slice(140));
    const normal = rateOver(HAND_STRENGTH_RANKING.slice(40, 80));
    expect(trash).toBeLessThan(normal * 0.7);
  });
});

describe('uniformPool', () => {
  it('reaches every hand class, and grades each against the chart', () => {
    const rng = makeRng(1234);
    const seen = new Set<string>();

    for (let i = 0; i < 30000; i++) {
      const spot = dealPreflopSpot({ rng, pool: uniformPool });
      seen.add(spot.handClass);
      expect(spot.correct).toBe(isOpen(spot.position, spot.handClass) ? 'open' : 'fold');
    }

    for (const hc of ALL_169) expect(seen.has(hc), hc).toBe(true);
  });
});

describe('ACTIVE_POOL', () => {
  it('is the edgeSkewPool — the drill skews to boundaries by default', () => {
    expect(ACTIVE_POOL.name).toBe('edgeSkew');
  });
});

describe('dealPreflopSpot() — seeded determinism', () => {
  it('same seed produces the same first spot', () => {
    const spot1 = dealPreflopSpot({ rng: makeRng(42) });
    const spot2 = dealPreflopSpot({ rng: makeRng(42) });
    expect(spot1).toEqual(spot2);
  });
});

describe('dealPreflopSpot() — stack depth', () => {
  it('defaults to the deep tier, and reports back any tier it is asked for', () => {
    expect(dealPreflopSpot({ rng: makeRng(7) }).depth).toBe(DEFAULT_DEPTH);
    expect(DEFAULT_DEPTH).toBe('deep');
    for (const depth of DEPTHS) {
      expect(dealPreflopSpot({ rng: makeRng(7), depth }).depth).toBe(depth);
    }
  });

  it('grades against the chart for that depth', () => {
    for (const depth of DEPTHS) {
      const rng = makeRng(2024);
      for (let i = 0; i < 400; i++) {
        const spot = dealPreflopSpot({ rng, depth, pool: uniformPool });
        const expected = isOpen(spot.position, spot.handClass, depth) ? 'open' : 'fold';
        expect(spot.correct).toBe(expected);
      }
    }
  });

  it('a seed picks the same seat and hand at every depth — only the verdict moves', () => {
    // The RNG draw order does not depend on the tier under uniformPool, so the
    // three tiers are directly comparable: same spot, possibly different answer.
    const spots = DEPTHS.map((depth) =>
      dealPreflopSpot({ rng: makeRng(31337), depth, pool: uniformPool })
    );
    for (const spot of spots) {
      expect(spot.position).toBe(spots[0].position);
      expect(spot.handClass).toBe(spots[0].handClass);
    }
  });

  it('at 10bb every pocket pair grades as a play, from any seat', () => {
    const rng = makeRng(555);
    let pairsSeen = 0;
    for (let i = 0; i < 3000; i++) {
      const spot = dealPreflopSpot({ rng, depth: 'short', pool: uniformPool });
      if (spot.handClass.length === 2) {
        pairsSeen++;
        expect(spot.correct).toBe('open'); // rendered as "jam" in the UI
      }
    }
    expect(pairsSeen).toBeGreaterThan(100);
  });

  it('edgeSkewPool skews to each tier’s own boundary, not the deep one', () => {
    // Each tier's chart has its own weakest-included hand, so each has its own
    // edge band. Drilling 10bb must not skew toward the 60bb+ boundary.
    const edgeBand = (depth: Depth) =>
      new Set(ALL_169.filter((hc) => edgeSkewPool.weight('UTG', hc, depth) === 4));

    const bands = { deep: edgeBand('deep'), mid: edgeBand('mid'), short: edgeBand('short') };

    for (const depth of DEPTHS) {
      expect(bands[depth].size).toBeGreaterThan(0);
    }

    // The bands overlap but are not the same set: at least one hand sits on one
    // tier's boundary while being nowhere near another's.
    expect([...bands.short].some((hc) => !bands.deep.has(hc))).toBe(true);
    expect([...bands.deep].some((hc) => !bands.short.has(hc))).toBe(true);
  });
});
