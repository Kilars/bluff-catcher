/**
 * The open-vs-3-bet charts against their vendored source
 * (`research/open-4bet-pto.json`), cell for cell, for every 3-bettor — which
 * also pins that the source uses one chart per opener — plus the value/bluff
 * split and the combo counts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_169, type HandClass } from './hands';
import { OPEN4_CASH_CHARTS, OPEN4_OPENERS, OPEN4_THREE_BETTORS } from './open4BetRanges';
import { CASH_RFI } from './cashRanges';
import { chartAction, facingComboCounts } from './facing';

type Row = Record<HandClass, number>;
const SOURCE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../research/open-4bet-pto.json'), 'utf8')
) as Record<string, Row>;

function sourceSet(row: Row): Set<HandClass> {
  expect(Object.keys(row).sort()).toEqual([...ALL_169].sort());
  const out = new Set<HandClass>();
  for (const [hc, v] of Object.entries(row)) {
    expect([0, 1]).toContain(v);
    if (v === 1) out.add(hc);
  }
  return out;
}

describe.each(OPEN4_OPENERS)('%s open vs 3-bet (cash)', (opener) => {
  const chart = OPEN4_CASH_CHARTS[opener];

  it('matches the source against every 3-bettor, all 169 cells, value/bluff included', () => {
    for (const seat of OPEN4_THREE_BETTORS[opener]) {
      const fourBet = sourceSet(SOURCE[`4Bet${opener}vs${seat}`]);
      const call = sourceSet(SOURCE[`Call 3Bet${opener}vs${seat}`]);
      const callsJam = sourceSet(SOURCE[`Call 5Bet${opener}vs${seat}`]);
      for (const hc of ALL_169) {
        const want = fourBet.has(hc)
          ? { action: '4bet', kind: callsJam.has(hc) ? 'value' : 'bluff' }
          : { action: call.has(hc) ? 'call' : 'fold' };
        expect(chartAction(chart, hc), `${seat} ${hc}`).toEqual(want);
      }
    }
  });

  it('only continues with hands the seat opens', () => {
    for (const hc of ALL_169) {
      if (chartAction(chart, hc).action !== 'fold') expect(CASH_RFI[opener].has(hc), hc).toBe(true);
    }
  });
});

describe('open vs 3-bet combo counts', () => {
  it('LJ 34/18/40, HJ 40/12/46, CO 40/24/46 (value / bluff / call)', () => {
    expect(facingComboCounts(OPEN4_CASH_CHARTS.LJ)).toEqual({ value: 34, bluff: 18, call: 40, fold: 1234 });
    expect(facingComboCounts(OPEN4_CASH_CHARTS.HJ)).toEqual({ value: 40, bluff: 12, call: 46, fold: 1228 });
    expect(facingComboCounts(OPEN4_CASH_CHARTS.CO)).toEqual({ value: 40, bluff: 24, call: 46, fold: 1216 });
  });

  it('JJ is a value 4-bet from HJ and CO, a bluff from the LJ', () => {
    expect(chartAction(OPEN4_CASH_CHARTS.LJ, 'JJ').kind).toBe('bluff');
    expect(chartAction(OPEN4_CASH_CHARTS.HJ, 'JJ').kind).toBe('value');
    expect(chartAction(OPEN4_CASH_CHARTS.CO, 'JJ').kind).toBe('value');
  });
});
