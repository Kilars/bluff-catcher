/**
 * The cash charts against their vendored source (`research/cash-100-pto.json`),
 * cell for cell, plus the combo counts docs/PLAN-cash.md quotes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_169, combosForClass, type HandClass } from './hands';
import {
  CASH_RFI,
  CASH_SEATS,
  CASH_OPENERS,
  CASH_VS_CO,
  CASH_VS_EARLY,
  type CashOpener,
} from './cashRanges';
import { chartAction, facingComboCounts, type FacingChart } from './facing';

type SourceKey = string;
const SOURCE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../research/cash-100-pto.json'), 'utf8')
) as Record<SourceKey, Record<HandClass, number>>;

/** Hand classes the source marks 1 under `key`. Every cell must be 0 or 1. */
function sourceSet(key: SourceKey): Set<HandClass> {
  const row = SOURCE[key];
  expect(Object.keys(row).sort()).toEqual([...ALL_169].sort());
  const out = new Set<HandClass>();
  for (const [hc, v] of Object.entries(row)) {
    expect([0, 1]).toContain(v);
    if (v === 1) out.add(hc);
  }
  return out;
}

function combos(set: ReadonlySet<HandClass>): number {
  let n = 0;
  for (const hc of set) n += combosForClass(hc);
  return n;
}

const CHART_OF: Record<CashOpener, FacingChart> = {
  LJ: CASH_VS_EARLY,
  HJ: CASH_VS_EARLY,
  CO: CASH_VS_CO,
};

describe('cash RFI charts', () => {
  it('match the source for every seat', () => {
    for (const seat of CASH_SEATS) {
      expect([...CASH_RFI[seat]].sort(), seat).toEqual([...sourceSet(`Open${seat}`)].sort());
    }
  });

  it('only list real hand classes', () => {
    const valid = new Set(ALL_169);
    for (const seat of CASH_SEATS) for (const hc of CASH_RFI[seat]) expect(valid.has(hc), hc).toBe(true);
  });

  it('pin the combo counts', () => {
    expect(CASH_SEATS.map((s) => combos(CASH_RFI[s]))).toEqual([220, 282, 354, 554, 574]);
  });

  it('widen seat by seat, and the SB opens everything the BTN does', () => {
    for (let i = 1; i < CASH_SEATS.length; i++) {
      for (const hc of CASH_RFI[CASH_SEATS[i - 1]]) expect(CASH_RFI[CASH_SEATS[i]].has(hc), hc).toBe(true);
    }
  });
});

describe('cash BTN facing charts', () => {
  it('match the source for every opener, all 169 cells', () => {
    for (const opener of CASH_OPENERS) {
      const threeBet = sourceSet(`3BetBTNvs${opener}`);
      const call = sourceSet(`CallBTNvs${opener}`);
      for (const hc of ALL_169) {
        const want = threeBet.has(hc) ? '3bet' : call.has(hc) ? 'call' : 'fold';
        expect(chartAction(CHART_OF[opener], hc).action, `${opener} ${hc}`).toBe(want);
      }
    }
  });

  it('never list a class under two actions', () => {
    for (const chart of [CASH_VS_EARLY, CASH_VS_CO]) {
      for (const hc of chart.value) expect(chart.call.has(hc), hc).toBe(false);
      expect(chart.bluff.size).toBe(0);
    }
  });

  it('source vs LJ and vs HJ are the same chart', () => {
    expect([...sourceSet('3BetBTNvsLJ')].sort()).toEqual([...sourceSet('3BetBTNvsHJ')].sort());
    expect([...sourceSet('CallBTNvsLJ')].sort()).toEqual([...sourceSet('CallBTNvsHJ')].sort());
  });

  it('pin the combo counts', () => {
    expect(facingComboCounts(CASH_VS_EARLY)).toEqual({ value: 110, bluff: 0, call: 40, fold: 1176 });
    expect(facingComboCounts(CASH_VS_CO)).toEqual({ value: 178, bluff: 0, call: 40, fold: 1108 });
  });

  it('vs CO only adds 3-bets', () => {
    const added = ALL_169.filter(
      (hc) => chartAction(CASH_VS_CO, hc).action !== chartAction(CASH_VS_EARLY, hc).action
    );
    for (const hc of added) {
      expect(chartAction(CASH_VS_EARLY, hc).action, hc).toBe('fold');
      expect(chartAction(CASH_VS_CO, hc).action, hc).toBe('3bet');
    }
    expect(added.sort()).toEqual(
      ['54s', '76s', '87s', 'A7s', 'A6s', 'A3s', 'A2s', 'K9s', 'AJo', 'ATo', 'KJo'].sort()
    );
  });
});
