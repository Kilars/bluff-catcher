/**
 * The facing dealer in BB-defence mode (docs/PLAN-bb-defend.md): every opener
 * graded on its own chart, openers picked uniformly, every class reachable.
 */

import { describe, it, expect } from 'vitest';
import { borderSkewFacingPool, dealFacingSpot, facingTier, TIER_WEIGHT, type FacingSpot } from './facingDeal';
import { BUCKET_META, bucketChartAction, bucketsFor } from './facing';
import { BB_CASH_OPENERS, BB_MTT_OPENERS } from './facing';
import { ALL_169 } from './hands';
import type { Format } from './ranges';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 20_000;

describe.each([
  { format: 'mtt' as Format, openers: BB_MTT_OPENERS as readonly string[] },
  { format: 'cash' as Format, openers: BB_CASH_OPENERS as readonly string[] },
])('BB defence deals, $format', ({ format, openers }) => {
  const rng = makeRng(7);
  const spots: FacingSpot[] = [];
  for (let i = 0; i < N; i++) spots.push(dealFacingSpot({ rng, format, drill: 'bb' }));

  it('has one bucket per opener, and none of the BTN drill’s', () => {
    const buckets = bucketsFor(format, 'bb');
    expect(buckets.map((b) => BUCKET_META[b].openers)).toEqual(openers.map((o) => [o]));
    for (const b of bucketsFor(format)) expect(BUCKET_META[b].drill).toBe('btn');
  });

  it('grades every deal on the opener’s own chart, with no 3-bet kind', () => {
    for (const s of spots.slice(0, 2000)) {
      expect(s.bucket).toBe(`bb-${format}-${s.opener}`);
      expect(s.correct).toBe(bucketChartAction(s.bucket, s.handClass).action);
      expect(s.kind).toBeUndefined();
    }
  });

  it('faces the source open sizes: 2.3bb (SB 3.5bb) at 40bb, 2.5bb (SB 3bb) in cash', () => {
    const [open, sbOpen] = format === 'mtt' ? [2.3, 3.5] : [2.5, 3];
    for (const b of bucketsFor(format, 'bb')) {
      const meta = BUCKET_META[b];
      expect(meta.raiseBb, b).toBe(meta.chartSeat === 'SB' ? sbOpen : open);
      expect(meta.openerTag, b).toBeUndefined();
    }
  });

  it('picks openers uniformly (±10%)', () => {
    const counts: Record<string, number> = {};
    for (const s of spots) counts[s.opener] = (counts[s.opener] ?? 0) + 1;
    expect(Object.keys(counts).sort()).toEqual([...openers].sort());
    const expected = N / openers.length;
    for (const o of openers) expect(Math.abs(counts[o] / expected - 1), o).toBeLessThan(0.1);
  });

  it('keeps every class reachable', () => {
    expect(new Set(spots.map((s) => s.handClass)).size).toBe(169);
  });

  // The 40bb charts are patchy (lone offsuit folds among calls), so most of
  // the grid is border there and several charts have no trash at all — the
  // skew is close to uniform. Only the weights themselves are pinned.
  it('weights every class by its tier, with a border in each chart', () => {
    for (const b of bucketsFor(format, 'bb')) {
      expect(ALL_169.map((hc) => facingTier(b, hc)), b).toContain('border');
      for (const hc of ALL_169) {
        expect(borderSkewFacingPool.weight(b, hc)).toBe(TIER_WEIGHT[facingTier(b, hc)]);
      }
    }
  });
});

describe('BB defence spot checks', () => {
  it('72o is trash vs UTG in the tournament chart', () => {
    expect(facingTier('bb-mtt-UTG', '72o')).toBe('trash');
  });

  it('measures trash against the opener’s own chart, not every chart', () => {
    // Q2s and J5s fold vs a cash LJ open (as do their neighbours) but defend
    // vs the SB — an all-charts rule (the BTN drill's) would never call them trash.
    for (const hc of ['Q2s', 'J5s']) {
      expect(facingTier('bb-cash-LJ', hc), hc).toBe('trash');
      expect(bucketChartAction('bb-cash-SB', hc).action, hc).not.toBe('fold');
    }
  });

  it('has no bucket for a seat that cannot open into the BB in 6-max', () => {
    expect(bucketsFor('cash', 'bb').map((b) => BUCKET_META[b].chartSeat)).not.toContain('UTG');
  });
});
