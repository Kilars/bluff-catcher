/**
 * The BTN vs 3-bet charts against their vendored source
 * (`research/btn-4bet-pto.json`), cell for cell, plus the combo counts and
 * the value/bluff split docs/PLAN-btn-4bet.md quotes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_169, combosForClass, type HandClass } from './hands';
import {
  BTN4_CASH_CHARTS,
  BTN4_MTT_CHARTS,
  BTN4_OPEN,
  BTN4_THREE_BETTORS,
} from './btn4BetRanges';
import { chartAction, facingComboCounts, type FourBetChart } from './facing';

type Row = Record<HandClass, number>;
const SOURCE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../research/btn-4bet-pto.json'), 'utf8')
) as { mtt40: Record<string, Row>; cash100: Record<string, Row> };

/** Hand classes the source marks 1 in `row`. Every cell must be 0 or 1. */
function sourceSet(row: Row): Set<HandClass> {
  expect(Object.keys(row).sort()).toEqual([...ALL_169].sort());
  const out = new Set<HandClass>();
  for (const [hc, v] of Object.entries(row)) {
    expect([0, 1]).toContain(v);
    if (v === 1) out.add(hc);
  }
  return out;
}

const combos = (s: Iterable<HandClass>) => [...s].reduce((n, hc) => n + combosForClass(hc), 0);

const FORMATS = [
  { name: 'cash 100bb', format: 'cash', section: SOURCE.cash100, charts: BTN4_CASH_CHARTS },
  { name: 'tournament 40bb', format: 'mtt', section: SOURCE.mtt40, charts: BTN4_MTT_CHARTS },
] as const;

describe.each(FORMATS)('BTN vs 3-bet charts, $name', ({ format, section, charts }) => {
  it('match the source for both 3-bettors, all 169 cells', () => {
    for (const seat of BTN4_THREE_BETTORS) {
      const fourBet = sourceSet(section[`4BetBTNvs${seat}`]);
      const call = sourceSet(section[`Call 3BetBTNvs${seat}`]);
      for (const hc of ALL_169) {
        const want = fourBet.has(hc) ? '4bet' : call.has(hc) ? 'call' : 'fold';
        expect(chartAction(charts[seat], hc).action, `${seat} ${hc}`).toBe(want);
      }
    }
  });

  it('only continue with hands the BTN opens, and deal from the source open range', () => {
    const open = sourceSet(section.OpenBTN);
    expect([...BTN4_OPEN[format]].sort()).toEqual([...open].sort());
    for (const seat of BTN4_THREE_BETTORS) {
      for (const hc of ALL_169) {
        if (chartAction(charts[seat], hc).action !== 'fold') expect(open.has(hc), `${seat} ${hc}`).toBe(true);
      }
    }
  });

  it('never list a class under two actions', () => {
    for (const seat of BTN4_THREE_BETTORS) {
      const { fourBet, call } = charts[seat] as FourBetChart;
      const raises = 'value' in fourBet ? [...fourBet.value, ...fourBet.bluff] : [...fourBet];
      expect(new Set(raises).size, seat).toBe(raises.length);
      for (const hc of raises) expect(call.has(hc), `${seat} ${hc}`).toBe(false);
    }
  });
});

describe('BTN vs 3-bet value and bluff (cash)', () => {
  it('value is exactly the 4-bets that call a 5-bet jam; bluffs fold to it', () => {
    for (const seat of BTN4_THREE_BETTORS) {
      const fourBet = sourceSet(SOURCE.cash100[`4BetBTNvs${seat}`]);
      const callsJam = sourceSet(SOURCE.cash100[`Call 5BetBTNvs${seat}`]);
      for (const hc of fourBet) {
        expect(chartAction(BTN4_CASH_CHARTS[seat], hc).kind, `${seat} ${hc}`).toBe(
          callsJam.has(hc) ? 'value' : 'bluff'
        );
      }
    }
  });

  it('bluffs are A5s, AQo, AJo and KQo', () => {
    const bluffs = ALL_169.filter((hc) => chartAction(BTN4_CASH_CHARTS.SB, hc).kind === 'bluff');
    expect(bluffs.sort()).toEqual(['A5s', 'AJo', 'AQo', 'KQo']);
  });

  it('the source uses one chart vs SB and vs BB', () => {
    for (const key of ['4BetBTNvs', 'Call 3BetBTNvs', 'Call 5BetBTNvs']) {
      expect(SOURCE.cash100[`${key}SB`]).toEqual(SOURCE.cash100[`${key}BB`]);
    }
  });

  it('40bb charts carry no kind: the 4-bet is the jam', () => {
    for (const seat of BTN4_THREE_BETTORS) {
      expect('value' in BTN4_MTT_CHARTS[seat].fourBet, seat).toBe(false);
      for (const hc of ALL_169) expect(chartAction(BTN4_MTT_CHARTS[seat], hc).kind).toBeUndefined();
    }
  });
});

describe('BTN vs 3-bet combo counts', () => {
  it('cash: value 50 / bluff 40 / call 68 of 554 opened, vs either blind', () => {
    expect(combos(BTN4_OPEN.cash)).toBe(554);
    for (const seat of BTN4_THREE_BETTORS) {
      expect(facingComboCounts(BTN4_CASH_CHARTS[seat])).toEqual({ value: 50, bluff: 40, call: 68, fold: 1168 });
    }
  });

  it('40bb: 4-bet 90 / call 194 vs SB, 70 / 274 vs BB, of 664 opened', () => {
    expect(combos(BTN4_OPEN.mtt)).toBe(664);
    expect(facingComboCounts(BTN4_MTT_CHARTS.SB)).toEqual({ fourBet: 90, call: 194, fold: 1042 });
    expect(facingComboCounts(BTN4_MTT_CHARTS.BB)).toEqual({ fourBet: 70, call: 274, fold: 982 });
  });

  it('40bb: AA and KK flat rather than jam, vs either blind', () => {
    for (const seat of BTN4_THREE_BETTORS) {
      expect(chartAction(BTN4_MTT_CHARTS[seat], 'AA').action, seat).toBe('call');
      expect(chartAction(BTN4_MTT_CHARTS[seat], 'KK').action, seat).toBe('call');
    }
  });
});
