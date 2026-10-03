/**
 * The low-stakes read on the cash 4-bet charts (`lowStakes.ts`): the equity
 * table against its vendored source, the jam prices, and which value 4-bets
 * fold to a value-only jam as a result.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_169, type HandClass } from './hands';
import { JAM_EQUITY, POPULATION_JAM, jamPrice, lowStakesChart } from './lowStakes';
import {
  BUCKETS,
  BUCKET_CHART,
  bucketChart,
  bucketChartAction,
  hasOpponentsRead,
  lowStakesNote,
  type FourBetChart,
} from './facing';
import { BTN4_CASH_CHARTS } from './btn4BetRanges';
import { OPEN4_CASH_CHARTS } from './open4BetRanges';

const SOURCE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../research/population-jam-equity.json'), 'utf8')
) as { jam: string; equity: Record<string, number> };

function split(chart: FourBetChart) {
  if (!('value' in chart.fourBet)) throw new Error('plain chart');
  return { value: [...chart.fourBet.value].sort(), bluff: [...chart.fourBet.bluff].sort() };
}

describe('jam equity', () => {
  it('matches research/population-jam-equity.json', () => {
    expect(JAM_EQUITY).toEqual(SOURCE.equity);
    expect(POPULATION_JAM.replace(/\s/g, '')).toBe(SOURCE.jam);
  });

  it('has a number for every cash value 4-bet', () => {
    for (const chart of [...Object.values(BTN4_CASH_CHARTS), ...Object.values(OPEN4_CASH_CHARTS)]) {
      if (!('value' in chart.fourBet)) continue;
      for (const hc of chart.fourBet.value) expect(JAM_EQUITY[hc], hc).toBeDefined();
    }
  });
});

describe('jamPrice', () => {
  it('prices a jam over a 25bb 4-bet with one blind dead at ~37%', () => {
    expect(jamPrice(25, 1)).toBeCloseTo(37.31, 2); // vs SB: call 75 into 201
    expect(jamPrice(25, 0.5)).toBeCloseTo(37.41, 2); // vs BB
  });

  it('prices a jam over a 19bb 4-bet vs an in-position 3-bettor at ~40%', () => {
    expect(jamPrice(19, 1.5)).toBeCloseTo(40.2, 1); // call 81 into 201.5
  });
});

describe('low-stakes charts', () => {
  it('BTN vs a blind 3-bet: JJ, TT and AQs fold to the jam', () => {
    for (const seat of ['SB', 'BB'] as const) {
      expect(split(bucketChart(`btn4-cash-${seat}`, 'low') as FourBetChart)).toEqual({
        value: ['AA', 'AKo', 'AKs', 'KK', 'QQ'],
        bluff: ['A5s', 'AJo', 'AQo', 'AQs', 'JJ', 'KQo', 'TT'],
      });
    }
  });

  it('open vs 3-bet: JJ folds to the jam from HJ and CO; the LJ chart is unchanged', () => {
    expect(split(bucketChart('open4-cash-LJ', 'low') as FourBetChart)).toEqual(
      split(BUCKET_CHART['open4-cash-LJ'] as FourBetChart)
    );
    for (const opener of ['HJ', 'CO'] as const) {
      const low = split(bucketChart(`open4-cash-${opener}`, 'low') as FourBetChart);
      expect(low.value).toEqual(['AA', 'AKo', 'AKs', 'KK', 'QQ']);
      expect(low.bluff).toContain('JJ');
    }
  });

  it('never changes an action — only which 4-bets call a jam', () => {
    for (const b of BUCKETS) {
      for (const hc of ALL_169) {
        expect(bucketChartAction(b, hc, 'low').action, `${b} ${hc}`).toBe(bucketChartAction(b, hc).action);
      }
    }
  });

  it('never promotes a bluff to value', () => {
    for (const b of BUCKETS) {
      for (const hc of ALL_169) {
        if (bucketChartAction(b, hc, 'low').kind === 'value') {
          expect(bucketChartAction(b, hc).kind, `${b} ${hc}`).toBe('value');
        }
      }
    }
  });

  it('leaves every chart without a cash 4-bet split as the source', () => {
    for (const b of BUCKETS) {
      if (!hasOpponentsRead(b)) expect(bucketChart(b, 'low')).toBe(BUCKET_CHART[b]);
    }
    expect(BUCKETS.filter(hasOpponentsRead)).toEqual([
      'btn4-cash-SB',
      'btn4-cash-BB',
      'open4-cash-LJ',
      'open4-cash-HJ',
      'open4-cash-CO',
    ]);
  });

  it('refuses a value hand it has no equity for', () => {
    const chart: FourBetChart = {
      fourBet: { value: new Set<HandClass>(['99']), bluff: new Set() },
      call: new Set(),
    };
    expect(() => lowStakesChart(chart, 37)).toThrow(/99/);
  });
});

describe('lowStakesNote', () => {
  it('explains a hand the low-stakes read folds, at the spot’s own price', () => {
    expect(lowStakesNote('btn4-cash-SB', 'SB', 'TT')).toBe('36% against a QQ+, AK jam; calling needs 37%');
    expect(lowStakesNote('open4-cash-HJ', 'CO', 'JJ')).toBe('36% against a QQ+, AK jam; calling needs 40%');
  });

  it('says nothing where the two reads agree', () => {
    expect(lowStakesNote('btn4-cash-SB', 'SB', 'QQ')).toBeNull();
    expect(lowStakesNote('btn4-cash-SB', 'SB', 'A5s')).toBeNull();
    expect(lowStakesNote('open4-cash-LJ', 'HJ', 'JJ')).toBeNull();
    expect(lowStakesNote('cashEarly', 'LJ', 'TT')).toBeNull();
  });
});
