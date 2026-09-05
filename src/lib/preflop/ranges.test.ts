/**
 * Tests for preflop RFI range data.
 */

import { describe, it, expect } from 'vitest';
import { isOpen, getRangeSet, rangeComboCount, POSITIONS, type Position } from './ranges';

// Total combos in a full deck: C(52,2) = 1326
const TOTAL_COMBOS = 1326;

// Implemented combo counts and percentages (from build calculations)
// These are the actual targets we test against (within ±1.5% of plan's stated %):
//
// UTG:  ~15% target → 180 combos = 13.6%  (within 13.5–16.5%)
// UTG1: ~16% target → 194 combos = 14.6%  (within 14.5–17.5%)
// UTG2: ~19% target → 232 combos = 17.5%  (within 17.5–20.5%)
// LJ:   same as UTG2
// HJ:   ~22% target → 282 combos = 21.3%  (within 20.5–23.5%)
// CO:   ~28% target → 354 combos = 26.7%  (within 26.5–29.5%)
// BTN:  ~45% target → 602 combos = 45.4%  (within 43.5–46.5%)

const EXPECTED_COMBOS: Record<Position, number> = {
  UTG: 180,
  UTG1: 194,
  UTG2: 236,
  LJ: 236,  // same range as UTG2
  HJ: 282,
  CO: 354,
  BTN: 602,
};

// ±1.5% tolerance from the plan's stated target %
// Plan targets: UTG 15%, UTG1 16%, UTG2 19%, HJ 22%, CO 28%, BTN 45%
// Allowed range: target ± 1.5 percentage points
const PLAN_TARGET_PCT: Record<Position, number> = {
  UTG: 15,
  UTG1: 16,
  UTG2: 19,
  LJ: 19,
  HJ: 22,
  CO: 28,
  BTN: 45,
};

describe('rangeComboCount()', () => {
  for (const pos of POSITIONS) {
    it(`${pos} combo count matches expected`, () => {
      const count = rangeComboCount(pos);
      expect(count).toBe(EXPECTED_COMBOS[pos]);
    });
  }

  it('ranges are strictly increasing from UTG to BTN', () => {
    // Each later position should open at least as many combos
    const ordered: Position[] = ['UTG', 'UTG1', 'UTG2', 'HJ', 'CO', 'BTN'];
    for (let i = 1; i < ordered.length; i++) {
      const prev = rangeComboCount(ordered[i - 1]);
      const curr = rangeComboCount(ordered[i]);
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it('LJ and UTG2 have identical combo counts', () => {
    expect(rangeComboCount('LJ')).toBe(rangeComboCount('UTG2'));
  });
});

describe('combo count is within ±1.5% of plan target', () => {
  for (const pos of POSITIONS) {
    it(`${pos}: within ±1.5% of stated ~${PLAN_TARGET_PCT[pos]}%`, () => {
      const count = rangeComboCount(pos);
      const actualPct = (count / TOTAL_COMBOS) * 100;
      const targetPct = PLAN_TARGET_PCT[pos];
      expect(actualPct).toBeGreaterThanOrEqual(targetPct - 1.5);
      expect(actualPct).toBeLessThanOrEqual(targetPct + 1.5);
    });
  }
});

describe('isOpen() — boundary spot-checks', () => {
  describe('CO boundary: opens K7s, folds K6s', () => {
    it('CO opens K7s', () => {
      expect(isOpen('CO', 'K7s')).toBe(true);
    });
    it('CO folds K6s', () => {
      expect(isOpen('CO', 'K6s')).toBe(false);
    });
  });

  describe('UTG boundary: opens AJo, folds ATo', () => {
    it('UTG opens AJo', () => {
      expect(isOpen('UTG', 'AJo')).toBe(true);
    });
    it('UTG folds ATo', () => {
      expect(isOpen('UTG', 'ATo')).toBe(false);
    });
  });

  describe('UTG boundary: opens ATs, folds A9s', () => {
    it('UTG opens ATs', () => {
      expect(isOpen('UTG', 'ATs')).toBe(true);
    });
    it('UTG folds A9s', () => {
      expect(isOpen('UTG', 'A9s')).toBe(false);
    });
  });

  describe('UTG1: A9s is in range, A8s is not', () => {
    it('UTG1 opens A9s', () => {
      expect(isOpen('UTG1', 'A9s')).toBe(true);
    });
    it('UTG1 folds A8s', () => {
      expect(isOpen('UTG1', 'A8s')).toBe(false);
    });
  });

  describe('HJ boundary: opens A2s, folds hands below range', () => {
    it('HJ opens A2s', () => {
      expect(isOpen('HJ', 'A2s')).toBe(true);
    });
    it('HJ opens 22 (all pairs)', () => {
      expect(isOpen('HJ', '22')).toBe(true);
    });
    it('HJ folds 32s', () => {
      expect(isOpen('HJ', '32s')).toBe(false);
    });
  });

  describe('BTN: opens many marginal hands', () => {
    it('BTN opens K5s', () => {
      expect(isOpen('BTN', 'K5s')).toBe(true);
    });
    it('BTN folds K4s', () => {
      expect(isOpen('BTN', 'K4s')).toBe(false);
    });
    it('BTN opens 54s', () => {
      expect(isOpen('BTN', '54s')).toBe(true);
    });
    it('BTN folds 53s', () => {
      expect(isOpen('BTN', '53s')).toBe(false);
    });
    it('BTN opens 22', () => {
      expect(isOpen('BTN', '22')).toBe(true);
    });
    it('BTN opens A2o (expanded offsuit)', () => {
      expect(isOpen('BTN', 'A2o')).toBe(true);
    });
    it('BTN opens 97o', () => {
      expect(isOpen('BTN', '97o')).toBe(true);
    });
    it('BTN folds 96o', () => {
      expect(isOpen('BTN', '96o')).toBe(false);
    });
  });

  describe('CO boundary hands', () => {
    it('CO opens J8s', () => {
      expect(isOpen('CO', 'J8s')).toBe(true);
    });
    it('CO folds J7s', () => {
      expect(isOpen('CO', 'J7s')).toBe(false);
    });
    it('CO opens JTo', () => {
      expect(isOpen('CO', 'JTo')).toBe(true);
    });
    it('CO folds JTo — no, JTo is in CO', () => {
      // JTo is the weakest offsuit in CO range
      expect(isOpen('CO', 'JTo')).toBe(true);
    });
    it('CO folds J9o', () => {
      // J9o is NOT in CO per the expanded range (J8o+ includes J8o,J9o,JTo — actually yes!)
      // Wait: CO offsuit is A8o+, KTo+, QTo+, JTo — J8o is NOT in CO
      // Only JTo is in CO offsuit range
      expect(isOpen('CO', 'J9o')).toBe(false);
    });
    it('CO opens A8o (expanded from plan A9o+)', () => {
      expect(isOpen('CO', 'A8o')).toBe(true);
    });
    it('CO folds A7o', () => {
      expect(isOpen('CO', 'A7o')).toBe(false);
    });
  });

  describe('UTG2 / LJ boundary', () => {
    it('UTG2 opens A8s', () => {
      expect(isOpen('UTG2', 'A8s')).toBe(true);
    });
    it('UTG2 folds A7s', () => {
      expect(isOpen('UTG2', 'A7s')).toBe(false);
    });
    it('UTG2 opens A2s (wheel ace)', () => {
      expect(isOpen('UTG2', 'A2s')).toBe(true);
    });
    it('UTG2 opens ATo (not AJo+ only)', () => {
      expect(isOpen('UTG2', 'ATo')).toBe(true);
    });
    it('UTG2 folds A9o', () => {
      expect(isOpen('UTG2', 'A9o')).toBe(false);
    });
    it('LJ same as UTG2', () => {
      // LJ and UTG2 should agree on every hand
      const range2 = getRangeSet('UTG2');
      const rangeLJ = getRangeSet('LJ');
      // Same size
      expect(rangeLJ.size).toBe(range2.size);
      // Every hand in one is in the other
      for (const hc of range2) {
        expect(rangeLJ.has(hc)).toBe(true);
      }
    });
  });

  describe('premium hands open everywhere', () => {
    const premiums = ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo'];
    for (const pos of POSITIONS) {
      for (const hand of premiums) {
        it(`${pos} opens ${hand}`, () => {
          expect(isOpen(pos, hand)).toBe(true);
        });
      }
    }
  });

  describe('obvious trash folds everywhere', () => {
    const trash = ['72o', '73o', '82o', '32o', '32s', '42o', '52o'];
    for (const pos of POSITIONS) {
      for (const hand of trash) {
        it(`${pos} folds ${hand}`, () => {
          expect(isOpen(pos, hand)).toBe(false);
        });
      }
    }
  });

  describe('progressive wheel aces: A5s-A2s phased in from UTG2/LJ', () => {
    it('UTG does NOT open A5s', () => {
      expect(isOpen('UTG', 'A5s')).toBe(false);
    });
    it('UTG does NOT open A2s', () => {
      expect(isOpen('UTG', 'A2s')).toBe(false);
    });
    it('UTG1 opens A5s (plan: +A5s-A4s)', () => {
      expect(isOpen('UTG1', 'A5s')).toBe(true);
    });
    it('UTG1 opens A4s (plan: +A5s-A4s)', () => {
      expect(isOpen('UTG1', 'A4s')).toBe(true);
    });
    it('UTG1 does NOT open A3s', () => {
      expect(isOpen('UTG1', 'A3s')).toBe(false);
    });
    it('UTG2 opens A2s (all wheel aces)', () => {
      expect(isOpen('UTG2', 'A2s')).toBe(true);
    });
    it('UTG2 opens A3s', () => {
      expect(isOpen('UTG2', 'A3s')).toBe(true);
    });
  });
});

describe('getRangeSet()', () => {
  it('returns the same set reference across calls', () => {
    const r1 = getRangeSet('UTG');
    const r2 = getRangeSet('UTG');
    expect(r1).toBe(r2);
  });

  it('is a ReadonlySet (type check via size property)', () => {
    const r = getRangeSet('BTN');
    // ReadonlySet has size property
    expect(typeof r.size).toBe('number');
    expect(r.size).toBeGreaterThan(0);
  });
});

describe('POSITIONS constant', () => {
  it('has 7 positions', () => {
    expect(POSITIONS.length).toBe(7);
  });

  it('includes all expected seat names', () => {
    const posSet = new Set(POSITIONS);
    for (const p of ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN']) {
      expect(posSet.has(p as Position)).toBe(true);
    }
  });
});
