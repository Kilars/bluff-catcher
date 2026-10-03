/**
 * Tests for the facing-open charts.
 *
 * The combo counts are the transcription check: each source chart prints its
 * value / bluff / call totals, so a mis-coloured cell shows up as a wrong sum.
 * The bucket-error test is the design check: it pins how far each opener's
 * real chart sits from the chart it is graded against, so an edit to either
 * that moves the error table in PLAN-3bet.md gets caught.
 */

import { describe, it, expect } from 'vitest';
import {
  bucketsFor,
  bucketFor,
  BUCKET_CHART,
  BUCKET_META,
  BUCKET_OF,
  EARLY,
  FACING_ACTIONS,
  LATE,
  OPENERS,
  type FacingChart,
  type KindedChart,
  type Opener,
  bucketChartAction,
  chartAction,
  facingAction,
  facingComboCounts,
} from './facing';
import { FACING_SOURCES } from './facing';
import { ALL_169, combosForClass } from './hands';
import { POSITIONS } from './ranges';

/** These suites cover the tournament charts; cash has its own below. */
const MTT_BUCKETS = bucketsFor('mtt');

/** Combos graded with a different fold / call / 3-bet action by two charts. */
function comboDiff(a: FacingChart, b: FacingChart): number {
  let diff = 0;
  for (const hc of ALL_169) {
    if (chartAction(a, hc).action !== chartAction(b, hc).action) diff += combosForClass(hc);
  }
  return diff;
}

describe('facing — shape', () => {
  it('has its actions in order of aggression, and openers that are real seats', () => {
    expect([...FACING_ACTIONS]).toEqual(['fold', 'call', '3bet', '4bet']);
    expect([...OPENERS]).toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO']);
    for (const o of OPENERS) expect(POSITIONS).toContain(o);
  });

  it('buckets UTG/UTG+1 as early and the rest as late', () => {
    expect(BUCKET_META.early.openers).toEqual(['UTG', 'UTG1']);
    expect(BUCKET_META.late.openers).toEqual(['UTG2', 'LJ', 'HJ', 'CO']);
    expect(BUCKET_META.early.label).toBe('vs Early');
    expect(BUCKET_META.late.label).toBe('vs Late');
    for (const b of MTT_BUCKETS) {
      // A bucket's chart seat is one of its own openers.
      expect(BUCKET_OF[BUCKET_META[b].chartSeat as Opener]).toBe(b);
    }
  });

  it('keeps value, bluff and call disjoint in every chart', () => {
    const charts: KindedChart[] = [EARLY, LATE, ...OPENERS.map((o) => FACING_SOURCES[o])];
    for (const chart of charts) {
      for (const hc of chart.value) {
        expect(chart.bluff.has(hc) || chart.call.has(hc), hc).toBe(false);
      }
      for (const hc of chart.bluff) expect(chart.call.has(hc), hc).toBe(false);
      for (const hc of [...chart.value, ...chart.bluff, ...chart.call]) {
        expect(ALL_169, hc).toContain(hc);
      }
    }
  });
});

describe('facing — bucket charts', () => {
  it('pins each bucket’s value / bluff / call combo counts', () => {
    expect(facingComboCounts(EARLY)).toEqual({ value: 34, bluff: 52, call: 116, fold: 1124 });
    expect(facingComboCounts(LATE)).toEqual({ value: 50, bluff: 60, call: 140, fold: 1076 });
  });

  it('is the UTG+1 and LJ source chart, cell for cell', () => {
    for (const b of MTT_BUCKETS) {
      const source = FACING_SOURCES[BUCKET_META[b].chartSeat as Opener];
      for (const hc of ALL_169) {
        expect(chartAction(BUCKET_CHART[b], hc), `${b} ${hc}`).toEqual(chartAction(source, hc));
      }
    }
    expect(BUCKET_CHART.early).toBe(EARLY);
    expect(BUCKET_CHART.late).toBe(LATE);
  });

  it('spot-checks vs Early', () => {
    expect(bucketChartAction('early', 'AQo')).toEqual({ action: '3bet', kind: 'bluff' });
    expect(bucketChartAction('early', 'JJ')).toEqual({ action: 'call' });
    expect(bucketChartAction('early', 'A9s')).toEqual({ action: 'fold' });
  });

  it('spot-checks vs Late', () => {
    expect(bucketChartAction('late', 'AQo')).toEqual({ action: '3bet', kind: 'value' });
    expect(bucketChartAction('late', 'A8s')).toEqual({ action: '3bet', kind: 'bluff' });
    expect(bucketChartAction('late', 'KQo')).toEqual({ action: 'call' });
    expect(bucketChartAction('late', 'AJs')).toEqual({ action: 'call' });
  });

  it('grades every opener against its bucket’s chart', () => {
    for (const o of OPENERS) {
      for (const hc of ALL_169) {
        expect(facingAction(o, hc)).toEqual(bucketChartAction(BUCKET_OF[o], hc));
      }
    }
    expect(facingAction('CO', 'AQo')).toEqual({ action: '3bet', kind: 'value' });
    expect(facingAction('UTG', 'AQo')).toEqual({ action: '3bet', kind: 'bluff' });
  });

  it('carries a kind on 3-bets only', () => {
    for (const b of MTT_BUCKETS) {
      for (const hc of ALL_169) {
        const { action, kind } = bucketChartAction(b, hc);
        expect(kind !== undefined, `${b} ${hc}`).toBe(action === '3bet');
      }
    }
  });
});

describe('FACING_SOURCES — the six source charts', () => {
  it('matches the value / bluff / call counts printed under each chart', () => {
    const printed: Record<Opener, [number, number, number]> = {
      UTG: [34, 48, 108],
      UTG1: [34, 52, 116],
      UTG2: [50, 52, 136],
      LJ: [50, 60, 140],
      HJ: [54, 68, 152],
      CO: [54, 92, 184],
    };
    for (const o of OPENERS) {
      const { value, bluff, call, fold } = facingComboCounts(FACING_SOURCES[o]) as {
        value: number;
        bluff: number;
        call: number;
        fold: number;
      };
      expect([value, bluff, call], o).toEqual(printed[o]);
      expect(value + bluff + call + fold).toBe(1326);
    }
  });

  it('calls JJ and TT against every opener', () => {
    for (const o of OPENERS) {
      expect(chartAction(FACING_SOURCES[o], 'JJ').action, o).toBe('call');
      expect(chartAction(FACING_SOURCES[o], 'TT').action, o).toBe('call');
    }
  });
});

describe('facing — bucket error', () => {
  // Combos each opener's real chart grades differently from its bucket's chart.
  const errorOf = (o: Opener) =>
    comboDiff(FACING_SOURCES[o], BUCKET_CHART[BUCKET_OF[o]]);

  it('pins the per-opener error rows', () => {
    const rows = Object.fromEntries(OPENERS.map((o) => [o, errorOf(o)]));
    expect(rows).toEqual({ UTG: 16, UTG1: 0, UTG2: 16, LJ: 0, HJ: 28, CO: 116 });
  });

  it('averages 29.3 combos over the six openers, uniformly weighted', () => {
    const total = OPENERS.reduce((sum, o) => sum + errorOf(o), 0);
    expect(total / OPENERS.length).toBeCloseTo(29.3, 1);
  });

  it('pins the row of the pairwise table the buckets are chosen from', () => {
    // BTN vs LJ against each opener's real chart — the Late column.
    const lj = Object.fromEntries(OPENERS.map((o) => [o, comboDiff(FACING_SOURCES[o], LATE)]));
    expect(lj).toEqual({ UTG: 92, UTG1: 76, UTG2: 16, LJ: 0, HJ: 28, CO: 116 });
  });
});

describe('facing — cash buckets', () => {
  it('puts LJ and HJ in one bucket and CO in its own', () => {
    expect(bucketFor('cash', 'LJ')).toBe('cashEarly');
    expect(bucketFor('cash', 'HJ')).toBe('cashEarly');
    expect(bucketFor('cash', 'CO')).toBe('cashCo');
    expect(() => bucketFor('cash', 'UTG')).toThrow();
    expect(bucketsFor('cash')).toEqual(['cashEarly', 'cashCo']);
    expect(bucketsFor('mtt')).toEqual(['early', 'late']);
  });

  it('answers a bare 3-bet with no kind', () => {
    const cash = (o: 'LJ' | 'HJ' | 'CO', hc: string) => bucketChartAction(bucketFor('cash', o), hc);
    expect(cash('LJ', 'AA')).toEqual({ action: '3bet' });
    expect(cash('CO', 'A2s')).toEqual({ action: '3bet' });
    expect(cash('HJ', 'A2s')).toEqual({ action: 'fold' });
    expect(cash('LJ', '99')).toEqual({ action: 'call' });
  });

  it('agrees with the tournament bucket map for tournament openers', () => {
    for (const o of OPENERS) expect(bucketFor('mtt', o)).toBe(BUCKET_OF[o]);
  });
});
