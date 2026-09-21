import { describe, it, expect, vi, afterEach } from 'vitest';
import { dealSpot, boardKey, type DealOptions } from './deal';
import { type Category } from './classify';
import { analyse, type Spot as OddsSpot } from './odds';

/** Deterministic RNG (mulberry32) so every test run is reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALL_CATEGORIES: Category[] = [
  'flushDraw', 'openEnder', 'gutshot', 'doubleGutshot',
  'combo', 'pairImproving', 'overcards', 'setDraw',
];

/** Rebuild an odds Spot from a dealt spot so we can re-run analyse(). */
function oddsSpotOf(s: ReturnType<typeof dealSpot>): OddsSpot {
  return { hero: s.hero, board: s.board, hits: s.read.hits };
}

afterEach(() => vi.restoreAllMocks());

describe('dealSpot', () => {
  // One sweep, every invariant. These used to be three 500-deal loops asking
  // three questions of the same hands.
  it('deals nothing but valid, playable keepers', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rng = seeded(1);

    for (let i = 0; i < 500; i++) {
      const spot = dealSpot({ rng });

      expect(spot.read).toBeTruthy();
      expect(ALL_CATEGORIES).toContain(spot.read.primaryCategory);
      expect(spot.hero).toHaveLength(2);
      expect(spot.board).toHaveLength(spot.street === 'flop' ? 3 : 4);
      // hero and board never overlap
      const all = new Set([...spot.hero, ...spot.board]);
      expect(all.size).toBe(spot.hero.length + spot.board.length);

      // Every keeper has at least one one-card out. The old taxonomy's
      // zero-out 'backdoor' category is gone (DECISIONS.md), so this is now
      // unconditional — and the dealer must never bring it back.
      expect(analyse(oddsSpotOf(spot)).outs).toBeGreaterThan(0);
      expect(spot.read.primaryCategory).not.toBe('backdoor');
      expect(spot.read.name).not.toContain('backdoor');
    }

    // analyse() logs on a mis-specified spot; nothing dealt should trip it.
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('honours a forced target category', () => {
    for (const target of ALL_CATEGORIES) {
      const rng = seeded(42 + target.length);
      // Zero every other weight so pickCategory always chooses the target
      // (dealSpot merges given weights OVER the defaults).
      const weights = Object.fromEntries(
        ALL_CATEGORIES.map((c) => [c, c === target ? 1 : 0]),
      ) as DealOptions['weights'];
      const spot = dealSpot({ rng, weights });
      expect(spot.read.primaryCategory).toBe(target);
    }
  });

  it('honours a forced street', () => {
    const rng = seeded(7);
    for (let i = 0; i < 50; i++) {
      expect(dealSpot({ rng, street: 'flop' }).street).toBe('flop');
      expect(dealSpot({ rng, street: 'turn' }).street).toBe('turn');
    }
  });

  it('never repeats a board within a session (seen set)', () => {
    const rng = seeded(99);
    const seen = new Set<string>();
    const keys: string[] = [];
    for (let i = 0; i < 300; i++) {
      const spot = dealSpot({ rng, seen });
      keys.push(boardKey(spot.board));
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers every category over many default-weighted deals', () => {
    const rng = seeded(13);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1600; i++) {
      const spot = dealSpot({ rng });
      counts[spot.read.primaryCategory] = (counts[spot.read.primaryCategory] ?? 0) + 1;
    }
    for (const cat of ALL_CATEGORIES) {
      expect(counts[cat] ?? 0, cat).toBeGreaterThan(0);
    }
    // Weighted: the weight-3 categories should out-appear the weight-1 ones overall.
    const heavy = (counts.flushDraw ?? 0) + (counts.openEnder ?? 0);
    const light = (counts.combo ?? 0) + (counts.doubleGutshot ?? 0) + (counts.setDraw ?? 0);
    expect(heavy).toBeGreaterThan(light);
  }, 20_000);
});
