/**
 * The ten verified poker draw spots for testing.
 * Each fixture includes the hero hand, board, category, hits predicate (or backdoor mode),
 * and expected outs/total percentage.
 */

import {
  type Card,
  type Spot,
  hasFlush,
  hasStraight,
  pairsUp,
} from './odds';

export interface Fixture {
  id: string;
  hero: Card[];
  board: Card[];
  category: string;
  spot: Spot;
  expected: {
    outs: number;
    total: number;
  };
}

export const fixtures: Fixture[] = [
  {
    id: 'flushDraw',
    hero: ['As', '7s'],
    board: ['Ks', '4s', '9d'],
    category: 'flushDraw',
    spot: {
      hero: ['As', '7s'],
      board: ['Ks', '4s', '9d'],
      hits: (cs) => hasFlush(cs),
    },
    expected: { outs: 9, total: 35.0 },
  },
  {
    id: 'openEnder',
    hero: ['9h', '8c'],
    board: ['7d', '6s', 'Kc'],
    category: 'openEnder',
    spot: {
      hero: ['9h', '8c'],
      board: ['7d', '6s', 'Kc'],
      hits: (cs) => hasStraight(cs),
    },
    expected: { outs: 8, total: 31.5 },
  },
  {
    id: 'gutshot',
    hero: ['Qc', 'Js'],
    board: ['Th', '8d', '2c'],
    category: 'gutshot',
    spot: {
      hero: ['Qc', 'Js'],
      board: ['Th', '8d', '2c'],
      hits: (cs) => hasStraight(cs),
    },
    expected: { outs: 4, total: 16.5 },
  },
  {
    id: 'doubleGutshot',
    hero: ['Jh', '9c'],
    board: ['Qd', 'Ts', '7s'],
    category: 'doubleGutshot',
    spot: {
      hero: ['Jh', '9c'],
      board: ['Qd', 'Ts', '7s'],
      hits: (cs) => hasStraight(cs),
    },
    expected: { outs: 8, total: 31.5 },
  },
  {
    id: 'comboFlushOvercard',
    hero: ['Ah', '7h'],
    board: ['Qh', '8h', '3c'],
    category: 'combo',
    spot: {
      hero: ['Ah', '7h'],
      board: ['Qh', '8h', '3c'],
      hits: (cs) => hasFlush(cs) || cs.filter((c) => c[0] === 'A').length >= 2,
    },
    expected: { outs: 12, total: 45.0 },
  },
  {
    id: 'combo',
    hero: ['Jd', 'Td'],
    board: ['9d', '8c', '2d'],
    category: 'combo',
    spot: {
      hero: ['Jd', 'Td'],
      board: ['9d', '8c', '2d'],
      hits: (cs) => hasFlush(cs) || hasStraight(cs),
    },
    expected: { outs: 15, total: 54.1 },
  },
  {
    id: 'pairImproving',
    hero: ['Ah', '9c'],
    board: ['9d', '5s', '2h'],
    category: 'pairImproving',
    spot: {
      hero: ['Ah', '9c'],
      board: ['9d', '5s', '2h'],
      hits: (cs, hero) =>
        pairsUp(hero, cs, 3) ||
        cs.filter((c) => c[0] === 'A').length >= 2,
    },
    expected: { outs: 5, total: 20.4 },
  },
  {
    id: 'overcards',
    hero: ['Ah', 'Kc'],
    board: ['9d', '7s', '2h'],
    category: 'overcards',
    spot: {
      hero: ['Ah', 'Kc'],
      board: ['9d', '7s', '2h'],
      hits: (cs, hero) => pairsUp(hero, cs, 2),
    },
    expected: { outs: 6, total: 24.1 },
  },
  {
    id: 'backdoor',
    hero: ['Ah', 'Kd'],
    board: ['9h', '5h', '2c'],
    category: 'backdoor',
    spot: {
      hero: ['Ah', 'Kd'],
      board: ['9h', '5h', '2c'],
      mode: 'backdoor',
    },
    expected: { outs: 0, total: 4.2 },
  },
  {
    id: 'flushDrawTurn',
    hero: ['As', '7s'],
    board: ['Ks', '4s', '9d', '2c'],
    category: 'flushDraw',
    spot: {
      hero: ['As', '7s'],
      board: ['Ks', '4s', '9d', '2c'],
      hits: (cs) => hasFlush(cs),
    },
    expected: { outs: 9, total: 19.6 },
  },
];
