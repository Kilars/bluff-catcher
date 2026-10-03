import { describe, expect, it } from 'vitest';
import { BUCKET_CHART, BUCKET_META, bucketsFor, chartAction, facingComboCounts } from './facing';
import { dealFacingSpot } from './facingDeal';
import { CHART_META, chartKeyFor, DEFAULT_DEPTH, FORMATS } from './ranges';
import { chartTwins } from './range';
import { CURATED_SPOTS, SPOT_STACK, openSizeBb } from './spots';

/** Action order per format, the blinds last (as the table seats them). */
const order = (format: 'mtt' | 'cash') => [
  ...CHART_META[chartKeyFor(format, DEFAULT_DEPTH)].seats.filter((s) => s !== 'SB'),
  'SB',
  'BB',
];

describe('curated seat-vs-open spots', () => {
  it('each becomes one bucket of the seat drill, in list order', () => {
    for (const format of FORMATS) {
      expect(bucketsFor(format, 'seat')).toEqual(
        CURATED_SPOTS.filter((s) => s.format === format).map((s) => `seat-${format}-${s.hero}-${s.villain}`)
      );
    }
  });

  it('seat hero after the opener, at a seat that table has', () => {
    for (const s of CURATED_SPOTS) {
      const ring = order(s.format);
      expect(ring.indexOf(s.villain), `${s.villain}`).toBeGreaterThanOrEqual(0);
      expect(ring.indexOf(s.hero), `${s.hero} after ${s.villain}`).toBeGreaterThan(ring.indexOf(s.villain));
    }
  });

  it('read a real chart: AA 3-bets, 72o folds, something calls or 3-bets beyond the top', () => {
    for (const b of [...bucketsFor('mtt', 'seat'), ...bucketsFor('cash', 'seat')]) {
      const chart = BUCKET_CHART[b];
      expect(chartAction(chart, 'AA').action, b).toBe('3bet');
      expect(chartAction(chart, '72o').action, b).toBe('fold');
      const c = facingComboCounts(chart);
      expect('threeBet' in c && c.threeBet > 6, b).toBe(true);
    }
  });

  it('pin the cash chart the source shares: CO vs HJ stands for five other pairs, never flats', () => {
    const twins = chartTwins({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'CO', villain: 'HJ' });
    expect(twins.map((t) => `${t.hero} vs ${t.villain}`).sort()).toEqual(
      ['CO vs LJ', 'HJ vs LJ', 'SB vs CO', 'SB vs HJ', 'SB vs LJ'].sort()
    );
    expect(BUCKET_META['seat-cash-CO-HJ'].footnote).toMatch(/5 other seat pairs/);
    for (const b of bucketsFor('cash', 'seat')) expect(facingComboCounts(BUCKET_CHART[b]).call, b).toBe(0);
  });

  it('face the source’s open size, the SB’s own included', () => {
    expect(BUCKET_META['seat-cash-SB-BTN'].raiseBb).toBe(2.5);
    expect(BUCKET_META['seat-mtt-SB-CO'].raiseBb).toBe(2.3);
    expect(openSizeBb('cash', 'SB')).toBe(3);
    expect(openSizeBb('mtt', 'SB')).toBe(3.5);
  });

  it('the tournament charts are each pair’s own', () => {
    expect(chartTwins({ format: 'mtt', stack: SPOT_STACK.mtt, node: 'vsOpen', hero: 'CO', villain: 'HJ' })).toEqual([]);
    expect(BUCKET_META['seat-mtt-CO-HJ'].footnote).toBe('Pure chart: border hands are close.');
  });

  it('the dealer deals only curated spots, hero in the curated seat, and every spot comes up', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (const format of FORMATS) {
      const curated = CURATED_SPOTS.filter((s) => s.format === format).map((s) => `${s.hero} vs ${s.villain}`);
      const seen = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const spot = dealFacingSpot({ format, drill: 'seat', rng });
        const meta = BUCKET_META[spot.bucket];
        const pair = `${meta.hero} vs ${spot.opener}`;
        expect(curated, pair).toContain(pair);
        expect(spot.correct).toBe(chartAction(BUCKET_CHART[spot.bucket], spot.handClass).action);
        seen.add(pair);
      }
      expect([...seen].sort()).toEqual([...curated].sort());
    }
  });
});
