import { describe, expect, it } from 'vitest';
import { ALL_169, combosForClass, type HandClass } from './hands';
import { chartAction, facingComboCounts } from './facing';
import { facingRange, openRange, requireFacingRange, requireOpenRange } from './range';
import { CHARTS, HAND_ORDER, SOURCES } from './rangeData';

const combos = (s: ReadonlySet<HandClass>) => [...s].reduce((n, hc) => n + combosForClass(hc), 0);

describe('rangeData', () => {
  it('stores hands in the app’s own 169 order', () => {
    expect(HAND_ORDER.split(' ')).toEqual([...ALL_169]);
  });

  it('every chart is 169 0/1 characters and every key points at one', () => {
    for (const c of CHARTS) expect(c).toMatch(/^[01]{169}$/);
    for (const keys of Object.values(SOURCES)) {
      for (const i of Object.values(keys)) expect(CHARTS[i]).toBeDefined();
    }
  });

  it('stores each distinct chart once', () => {
    expect(new Set(CHARTS).size).toBe(CHARTS.length);
  });
});

describe('openRange', () => {
  it('maps our early seats onto the source’s EP1–EP3', () => {
    // MTT 40bb opens, per the source: EP1 202, EP2 228, EP3 260 combos.
    expect(combos(requireOpenRange({ format: 'mtt', stack: '40bb', hero: 'UTG' }))).toBe(202);
    expect(combos(requireOpenRange({ format: 'mtt', stack: '40bb', hero: 'UTG1' }))).toBe(228);
    expect(combos(requireOpenRange({ format: 'mtt', stack: '40bb', hero: 'UTG2' }))).toBe(260);
  });

  it('returns the same set on every call', () => {
    const spot = { format: 'cash', stack: '100bb', hero: 'CO' } as const;
    expect(openRange(spot)).toBe(openRange(spot));
  });

  it('is null where no source covers the spot', () => {
    expect(openRange({ format: 'cash', stack: '40bb', hero: 'CO' })).toBeNull();
    expect(openRange({ format: 'mtt', stack: '50bb+', hero: 'CO' })).toBeNull();
    expect(openRange({ format: 'cash', stack: '100bb', hero: 'BB' })).toBeNull();
  });
});

describe('facingRange', () => {
  it('reads any seat pair the source has: cash CO 3-bets a HJ open', () => {
    const chart = requireFacingRange({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'CO', villain: 'HJ' });
    expect(chartAction(chart, 'AA').action).toBe('3bet');
    expect(chartAction(chart, '72o').action).toBe('fold');
    expect('threeBet' in chart).toBe(true); // PTO: no value/bluff kind
  });

  it('only the PokerCoaching source splits 3-bets into value and bluff', () => {
    const pc = requireFacingRange({ format: 'mtt', stack: '50bb+', node: 'vsOpen', hero: 'BTN', villain: 'LJ' });
    expect(chartAction(pc, 'A5s')).toEqual({ action: '3bet', kind: 'bluff' });
    const pto = requireFacingRange({ format: 'mtt', stack: '40bb', node: 'vsOpen', hero: 'BTN', villain: 'LJ' });
    for (const hc of ALL_169) expect(chartAction(pto, hc).kind).toBeUndefined();
  });

  it('splits a cash 4-bet by the 5-bet jam: calls are value, folds are bluffs', () => {
    const chart = requireFacingRange({ format: 'cash', stack: '100bb', node: 'vs3bet', hero: 'BTN', villain: 'BB' });
    expect(chartAction(chart, 'AA')).toEqual({ action: '4bet', kind: 'value' });
    expect(chartAction(chart, 'A5s')).toEqual({ action: '4bet', kind: 'bluff' });
  });

  it('leaves the 40bb 4-bet plain: it is the jam', () => {
    const chart = requireFacingRange({ format: 'mtt', stack: '40bb', node: 'vs3bet', hero: 'BTN', villain: 'SB' });
    expect(facingComboCounts(chart)).toEqual({ fourBet: 90, call: 194, fold: 1042 });
  });

  it('is null for spots the source does not have', () => {
    // No villain, an open node, no source at the stack, a pair the grid lacks.
    expect(facingRange({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'BTN' })).toBeNull();
    expect(facingRange({ format: 'cash', stack: '100bb', node: 'open', hero: 'BTN', villain: 'CO' })).toBeNull();
    expect(facingRange({ format: 'cash', stack: '50bb+', node: 'vsOpen', hero: 'BTN', villain: 'CO' })).toBeNull();
    expect(facingRange({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'CO', villain: 'BTN' })).toBeNull();
    expect(facingRange({ format: 'mtt', stack: '50bb+', node: 'vsOpen', hero: 'BB', villain: 'CO' })).toBeNull();
  });

  it('the require* forms throw on a missing spot', () => {
    expect(() => requireFacingRange({ format: 'cash', stack: '100bb', node: 'vsOpen', hero: 'CO', villain: 'BTN' })).toThrow();
    expect(() => requireOpenRange({ format: 'cash', stack: '40bb', hero: 'CO' })).toThrow();
  });
});
