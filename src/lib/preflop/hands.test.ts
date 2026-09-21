/**
 * Tests for the 169 hand-class model.
 *
 * `handClass` is a pure normaliser, so it is driven from one table rather than
 * a paragraph of one-assertion cases: the rows are what varies, and a row that
 * fails names itself.
 */

import { describe, it, expect } from 'vitest';
import {
  handClass,
  parseHandClass,
  ALL_169,
  HAND_STRENGTH_RANKING,
  strengthRank,
  expandCombos,
  combosForClass,
  type HandClass,
} from './hands';
import type { Card } from '../odds';

describe('handClass()', () => {
  // Both card orders per row: the normaliser must not care which came first.
  const cases: [Card, Card, HandClass][] = [
    ['As', 'Ah', 'AA'],
    ['Kd', 'Kc', 'KK'],
    ['Ts', 'Th', 'TT'],
    ['2s', '2c', '22'],
    ['As', 'Ks', 'AKs'],
    ['Ah', 'Th', 'ATs'],
    ['Js', 'Ts', 'JTs'],
    ['9s', '8s', '98s'],
    ['7d', '2d', '72s'],
    ['5c', '4c', '54s'],
    ['As', 'Kh', 'AKo'],
    ['Ad', 'Th', 'ATo'],
    ['Kd', 'Qs', 'KQo'],
    ['Jc', 'Th', 'JTo'],
    ['9h', '8d', '98o'],
    ['7s', '2h', '72o'],
    ['5d', '4h', '54o'],
    // Chart boundaries: CO opens K7s and folds K6s, UTG opens AJo and folds
    // ATo, so these four classes have to come out exactly right.
    ['Ks', '7s', 'K7s'],
    ['Kh', '6h', 'K6s'],
    ['Ah', 'Jd', 'AJo'],
  ];

  for (const [a, b, expected] of cases) {
    it(`${a} + ${b} → ${expected}, either way round`, () => {
      expect(handClass(a, b)).toBe(expected);
      expect(handClass(b, a)).toBe(expected);
    });
  }
});

describe('parseHandClass()', () => {
  it('splits each family into hi rank, lo rank and type', () => {
    expect(parseHandClass('AA')).toMatchObject({ hiRank: 'A', loRank: 'A', type: 'pair' });
    expect(parseHandClass('AKs')).toMatchObject({ hiRank: 'A', loRank: 'K', type: 'suited' });
    expect(parseHandClass('72o')).toMatchObject({ hiRank: '7', loRank: '2', type: 'offsuit' });
  });
});

describe('ALL_169', () => {
  it('is 169 distinct classes: 13 pairs, 78 suited, 78 offsuit', () => {
    expect(new Set(ALL_169).size).toBe(169);
    expect(ALL_169.filter((hc) => hc.length === 2)).toHaveLength(13);
    expect(ALL_169.filter((hc) => hc.endsWith('s'))).toHaveLength(78);
    expect(ALL_169.filter((hc) => hc.endsWith('o'))).toHaveLength(78);
  });

  it('includes every pocket pair', () => {
    const pairs = new Set<string>(ALL_169);
    for (const rank of '23456789TJQKA') expect(pairs.has(rank + rank)).toBe(true);
  });

  it('accounts for all 1326 combos in the deck', () => {
    // 13×6 + 78×4 + 78×12. A class with the wrong combo weight would leave the
    // range widths in ranges.test.ts subtly wrong and nothing else would say so.
    expect(ALL_169.reduce((sum, hc) => sum + combosForClass(hc), 0)).toBe(1326);
  });
});

describe('HAND_STRENGTH_RANKING', () => {
  it('is a total ordering over exactly the 169 classes', () => {
    expect(HAND_STRENGTH_RANKING).toHaveLength(169);
    expect(new Set(HAND_STRENGTH_RANKING).size).toBe(169);
    expect([...HAND_STRENGTH_RANKING].sort()).toEqual([...ALL_169].sort());
  });

  it.each([
    ['AA', 'KK'],
    ['KK', 'QQ'],
    ['AKs', 'AKo'],
    ['AKo', 'AQo'],
    ['AKs', 'KQs'],
    ['JTs', '54s'],
  ])('ranks %s above %s', (stronger, weaker) => {
    expect(strengthRank(stronger)).toBeLessThan(strengthRank(weaker));
  });

  it('puts AA at the top and the offsuit trash at the bottom', () => {
    expect(HAND_STRENGTH_RANKING[0]).toBe('AA');
    expect(strengthRank('32o')).toBeGreaterThan(150);
    expect(strengthRank('72o')).toBeGreaterThan(140);
  });
});

describe('expandCombos()', () => {
  it.each([
    ['AA', 6, 'differ'],
    ['AKs', 4, 'match'],
    ['AKo', 12, 'differ'],
  ] as const)('%s expands to %i combos whose suits %s', (hc, count, suits) => {
    const combos = expandCombos(hc);
    expect(combos).toHaveLength(count);
    expect(new Set(combos.map(([a, b]) => `${a}${b}`)).size).toBe(count);
    for (const [a, b] of combos) {
      if (suits === 'match') expect(a[1]).toBe(b[1]);
      else expect(a[1]).not.toBe(b[1]);
      // And every combo still normalises back to the class it came from.
      expect(handClass(a, b)).toBe(hc);
    }
  });
});
