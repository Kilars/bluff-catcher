/**
 * The chart browser's seat-pair pages: every pair the source has, each the
 * pair's own chart, with reused charts named in the footnote.
 */

import { describe, expect, it } from 'vitest';
import { PAIR_SETS, pairChartPages, pairPageId } from './pairCharts';
import { facingRange } from './range';
import { chartAction, dealtRange } from './facing';
import { ALL_169 } from './hands';

describe('pairChartPages', () => {
  it('lists every seat pair of the table each source covers', () => {
    // Cash is 6-max (LJ…BB): 15 pairs per decision. The 40bb grid is 9-max: 36.
    expect(pairChartPages('cash100', 'vsOpen')).toHaveLength(15);
    expect(pairChartPages('cash100', 'vs3bet')).toHaveLength(15);
    expect(pairChartPages('mtt40', 'vsOpen')).toHaveLength(36);
    expect(pairChartPages('mtt40', 'vs3bet')).toHaveLength(36);
    expect(pairChartPages('mtt50', 'vsOpen').map((p) => p.group)).toEqual(Array(6).fill('BTN'));
    expect(pairChartPages('mtt50', 'vs3bet')).toEqual([]);
  });

  it('colours each page from its own pair chart, dimming the hands it never deals', () => {
    for (const set of PAIR_SETS) {
      for (const node of set.nodes) {
        for (const page of pairChartPages(set.id, node)) {
          const [, , hero, villain] = page.id.split('-') as never[];
          const chart = facingRange({ format: set.format, stack: set.stack, node, hero, villain })!;
          const dealt = dealtRange(set.format, set.stack, node, hero, chart);
          for (const hc of ALL_169) {
            const { action } = chartAction(chart, hc);
            const cell = page.cellAction(hc);
            if (dealt && !dealt.has(hc)) {
              expect(cell, `${page.id} ${hc}`).toBe('none');
              // A hand the spot never deals must be one the chart folds.
              expect(action, `${page.id} ${hc} continues but is never dealt`).toBe('fold');
            }
            else if (action === 'fold' || action === 'call') expect(cell, `${page.id} ${hc}`).toBe(action);
            else expect(['fold', 'call', 'none'], `${page.id} ${hc}`).not.toContain(cell);
          }
        }
      }
    }
  });

  it("dims a 3-bet pot's hands hero did not open, and leaves the BB's defence whole", () => {
    const co = pairChartPages('cash100', 'vs3bet').find((p) => p.id === pairPageId('cash100', 'vs3bet', 'CO', 'BTN'))!;
    expect(co.cellAction('72o')).toBe('none');
    expect(co.cellAction('AA')).not.toBe('none');
    const bb = pairChartPages('cash100', 'vsOpen').filter((p) => p.group === 'BB');
    expect(bb.every((p) => ALL_169.every((hc) => p.cellAction(hc) !== 'none'))).toBe(true);
  });

  it('separates the 40bb 4-bet charts by who 3-bets', () => {
    const co = pairChartPages('mtt40', 'vs3bet').filter((p) => p.group === 'CO');
    expect(co.map((p) => p.tab)).toEqual(['BTN', 'SB', 'BB']);
    expect(co.every((p) => p.footnote === undefined)).toBe(true);
  });

  it('names the pairs a cash chart is shared with', () => {
    const page = pairChartPages('cash100', 'vs3bet').find((p) => p.id === pairPageId('cash100', 'vs3bet', 'CO', 'BTN'))!;
    expect(page.title).toBe('CO opens, BTN 3-bets');
    expect(page.footnote).toBe('The source uses this same chart for CO vs SB 3-bet, CO vs BB 3-bet.');
  });
});
