/**
 * browserAxes — the chart browser's rows: fixed per format, greyed by what's
 * picked above, and every pick repaired to a chart that exists.
 */

import { describe, it, expect } from 'vitest';
import {
  STACKS,
  enabled,
  initialAxes,
  pairPagesOf,
  nodeOf,
  pick,
  rowTabs,
  setIdOf,
  step,
  type Axes,
  type SpotKind,
} from './browserAxes';
import { pairPageId } from './pairCharts';

const start = (format: 'mtt' | 'cash' = 'mtt') => initialAxes({ format, depth: format === 'cash' ? 'cash' : 'deep', drill: false });
const on = (a: Axes, row: Parameters<typeof enabled>[1]) => [...enabled(a, row)];
const picks = (a: Axes, ...steps: [Parameters<typeof pick>[1], string][]) => steps.reduce((x, [r, id]) => pick(x, r, id), a);

describe('browserAxes rows', () => {
  it('keeps one table for You and vs, nine seats in a tournament and six in cash', () => {
    expect(rowTabs('mtt', 'seat')).toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(rowTabs('mtt', 'versus')).toEqual(rowTabs('mtt', 'seat'));
    expect(rowTabs('cash', 'seat')).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(rowTabs('mtt', 'stack')).toEqual(STACKS);
    expect(rowTabs('cash', 'stack')).toEqual([]);
  });

  it('greys versus on Open, and the seats that never open', () => {
    const a = start();
    expect(on(a, 'stack')).toEqual(['60bb+', '20bb', '10bb']);
    expect(on(a, 'seat')).toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN']);
    expect(on(a, 'versus')).toEqual([]);
    expect(on(start('cash'), 'seat')).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB']);
  });

  it('offers the openers before you on 3-bet and the 3-bettors after you on 4-bet', () => {
    const co3 = picks(start(), ['spot', '3bet'], ['seat', 'CO']);
    expect(on(co3, 'versus')).toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']);
    // The raiser carries over while it still applies.
    expect(co3.villain).toBe('UTG');
    expect(pick(pick(start(), 'seat', 'CO'), 'spot', '3bet').villain).toBe('HJ');
    const co4 = pick(co3, 'spot', '4bet');
    expect(on(co4, 'versus')).toEqual(['BTN', 'SB', 'BB']);
    expect(co4.villain).toBe('BTN');
    expect(on(co4, 'stack')).toEqual(['40bb']);
  });

  it('moves you to the BTN on 50bb+, and keeps 50bb+ for 3-bet across a trip to 4-bet', () => {
    const a = picks(start(), ['spot', '3bet'], ['seat', 'CO'], ['stack', '50bb+']);
    expect(on(a, 'seat')).toEqual(['BTN']);
    expect(a.hero).toBe('BTN');
    const back = picks(a, ['spot', '4bet'], ['spot', '3bet']);
    expect(back.stacks['3bet']).toBe('50bb+');
    expect(setIdOf(back)).toBe('mtt50');
  });

  it('ignores a greyed pick', () => {
    const a = start();
    expect(pick(a, 'spot', 'drill')).toBe(a);
    expect(pick(a, 'versus', 'UTG')).toBe(a);
    expect(pick(a, 'seat', 'BB')).toBe(a);
  });

  it('folds the early 9-max seats into the LJ on cash, and keeps the rest', () => {
    expect(picks(start(), ['seat', 'UTG1'], ['format', 'cash']).hero).toBe('LJ');
    expect(picks(start(), ['seat', 'CO'], ['format', 'cash']).hero).toBe('CO');
  });

  it('starts the facing spots on the first pair when nothing is dealt', () => {
    const mtt = pick(start(), 'spot', '3bet');
    expect([mtt.hero, mtt.villain]).toEqual(['UTG1', 'UTG']);
    const cash = pick(start('cash'), 'spot', '3bet');
    expect([cash.hero, cash.villain]).toEqual(['HJ', 'LJ']);
  });

  it('starts on the dealt pair and its stack', () => {
    const a = initialAxes({
      format: 'mtt',
      depth: 'deep',
      drill: true,
      spot: { node: 'vsOpen', setId: 'mtt50', hero: 'BTN', villain: 'CO' },
    });
    expect(a.spot).toBe('drill');
    expect(pick(a, 'spot', '3bet')).toMatchObject({ hero: 'BTN', villain: 'CO', stacks: { '3bet': '50bb+' } });
  });

  it('steps through the raisers, then on to the next seat', () => {
    const a = picks(start(), ['spot', '3bet'], ['seat', 'UTG2'], ['versus', 'UTG1']);
    expect(step(a, 1)).toMatchObject({ hero: 'LJ', villain: 'UTG' });
    expect(step(a, -1)).toMatchObject({ hero: 'UTG2', villain: 'UTG' });
    expect(step(pick(start(), 'seat', 'CO'), 1).hero).toBe('BTN');
  });

  it('lands on a real chart for every pick the rows allow', () => {
    for (const format of ['mtt', 'cash'] as const) {
      for (const spot of ['3bet', '4bet'] as SpotKind[]) {
        let a = pick(start(format), 'spot', spot);
        for (const stack of enabled(a, 'stack')) {
          a = pick(a, 'stack', stack);
          for (const hero of enabled(a, 'seat')) {
            const h = pick(a, 'seat', hero);
            const node = nodeOf(h.spot)!;
            const ids = new Set(pairPagesOf(setIdOf(h)!, node).map((p) => p.id));
            expect(h.villain).not.toBeNull();
            for (const villain of enabled(h, 'versus')) {
              expect(ids.has(pairPageId(setIdOf(h)!, node, h.hero, villain as never))).toBe(true);
            }
          }
        }
      }
    }
  });
});
