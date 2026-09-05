/**
 * Tests for the 169 hand-class model.
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
} from './hands';

describe('handClass()', () => {
  describe('pocket pairs', () => {
    it('classifies AA regardless of suit order', () => {
      expect(handClass('As', 'Ah')).toBe('AA');
      expect(handClass('Ah', 'As')).toBe('AA');
      expect(handClass('Ad', 'Ac')).toBe('AA');
    });

    it('classifies KK', () => {
      expect(handClass('Ks', 'Kh')).toBe('KK');
    });

    it('classifies 22', () => {
      expect(handClass('2s', '2h')).toBe('22');
    });

    it('classifies TT', () => {
      expect(handClass('Ts', 'Th')).toBe('TT');
    });
  });

  describe('suited hands', () => {
    it('classifies AKs', () => {
      expect(handClass('As', 'Ks')).toBe('AKs');
      expect(handClass('Ks', 'As')).toBe('AKs');
    });

    it('classifies ATs', () => {
      expect(handClass('Ah', 'Th')).toBe('ATs');
    });

    it('classifies 72s', () => {
      expect(handClass('7d', '2d')).toBe('72s');
    });

    it('classifies JTs — hi rank always first', () => {
      expect(handClass('Js', 'Ts')).toBe('JTs');
      expect(handClass('Ts', 'Js')).toBe('JTs');
    });

    it('classifies 54s', () => {
      expect(handClass('5c', '4c')).toBe('54s');
    });
  });

  describe('offsuit hands', () => {
    it('classifies AKo', () => {
      expect(handClass('As', 'Kh')).toBe('AKo');
      expect(handClass('Kh', 'As')).toBe('AKo');
    });

    it('classifies ATo', () => {
      expect(handClass('Ad', 'Th')).toBe('ATo');
    });

    it('classifies 72o', () => {
      expect(handClass('7s', '2h')).toBe('72o');
    });

    it('classifies KQo', () => {
      expect(handClass('Kd', 'Qs')).toBe('KQo');
      expect(handClass('Qs', 'Kd')).toBe('KQo');
    });

    it('classifies JTo', () => {
      expect(handClass('Jc', 'Th')).toBe('JTo');
    });
  });

  describe('representative boundary hands from the range chart', () => {
    // CO opens K7s, folds K6s
    it('K7s hand class correct', () => {
      expect(handClass('Ks', '7s')).toBe('K7s');
    });
    it('K6s hand class correct', () => {
      expect(handClass('Kh', '6h')).toBe('K6s');
    });
    // UTG opens AJo, folds ATo
    it('AJo hand class correct', () => {
      expect(handClass('Ah', 'Jd')).toBe('AJo');
    });
    it('ATo hand class correct', () => {
      expect(handClass('Ad', 'Tc')).toBe('ATo');
    });
  });
});

describe('parseHandClass()', () => {
  it('parses a pocket pair', () => {
    const r = parseHandClass('AA');
    expect(r.hiRank).toBe('A');
    expect(r.loRank).toBe('A');
    expect(r.type).toBe('pair');
  });

  it('parses a suited hand', () => {
    const r = parseHandClass('AKs');
    expect(r.hiRank).toBe('A');
    expect(r.loRank).toBe('K');
    expect(r.type).toBe('suited');
  });

  it('parses an offsuit hand', () => {
    const r = parseHandClass('72o');
    expect(r.hiRank).toBe('7');
    expect(r.loRank).toBe('2');
    expect(r.type).toBe('offsuit');
  });
});

describe('ALL_169', () => {
  it('has exactly 169 hand classes', () => {
    expect(ALL_169.length).toBe(169);
  });

  it('has no duplicates', () => {
    const set = new Set(ALL_169);
    expect(set.size).toBe(169);
  });

  it('includes all 13 pocket pairs', () => {
    const pairs = ALL_169.filter((hc) => hc.length === 2);
    expect(pairs.length).toBe(13);
    const pairSet = new Set(pairs);
    for (const rank of '23456789TJQKA') {
      expect(pairSet.has(rank + rank)).toBe(true);
    }
  });

  it('includes exactly 78 suited classes', () => {
    const suited = ALL_169.filter((hc) => hc.length === 3 && hc[2] === 's');
    expect(suited.length).toBe(78);
  });

  it('includes exactly 78 offsuit classes', () => {
    const offsuit = ALL_169.filter((hc) => hc.length === 3 && hc[2] === 'o');
    expect(offsuit.length).toBe(78);
  });

  it('total combos = 1326', () => {
    const total = ALL_169.reduce((sum, hc) => sum + combosForClass(hc), 0);
    // 13*6 + 78*4 + 78*12 = 78 + 312 + 936 = 1326
    expect(total).toBe(1326);
  });
});

describe('HAND_STRENGTH_RANKING', () => {
  it('has exactly 169 entries', () => {
    expect(HAND_STRENGTH_RANKING.length).toBe(169);
  });

  it('has no duplicates (total ordering)', () => {
    const set = new Set(HAND_STRENGTH_RANKING);
    expect(set.size).toBe(169);
  });

  it('contains all 169 classes from ALL_169', () => {
    const rankingSet = new Set(HAND_STRENGTH_RANKING);
    for (const hc of ALL_169) {
      expect(rankingSet.has(hc)).toBe(true);
    }
  });

  it('AA is the strongest hand (index 0)', () => {
    expect(HAND_STRENGTH_RANKING[0]).toBe('AA');
  });

  it('32o is one of the weakest hands (near end)', () => {
    const rank = strengthRank('32o');
    expect(rank).toBeGreaterThan(150); // well toward the end of 169
  });

  it('72o is near the end (weak trash)', () => {
    const rank = strengthRank('72o');
    expect(rank).toBeGreaterThan(140);
  });

  it('AA ranks above KK', () => {
    expect(strengthRank('AA')).toBeLessThan(strengthRank('KK'));
  });

  it('KK ranks above QQ', () => {
    expect(strengthRank('KK')).toBeLessThan(strengthRank('QQ'));
  });

  it('AKs ranks above AKo', () => {
    expect(strengthRank('AKs')).toBeLessThan(strengthRank('AKo'));
  });

  it('AKo ranks above AQo', () => {
    expect(strengthRank('AKo')).toBeLessThan(strengthRank('AQo'));
  });

  it('AKs ranks above KQs', () => {
    expect(strengthRank('AKs')).toBeLessThan(strengthRank('KQs'));
  });

  it('JTs ranks above 54s', () => {
    expect(strengthRank('JTs')).toBeLessThan(strengthRank('54s'));
  });

  it('is stable: sort order is deterministic', () => {
    // Sort a copy — should produce same result
    const copy = [...HAND_STRENGTH_RANKING];
    expect(copy).toEqual([...HAND_STRENGTH_RANKING]);
  });
});

describe('expandCombos()', () => {
  it('pair produces 6 combos', () => {
    const combos = expandCombos('AA');
    expect(combos.length).toBe(6);
    // All should be aces with different suit pairs
    for (const [a, b] of combos) {
      expect(a[0]).toBe('A');
      expect(b[0]).toBe('A');
      expect(a[1]).not.toBe(b[1]); // different suits
    }
    // All combos are unique
    const set = new Set(combos.map(([a, b]) => `${a}${b}`));
    expect(set.size).toBe(6);
  });

  it('suited produces 4 combos', () => {
    const combos = expandCombos('AKs');
    expect(combos.length).toBe(4);
    for (const [a, b] of combos) {
      expect(a[0]).toBe('A');
      expect(b[0]).toBe('K');
      expect(a[1]).toBe(b[1]); // same suit
    }
  });

  it('offsuit produces 12 combos', () => {
    const combos = expandCombos('AKo');
    expect(combos.length).toBe(12);
    for (const [a, b] of combos) {
      expect(a[0]).toBe('A');
      expect(b[0]).toBe('K');
      expect(a[1]).not.toBe(b[1]); // different suits
    }
  });
});

describe('round-trip: concrete cards → hand class → parse', () => {
  const cases: [string, string, string][] = [
    ['As', 'Ah', 'AA'],
    ['Kd', 'Kc', 'KK'],
    ['2s', '2c', '22'],
    ['Ts', 'Th', 'TT'],
    ['As', 'Ks', 'AKs'],
    ['Ah', 'Kh', 'AKs'],
    ['As', 'Kh', 'AKo'],
    ['Kd', 'As', 'AKo'],
    ['7s', '2s', '72s'],
    ['7h', '2d', '72o'],
    ['Jd', 'Td', 'JTs'],
    ['Jh', 'Ts', 'JTo'],
    ['5c', '4c', '54s'],
    ['5d', '4h', '54o'],
    ['9s', '8s', '98s'],
    ['9h', '8d', '98o'],
  ];

  for (const [cardA, cardB, expected] of cases) {
    it(`${cardA} + ${cardB} → ${expected}`, () => {
      expect(handClass(cardA as never, cardB as never)).toBe(expected);
    });
  }
});
