/**
 * Migration gate (docs/PLAN-range-generator.md, phase 1): `range(spot)` must
 * reproduce every hand-copied chart exactly before the drills move onto it.
 * Deleted with the hand-copied files in phase 3.
 */

import { describe, expect, it } from 'vitest';
import type { HandClass } from './hands';
import type { FacingChart } from './facing';
import { CASH_RFI, CASH_SEATS, CASH_VS_CO, CASH_VS_EARLY } from './cashRanges';
import { BB_CASH_CHARTS, BB_CASH_OPENERS, BB_MTT_CHARTS, BB_MTT_OPENERS } from './bbDefendRanges';
import { BTN4_CASH_CHARTS, BTN4_MTT_CHARTS, BTN4_OPEN, BTN4_THREE_BETTORS } from './btn4BetRanges';
import { OPEN4_CASH_CHARTS, OPEN4_OPENERS, OPEN4_THREE_BETTORS } from './open4BetRanges';
import { FACING_SOURCES } from './facingSources';
import { OPENERS } from './facing';
import { requireFacingRange, requireOpenRange } from './range';

const sorted = (s: ReadonlySet<HandClass>) => [...s].sort();

/** A chart as plain sorted arrays, so shape and contents compare in one go. */
function plain(chart: FacingChart): unknown {
  return Object.fromEntries(
    Object.entries(chart).map(([k, v]) => [
      k,
      v instanceof Set ? sorted(v) : Object.fromEntries(Object.entries(v).map(([k2, s]) => [k2, sorted(s as Set<HandClass>)])),
    ])
  );
}

describe('range(spot) reproduces the hand-copied charts', () => {
  it('cash RFI', () => {
    for (const seat of CASH_SEATS) {
      expect(sorted(requireOpenRange({ format: 'cash', stack: '100bb', hero: seat })), seat).toEqual(sorted(CASH_RFI[seat]));
    }
  });

  it('BTN vs open (tournament, PokerCoaching)', () => {
    for (const o of OPENERS) {
      expect(plain(requireFacingRange({ format: 'mtt', stack: '50bb+', node: 'vsOpen', hero: 'BTN', villain: o })), o).toEqual(
        plain(FACING_SOURCES[o])
      );
    }
  });

  it('BTN vs open (cash)', () => {
    const spot = (villain: 'LJ' | 'HJ' | 'CO') =>
      plain(requireFacingRange({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'BTN', villain }));
    expect(spot('LJ')).toEqual(plain(CASH_VS_EARLY));
    expect(spot('HJ')).toEqual(plain(CASH_VS_EARLY));
    expect(spot('CO')).toEqual(plain(CASH_VS_CO));
  });

  it('BB defend', () => {
    for (const o of BB_MTT_OPENERS) {
      expect(plain(requireFacingRange({ format: 'mtt', stack: '40bb', node: 'vsOpen', hero: 'BB', villain: o })), o).toEqual(
        plain(BB_MTT_CHARTS[o])
      );
    }
    for (const o of BB_CASH_OPENERS) {
      expect(plain(requireFacingRange({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'BB', villain: o })), o).toEqual(
        plain(BB_CASH_CHARTS[o])
      );
    }
  });

  it('BTN vs 3-bet', () => {
    for (const seat of BTN4_THREE_BETTORS) {
      expect(plain(requireFacingRange({ format: 'cash', stack: '100bb', node: 'vs3bet', hero: 'BTN', villain: seat }))).toEqual(
        plain(BTN4_CASH_CHARTS[seat])
      );
      expect(plain(requireFacingRange({ format: 'mtt', stack: '40bb', node: 'vs3bet', hero: 'BTN', villain: seat }))).toEqual(
        plain(BTN4_MTT_CHARTS[seat])
      );
    }
    expect(sorted(requireOpenRange({ format: 'mtt', stack: '40bb', hero: 'BTN' }))).toEqual(sorted(BTN4_OPEN.mtt));
  });

  it('open vs 3-bet, against every 3-bettor', () => {
    for (const opener of OPEN4_OPENERS) {
      for (const t of OPEN4_THREE_BETTORS[opener]) {
        expect(
          plain(requireFacingRange({ format: 'cash', stack: '100bb', node: 'vs3bet', hero: opener, villain: t })),
          `${opener} vs ${t}`
        ).toEqual(plain(OPEN4_CASH_CHARTS[opener]));
      }
    }
  });
});
