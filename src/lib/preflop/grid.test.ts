/**
 * Tests for the 13×13 grid orientation convention.
 *
 * This is the module two grid renderers share, so the tests are about the
 * contract rather than any one renderer: descending ranks, pairs on the
 * diagonal, suited above it, offsuit below it, and all 169 classes covered
 * exactly once.
 */

import { describe, it, expect } from 'vitest';
import { RANK_LABELS, cellClass } from './grid';
import { ALL_169 } from './hands';

describe('RANK_LABELS', () => {
  it('runs all thirteen ranks, ace first down to deuce', () => {
    expect([...RANK_LABELS]).toEqual([
      'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
    ]);
  });
});

describe('cellClass()', () => {
  it('puts pairs on the diagonal, suited above it, offsuit below it', () => {
    expect(cellClass(0, 0)).toBe('AA');
    expect(cellClass(1, 1)).toBe('KK');
    expect(cellClass(12, 12)).toBe('22');

    expect(cellClass(0, 1)).toBe('AKs');
    expect(cellClass(0, 12)).toBe('A2s');
    expect(cellClass(1, 2)).toBe('KQs');

    expect(cellClass(1, 0)).toBe('AKo');
    expect(cellClass(12, 0)).toBe('A2o');
    expect(cellClass(2, 1)).toBe('KQo');
  });

  it('names the high rank first on both sides of the diagonal', () => {
    // The same two ranks, mirrored — hi rank leads either way.
    expect(cellClass(4, 9)).toBe('T5s');
    expect(cellClass(9, 4)).toBe('T5o');
  });
});

describe('the full 13×13 sweep', () => {
  const all: string[] = [];
  for (let row = 0; row < 13; row += 1) {
    for (let col = 0; col < 13; col += 1) all.push(cellClass(row, col));
  }

  it('covers exactly the 169 canonical hand classes, once each', () => {
    expect(all).toHaveLength(169);
    expect([...all].sort()).toEqual([...ALL_169].sort());
  });

  it('emits 13 pairs, 78 suited and 78 offsuit', () => {
    expect(all.filter((h) => h.length === 2)).toHaveLength(13);
    expect(all.filter((h) => h.endsWith('s'))).toHaveLength(78);
    expect(all.filter((h) => h.endsWith('o'))).toHaveLength(78);
  });

  it('is suited above the diagonal and offsuit below it, at every cell', () => {
    for (let row = 0; row < 13; row += 1) {
      for (let col = 0; col < 13; col += 1) {
        const hc = cellClass(row, col);
        if (row === col) expect(hc).toHaveLength(2);
        else if (row < col) expect(hc.endsWith('s')).toBe(true);
        else expect(hc.endsWith('o')).toBe(true);
      }
    }
  });
});
