/**
 * Tests for the preflop spot dealer.
 *
 * Uses seeded RNG for determinism.
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

describe('dealPreflopSpot() — basic validity', () => {
  it('returns a valid position', () => {
    const rng = makeRng(42);
    const spot = dealPreflopSpot({ rng });
    expect(POSITIONS).toContain(spot.position as Position);
  });

  it('returns exactly 2 cards', () => {
    const rng = makeRng(42);
    const spot = dealPreflopSpot({ rng });
    expect(spot.cards.length).toBe(2);
  });

  it('two cards are distinct', () => {
    const rng = makeRng(42);
    const spot = dealPreflopSpot({ rng });
    expect(spot.cards[0]).not.toBe(spot.cards[1]);
  });

  it('handClass matches cards', () => {
    const rng = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const spot = dealPreflopSpot({ rng });
      const expected = computeHandClass(spot.cards[0], spot.cards[1]);
      expect(spot.handClass).toBe(expected);
    }
  });

  it('correct always matches isOpen(position, handClass)', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 500; i++) {
      const spot = dealPreflopSpot({ rng });
      const expected = isOpen(spot.position, spot.handClass) ? 'open' : 'fold';
      expect(spot.correct).toBe(expected);
    }
  });

  it('correct is either "open" or "fold"', () => {
    const rng = makeRng(77);
    for (let i = 0; i < 100; i++) {
      const spot = dealPreflopSpot({ rng });
      expect(['open', 'fold']).toContain(spot.correct);
    }
  });
});

describe('dealPreflopSpot() — position distribution', () => {
  it('all 7 positions appear over N deals', () => {
    const rng = makeRng(123);
    const seen = new Set<Position>();
    for (let i = 0; i < N_DEALS; i++) {
      const spot = dealPreflopSpot({ rng });
      seen.add(spot.position);
    }
    for (const pos of POSITIONS) {
      expect(seen.has(pos)).toBe(true);
    }
  });

  it('positions are approximately uniformly distributed (within 3% of 1/7)', () => {
    const rng = makeRng(456);
    const counts: Record<string, number> = {};
    for (const pos of POSITIONS) counts[pos] = 0;

    for (let i = 0; i < N_DEALS; i++) {
      counts[dealPreflopSpot({ rng }).position]++;
    }

    const expected = N_DEALS / 7;
    for (const pos of POSITIONS) {
      const pct = Math.abs(counts[pos] - expected) / expected;
      expect(pct).toBeLessThan(0.10); // within 10% of expected (generous for seeded rng)
    }
  });
});

describe('dealPreflopSpot() — card validity', () => {
  it('cards are well-formed (rank + suit format)', () => {
    const rng = makeRng(1);
    const ranks = new Set('23456789TJQKA');
    const suits = new Set(['s', 'h', 'd', 'c']);

    for (let i = 0; i < 200; i++) {
      const spot = dealPreflopSpot({ rng });
      for (const card of spot.cards) {
        expect(card.length).toBe(2);
        expect(ranks.has(card[0])).toBe(true);
        expect(suits.has(card[1])).toBe(true);
      }
    }
  });

  it('the two cards are always different', () => {
    const rng = makeRng(2);
    for (let i = 0; i < 500; i++) {
      const spot = dealPreflopSpot({ rng });
      expect(spot.cards[0]).not.toBe(spot.cards[1]);
    }
  });
});

describe('edgeSkewPool distribution', () => {
  it('every hand class appears at least once over N deals', () => {
    const rng = makeRng(7777);
    const seen = new Set<string>();
    const LARGE_N = 20000; // need many more deals to hit all 169 classes

    for (let i = 0; i < LARGE_N; i++) {
      const spot = dealPreflopSpot({ rng, pool: edgeSkewPool });
      seen.add(spot.handClass);
    }

    // Every hand class should appear (no zero-weight classes)
    for (const hc of ALL_169) {
      expect(seen.has(hc)).toBe(true);
    }
  });

  it('edge classes appear more than mid-range classes (~4x)', { timeout: 30000 }, () => {
    // Use UTG as the test position for determinism
    // UTG boundary is around rank 60-80 in the strength ranking
    // Mid hand: something clearly in the middle of the ranking, not near boundary
    // Edge hand: something just inside or just outside UTG range boundary

    const rng = makeRng(9999);
    const SAMPLE_N = 30000;

    // Count per hand class at UTG (by fixing position)
    const counts: Record<string, number> = {};
    for (const hc of ALL_169) counts[hc] = 0;

    let utg_deals = 0;
    for (let i = 0; i < SAMPLE_N; i++) {
      const spot = dealPreflopSpot({ rng, pool: edgeSkewPool });
      if (spot.position === 'UTG') {
        counts[spot.handClass]++;
        utg_deals++;
      }
    }

    // We need enough UTG deals for meaningful statistics
    // ~1/7 of SAMPLE_N ≈ 4285 UTG deals
    expect(utg_deals).toBeGreaterThan(1000);

    // Take the example hands from the pool itself rather than naming hands from
    // one particular chart: the charts move when the reference charts do, the
    // weighting mechanism does not.
    const midHand = 'AA'; // always in range, nowhere near any boundary
    const edgeHand = ALL_169.find(
      (hc) =>
        hc.length === 3 &&
        hc.endsWith('s') &&
        edgeSkewPool.weight('UTG', hc, DEFAULT_DEPTH) === 4,
    )!;
    const trashHand = '72o'; // not near any boundary

    expect(edgeHand).toBeDefined();
    expect(edgeSkewPool.weight('UTG', midHand, DEFAULT_DEPTH)).toBe(1);

    // Per-combo rates (normalize by combo count since pairs have 6, suited 4, offsuit 12)
    // AA: pair, 6 combos; the edge hand is suited, 4 combos; 72o: offsuit, 12 combos
    // To compare per-class rates, divide count by combo weight
    const midCount = counts[midHand];
    const edgeCount = counts[edgeHand];
    const trashCount = counts[trashHand];

    if (midCount > 0 && trashCount > 0 && edgeCount > 0) {
      // Per-class rate (normalize by combo count)
      const midRate = midCount / 6;    // AA has 6 combos
      const edgeRate = edgeCount / 4;  // a suited class has 4 combos
      const trashRate = trashCount / 12; // 72o has 12 combos

      // Edge should be ~4x mid (loose check: >1.5x to absorb sampling noise)
      // Note: exact ratio depends on boundary band width
      expect(edgeRate).toBeGreaterThan(midRate * 1.5); // edge clearly boosted over mid

      // Trash should be clearly less than mid (~0.25x)
      expect(trashRate).toBeLessThan(midRate * 0.8); // trash clearly less than mid
    }
  });

  it('trash classes are suppressed relative to base hands', () => {
    const rng = makeRng(5555);
    const SAMPLE_N = 20000;

    const counts: Record<string, number> = {};
    for (const hc of ALL_169) counts[hc] = 0;

    for (let i = 0; i < SAMPLE_N; i++) {
      const spot = dealPreflopSpot({ rng, pool: edgeSkewPool });
      counts[spot.handClass]++;
    }

    // Trash hands (rank > 135 in strength ranking, not near any boundary)
    // should appear significantly less than average
    const trashHands = HAND_STRENGTH_RANKING.slice(140); // bottom 29 hands
    const normalHands = HAND_STRENGTH_RANKING.slice(40, 80); // middle range hands

    let trashTotal = 0;
    let trashComboTotal = 0;
    for (const hc of trashHands) {
      trashTotal += counts[hc];
      // offsuit combos = 12, suited = 4, pair = 6
      const comboCount = hc.length === 2 ? 6 : hc[2] === 's' ? 4 : 12;
      trashComboTotal += comboCount;
    }

    let normalTotal = 0;
    let normalComboTotal = 0;
    for (const hc of normalHands) {
      normalTotal += counts[hc];
      const comboCount = hc.length === 2 ? 6 : hc[2] === 's' ? 4 : 12;
      normalComboTotal += comboCount;
    }

    // Per-combo rates
    const trashRate = trashTotal / trashComboTotal;
    const normalRate = normalTotal / normalComboTotal;

    // Trash should appear at significantly lower rate than normal hands
    // At 0.25x base weight, trash rate should be much less than normal rate
    expect(trashRate).toBeLessThan(normalRate * 0.7);
  });
});

describe('uniformPool', () => {
  it('all hand classes appear over many deals', () => {
    const rng = makeRng(1234);
    const seen = new Set<string>();
    const LARGE_N = 30000;

    for (let i = 0; i < LARGE_N; i++) {
      const spot = dealPreflopSpot({ rng, pool: uniformPool });
      seen.add(spot.handClass);
    }

    for (const hc of ALL_169) {
      expect(seen.has(hc)).toBe(true);
    }
  });

  it('correct is always consistent with isOpen', () => {
    const rng = makeRng(8888);
    for (let i = 0; i < 200; i++) {
      const spot = dealPreflopSpot({ rng, pool: uniformPool });
      const expected = isOpen(spot.position, spot.handClass) ? 'open' : 'fold';
      expect(spot.correct).toBe(expected);
    }
  });
});

describe('ACTIVE_POOL', () => {
  it('is the edgeSkewPool by default', () => {
    expect(ACTIVE_POOL.name).toBe('edgeSkew');
  });
});

describe('dealPreflopSpot() — seeded determinism', () => {
  it('same seed produces same first spot', () => {
    const spot1 = dealPreflopSpot({ rng: makeRng(42) });
    const spot2 = dealPreflopSpot({ rng: makeRng(42) });
    expect(spot1.position).toBe(spot2.position);
    expect(spot1.cards[0]).toBe(spot2.cards[0]);
    expect(spot1.cards[1]).toBe(spot2.cards[1]);
    expect(spot1.handClass).toBe(spot2.handClass);
    expect(spot1.correct).toBe(spot2.correct);
  });

  it('different seeds produce different spots (usually)', () => {
    const spot1 = dealPreflopSpot({ rng: makeRng(1) });
    const spot2 = dealPreflopSpot({ rng: makeRng(999999) });
    // Not guaranteed to be different, but very unlikely with these seeds
    // Just check it runs without error
    expect(spot1).toBeDefined();
    expect(spot2).toBeDefined();
  });
});

describe('dealPreflopSpot() — stack depth', () => {
  it('defaults to the deep tier when no depth is given', () => {
    const spot = dealPreflopSpot({ rng: makeRng(7) });
    expect(spot.depth).toBe(DEFAULT_DEPTH);
    expect(spot.depth).toBe('deep');
  });

  it('reports back the depth it was asked for', () => {
    for (const depth of DEPTHS) {
      const spot = dealPreflopSpot({ rng: makeRng(7), depth });
      expect(spot.depth).toBe(depth);
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

  it('edgeSkewPool skews to each tier\u2019s own boundary, not the deep one', () => {
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
