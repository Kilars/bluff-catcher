/**
 * The facing dealer in BTN-vs-3-bet mode (docs/PLAN-btn-4bet.md): only hands
 * hero opened are dealt, each 3-bettor graded on its own chart, the K-key
 * action is a 4-bet.
 */

import { describe, it, expect } from 'vitest';
import { dealFacingSpot, dealableClasses, facingTier, type FacingSpot } from './facingDeal';
import { BUCKET_META, bucketChartAction, bucketsFor } from './facing';
import { BTN4_OPEN } from './btn4BetRanges';
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

const N = 10_000;

describe.each(['mtt', 'cash'] as Format[])('BTN vs 3-bet deals, %s', (format) => {
  const rng = makeRng(11);
  const spots: FacingSpot[] = [];
  for (let i = 0; i < N; i++) spots.push(dealFacingSpot({ rng, format, drill: 'btn4' }));

  it('has one bucket per blind, each a 4-bet chart with hero\'s open set', () => {
    const buckets = bucketsFor(format, 'btn4');
    expect(buckets).toEqual([`btn4-${format}-SB`, `btn4-${format}-BB`]);
    for (const b of buckets) {
      expect(BUCKET_META[b].raise).toBe('4bet');
      expect(BUCKET_META[b].heroOpenBb).toBe(format === 'mtt' ? 2.3 : 2.5);
      expect(BUCKET_META[b].raiseBb).toBe(format === 'mtt' ? 9.2 : 12.5);
    }
    // The other drills never see these buckets.
    for (const b of [...bucketsFor(format), ...bucketsFor(format, 'bb')]) expect(BUCKET_META[b].drill).not.toBe('btn4');
  });

  it('deals only hands the BTN opens, and every one of them', () => {
    const dealt = new Set(spots.map((s) => s.handClass));
    for (const hc of dealt) expect(BTN4_OPEN[format].has(hc), hc).toBe(true);
    expect(dealt.size).toBe(BTN4_OPEN[format].size);
    expect([...dealableClasses(`btn4-${format}-SB`)].sort()).toEqual([...BTN4_OPEN[format]].sort());
  });

  it('grades on the 3-bettor\'s own chart', () => {
    for (const s of spots.slice(0, 2000)) {
      expect(s.bucket).toBe(`btn4-${format}-${s.opener}`);
      const answer = bucketChartAction(s.bucket, s.handClass);
      expect(s.correct).toBe(answer.action);
      expect(s.kind).toBe(answer.kind);
      expect(s.correct).not.toBe('3bet');
    }
  });

  it('picks SB and BB about evenly (±10%)', () => {
    const sb = spots.filter((s) => s.opener === 'SB').length;
    expect(Math.abs(sb / (N / 2) - 1)).toBeLessThan(0.1);
  });

  it('deals all three answers', () => {
    expect(new Set(spots.map((s) => s.correct))).toEqual(new Set(['fold', 'call', '4bet']));
  });
});

describe('BTN vs 3-bet kinds', () => {
  it('cash 4-bets carry value / bluff; 40bb jams carry none', () => {
    expect(bucketChartAction('btn4-cash-SB', 'AA')).toEqual({ action: '4bet', kind: 'value' });
    expect(bucketChartAction('btn4-cash-BB', 'A5s')).toEqual({ action: '4bet', kind: 'bluff' });
    expect(bucketChartAction('btn4-mtt-SB', 'QQ')).toEqual({ action: '4bet' });
    expect(bucketChartAction('btn4-mtt-SB', 'AA')).toEqual({ action: 'call' });
  });
});

describe('BTN vs 3-bet tiers', () => {
  it('measures trash on the bucket\'s own chart, and has a border in every chart', () => {
    for (const format of ['mtt', 'cash'] as Format[]) {
      for (const b of bucketsFor(format, 'btn4')) {
        const tiers = dealableClasses(b).map((hc) => facingTier(b, hc));
        expect(tiers, b).toContain('border');
        expect(tiers, b).toContain('trash');
      }
    }
    // 72o is never opened, so never dealt — but J4s is opened in cash, folds
    // to the 3-bet and sits among folds: trash.
    expect(facingTier('btn4-cash-SB', 'J4s')).toBe('trash');
    // A5s is a bluff 4-bet next to calls and folds: border.
    expect(facingTier('btn4-cash-SB', 'A5s')).toBe('border');
  });
});
