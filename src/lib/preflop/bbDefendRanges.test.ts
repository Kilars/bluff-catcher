/**
 * The BB defence charts against their vendored source
 * (`research/bb-defend-pto.json`), cell for cell, plus the combo counts
 * docs/PLAN-bb-defend.md quotes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_169, type HandClass } from './hands';
import {
  BB_CASH_CHARTS,
  BB_CASH_OPENERS,
  BB_MTT_CHARTS,
  BB_MTT_OPENERS,
} from './bbDefendRanges';
import { chartAction, facingComboCounts, type PlainChart } from './facing';

type Row = Record<HandClass, number>;
const SOURCE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../research/bb-defend-pto.json'), 'utf8')
) as { mtt40: Record<string, Row>; cash100: Record<string, Row> };

/** Our seat names → the source's (9-max early seats are EP1–EP3 there). */
const SOURCE_SEAT: Record<string, string> = { UTG: 'EP1', UTG1: 'EP2', UTG2: 'EP3' };

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

const FORMATS = [
  { name: 'tournament 40bb', section: SOURCE.mtt40, openers: BB_MTT_OPENERS, charts: BB_MTT_CHARTS as Record<string, PlainChart> },
  { name: 'cash 100bb', section: SOURCE.cash100, openers: BB_CASH_OPENERS, charts: BB_CASH_CHARTS as Record<string, PlainChart> },
] as const;

describe.each(FORMATS)('BB defence charts, $name', ({ section, openers, charts }) => {
  it('match the source for every opener, all 169 cells', () => {
    for (const opener of openers) {
      const seat = SOURCE_SEAT[opener] ?? opener;
      const threeBet = sourceSet(section[`3BetBBvs${seat}`]);
      const call = sourceSet(section[`CallBBvs${seat}`]);
      for (const hc of ALL_169) {
        const want = threeBet.has(hc) ? '3bet' : call.has(hc) ? 'call' : 'fold';
        expect(chartAction(charts[opener], hc).action, `${opener} ${hc}`).toBe(want);
      }
    }
  });

  it('never list a class under two actions, and only real classes', () => {
    const valid = new Set(ALL_169);
    for (const opener of openers) {
      const { threeBet, call } = charts[opener];
      for (const hc of threeBet) {
        expect(call.has(hc), `${opener} ${hc}`).toBe(false);
        expect(valid.has(hc), hc).toBe(true);
      }
      for (const hc of call) expect(valid.has(hc), hc).toBe(true);
    }
  });

  it('3-bet AA against every opener', () => {
    for (const opener of openers) expect(chartAction(charts[opener], 'AA').action, opener).toBe('3bet');
  });
});

describe('BB defence combo counts', () => {
  const counts = (charts: Record<string, PlainChart>, openers: readonly string[]) =>
    openers.map((o) => {
      const c = facingComboCounts(charts[o]);
      return [o, 'threeBet' in c ? c.threeBet : NaN, c.call];
    });

  it('tournament 40bb: defence widens from UTG to BTN, SB is its own shape', () => {
    expect(counts(BB_MTT_CHARTS, BB_MTT_OPENERS)).toEqual([
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
    expect(counts(BB_CASH_CHARTS, BB_CASH_OPENERS)).toEqual([
      ['LJ', 86, 204],
      ['HJ', 86, 256],
      ['CO', 118, 288],
      ['BTN', 188, 342],
      ['SB', 236, 458],
    ]);
  });

  it('the tournament SB never limps at 40bb, so vs SB is facing a raise', () => {
    expect(sourceSet(SOURCE.mtt40.LimpSB).size).toBe(0);
  });
});
