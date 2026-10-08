/**
 * The facing drills' charts as read through `range.ts`: the combo counts and
 * named hands each drill's copy and briefing rely on. These moved here from
 * the per-drill `*Ranges.test.ts` files when the hand-copied charts were
 * replaced by the dataset (docs/PLAN-range-generator.md, phase 3).
 */

import { describe, expect, it } from 'vitest';
import { ALL_169, combosForClass, type HandClass } from './hands';
import {
  BB_CASH_OPENERS,
  BB_MTT_OPENERS,
  BTN4_THREE_BETTORS,
  BUCKETS,
  BUCKET_CHART,
  BUCKET_REACHABLE,
  OPEN4_OPENERS,
  OPEN4_THREE_BETTORS,
  chartAction,
  facingComboCounts,
  type FacingChart,
} from './facing';
import { CASH_RFI, CASH_SEATS, type Format } from './ranges';
import { requireFacingRange } from './range';

const combos = (s: ReadonlySet<HandClass>) => [...s].reduce((n, hc) => n + combosForClass(hc), 0);

/** Every set a chart holds, flattened: its raises (any kind) and its calls. */
function actionSets(chart: FacingChart): ReadonlySet<HandClass>[] {
  return Object.values(chart).flatMap((v): ReadonlySet<HandClass>[] => (v instanceof Set ? [v] : Object.values(v)));
}

describe('every bucket chart', () => {
  it('never lists a class under two actions', () => {
    for (const b of BUCKETS) {
      const seen = new Set<HandClass>();
      for (const set of actionSets(BUCKET_CHART[b])) {
        for (const hc of set) {
          expect(seen.has(hc), `${b} ${hc}`).toBe(false);
          seen.add(hc);
        }
      }
    }
  });

  it('only continues with hands hero can hold, where the spot follows hero’s own open', () => {
    for (const b of BUCKETS) {
      const reachable = BUCKET_REACHABLE[b];
      if (!reachable) continue;
      for (const hc of ALL_169) {
        if (chartAction(BUCKET_CHART[b], hc).action !== 'fold') expect(reachable.has(hc), `${b} ${hc}`).toBe(true);
      }
    }
  });
});

describe('cash RFI', () => {
  it('pins the combo counts', () => {
    expect(CASH_SEATS.map((s) => combos(CASH_RFI[s]))).toEqual([220, 282, 354, 554, 574]);
  });

  it('widens seat by seat, and the SB opens everything the BTN does', () => {
    for (let i = 1; i < CASH_SEATS.length; i++) {
      for (const hc of CASH_RFI[CASH_SEATS[i - 1]]) expect(CASH_RFI[CASH_SEATS[i]].has(hc), hc).toBe(true);
    }
  });
});

describe('cash BTN vs open', () => {
  it('pins the combo counts', () => {
    expect(facingComboCounts(BUCKET_CHART.cashEarly)).toEqual({ threeBet: 110, call: 40, fold: 1176 });
    expect(facingComboCounts(BUCKET_CHART.cashCo)).toEqual({ threeBet: 178, call: 40, fold: 1108 });
  });

  it('the source uses one chart vs LJ and vs HJ', () => {
    const vs = (villain: 'LJ' | 'HJ') => requireFacingRange({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'BTN', villain });
    for (const hc of ALL_169) expect(chartAction(vs('LJ'), hc), hc).toEqual(chartAction(vs('HJ'), hc));
  });

  it('vs CO only adds 3-bets', () => {
    const early = BUCKET_CHART.cashEarly;
    const co = BUCKET_CHART.cashCo;
    const added = ALL_169.filter((hc) => chartAction(co, hc).action !== chartAction(early, hc).action);
    for (const hc of added) {
      expect(chartAction(early, hc).action, hc).toBe('fold');
      expect(chartAction(co, hc).action, hc).toBe('3bet');
    }
    expect(added.sort()).toEqual(['54s', '76s', '87s', 'A7s', 'A6s', 'A3s', 'A2s', 'K9s', 'AJo', 'ATo', 'KJo'].sort());
  });
});

describe('BB defence', () => {
  const counts = (format: Format, openers: readonly string[]) =>
    openers.map((o) => {
      const c = facingComboCounts(BUCKET_CHART[`bb-${format}-${o}` as keyof typeof BUCKET_CHART]);
      return [o, 'threeBet' in c ? c.threeBet : NaN, c.call];
    });

  it('tournament 40bb: defence widens from UTG to BTN, SB is its own shape', () => {
    expect(counts('mtt', BB_MTT_OPENERS)).toEqual([
      ['UTG', 76, 510],
      ['UTG1', 86, 552],
      ['UTG2', 98, 604],
      ['LJ', 90, 660],
      ['HJ', 128, 670],
      ['CO', 166, 716],
      ['BTN', 218, 820],
      ['SB', 208, 754],
    ]);
  });

  it('cash 100bb: defence widens seat by seat', () => {
    expect(counts('cash', BB_CASH_OPENERS)).toEqual([
      ['LJ', 86, 204],
      ['HJ', 86, 256],
      ['CO', 118, 288],
      ['BTN', 188, 342],
      ['SB', 236, 458],
    ]);
  });

  it('3-bets AA against every opener', () => {
    for (const b of BUCKETS.filter((b) => b.startsWith('bb-'))) {
      expect(chartAction(BUCKET_CHART[b], 'AA').action, b).toBe('3bet');
    }
  });
});

describe('BTN vs 3-bet', () => {
  it('cash: value 50 / bluff 40 / call 68 of 554 opened, vs either blind', () => {
    expect(combos(BUCKET_REACHABLE['btn4-cash-SB']!)).toBe(554);
    for (const seat of BTN4_THREE_BETTORS) {
      expect(facingComboCounts(BUCKET_CHART[`btn4-cash-${seat}`])).toEqual({ value: 50, bluff: 40, call: 68, fold: 1168 });
    }
  });

  it('cash bluffs are A5s, AQo, AJo and KQo', () => {
    const bluffs = ALL_169.filter((hc) => chartAction(BUCKET_CHART['btn4-cash-SB'], hc).kind === 'bluff');
    expect(bluffs.sort()).toEqual(['A5s', 'AJo', 'AQo', 'KQo']);
  });

  it('40bb: 4-bet 90 / call 194 vs SB, 70 / 274 vs BB, of 664 opened, with no kind', () => {
    expect(combos(BUCKET_REACHABLE['btn4-mtt-SB']!)).toBe(664);
    expect(facingComboCounts(BUCKET_CHART['btn4-mtt-SB'])).toEqual({ fourBet: 90, call: 194, fold: 1042 });
    expect(facingComboCounts(BUCKET_CHART['btn4-mtt-BB'])).toEqual({ fourBet: 70, call: 274, fold: 982 });
  });

  it('40bb: AA and KK flat rather than jam, vs either blind', () => {
    for (const seat of BTN4_THREE_BETTORS) {
      expect(chartAction(BUCKET_CHART[`btn4-mtt-${seat}`], 'AA').action, seat).toBe('call');
      expect(chartAction(BUCKET_CHART[`btn4-mtt-${seat}`], 'KK').action, seat).toBe('call');
    }
  });
});

describe('open vs 3-bet (cash)', () => {
  it('LJ 34/18/40, HJ 40/12/46, CO 40/24/46 (value / bluff / call)', () => {
    expect(facingComboCounts(BUCKET_CHART['open4-cash-LJ'])).toEqual({ value: 34, bluff: 18, call: 40, fold: 1234 });
    expect(facingComboCounts(BUCKET_CHART['open4-cash-HJ'])).toEqual({ value: 40, bluff: 12, call: 46, fold: 1228 });
    expect(facingComboCounts(BUCKET_CHART['open4-cash-CO'])).toEqual({ value: 40, bluff: 24, call: 46, fold: 1216 });
  });

  it('the source answers every 3-bettor with the one chart the bucket grades against', () => {
    for (const opener of OPEN4_OPENERS) {
      for (const t of OPEN4_THREE_BETTORS[opener]) {
        const chart = requireFacingRange({ format: 'cash', stack: '100bb', node: 'vs3bet', hero: opener, villain: t });
        for (const hc of ALL_169) {
          expect(chartAction(chart, hc), `${opener} vs ${t} ${hc}`).toEqual(chartAction(BUCKET_CHART[`open4-cash-${opener}`], hc));
        }
      }
    }
  });

  it('JJ is a value 4-bet from HJ and CO, a bluff from the LJ', () => {
    expect(chartAction(BUCKET_CHART['open4-cash-LJ'], 'JJ').kind).toBe('bluff');
    expect(chartAction(BUCKET_CHART['open4-cash-HJ'], 'JJ').kind).toBe('value');
    expect(chartAction(BUCKET_CHART['open4-cash-CO'], 'JJ').kind).toBe('value');
  });
});

describe('facingComboCounts over the dealt hands', () => {
  it('counts only the hands a spot deals, keeping every continue', () => {
    for (const [b, dealt] of Object.entries(BUCKET_REACHABLE)) {
      const all = facingComboCounts(BUCKET_CHART[b as keyof typeof BUCKET_CHART]);
      const some = facingComboCounts(BUCKET_CHART[b as keyof typeof BUCKET_CHART], dealt);
      expect(Object.values(some).reduce((n, c) => n + c, 0), b).toBe(combos(dealt!));
      // Only folds go undealt: the chart's raises and calls are all in range.
      expect({ ...some, fold: 0 }, b).toEqual({ ...all, fold: 0 });
    }
  });
});
