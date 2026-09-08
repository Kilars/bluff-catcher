/**
 * Tests for preflop RFI range data.
 *
 * The suites above the divider predate the stack tiers and call the lookups
 * without a depth argument, so they pin the deep (40bb+) chart — which is
 * exactly the guarantee the rename needs: relabelling 60bb → 40bb+ must not
 * have moved a single combo.
 *
 * Below the divider are the 20bb and 10bb tiers: widths, the shape changes
 * that justify having them at all, and the invariants that hold everywhere.
 */

import { describe, it, expect } from 'vitest';
import {
  isOpen,
  getRangeSet,
  rangeComboCount,
  DEPTHS,
  DEPTH_META,
  DEFAULT_DEPTH,
  POSITIONS,
  type Depth,
  type Position,
} from './ranges';

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

// ═════════════════════════════════════════════════════════════════════════════
// Stack tiers
// ═════════════════════════════════════════════════════════════════════════════

describe('DEPTHS / DEPTH_META', () => {
  it('has exactly three tiers, deepest first', () => {
    expect([...DEPTHS]).toEqual(['deep', 'mid', 'short']);
  });

  it('defaults to the deep chart, so depth-less callers are unchanged', () => {
    expect(DEFAULT_DEPTH).toBe('deep');
    for (const pos of POSITIONS) {
      expect(rangeComboCount(pos)).toBe(rangeComboCount(pos, 'deep'));
      expect(getRangeSet(pos)).toBe(getRangeSet(pos, 'deep'));
    }
  });

  it('describes 40bb+ / 20bb / 10bb, and only 10bb is a jam', () => {
    expect(DEPTH_META.deep.label).toBe('40bb+');
    expect(DEPTH_META.mid.label).toBe('20bb');
    expect(DEPTH_META.short.label).toBe('10bb');

    expect(DEPTH_META.deep.action).toBe('open');
    expect(DEPTH_META.mid.action).toBe('open');
    expect(DEPTH_META.short.action).toBe('jam');
  });

  it('has metadata for every tier, keyed by its own id', () => {
    for (const d of DEPTHS) {
      expect(DEPTH_META[d].id).toBe(d);
      expect(DEPTH_META[d].label.length).toBeGreaterThan(0);
      expect(DEPTH_META[d].tagline.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Implemented widths per tier. These are exact — a chart edit that moves a
 * count has to move the number here too, deliberately.
 */
const EXPECTED_BY_DEPTH: Record<Depth, Record<Position, number>> = {
  deep: {
    UTG: 180, UTG1: 194, UTG2: 236, LJ: 236, HJ: 282, CO: 354, BTN: 602,
  },
  mid: {
    UTG: 166, UTG1: 180, UTG2: 230, LJ: 230, HJ: 286, CO: 370, BTN: 594,
  },
  short: {
    UTG: 202, UTG1: 222, UTG2: 266, LJ: 266, HJ: 322, CO: 426, BTN: 666,
  },
};

describe('rangeComboCount() across tiers', () => {
  for (const depth of DEPTHS) {
    for (const pos of POSITIONS) {
      it(`${depth} ${pos} = ${EXPECTED_BY_DEPTH[depth][pos]} combos`, () => {
        expect(rangeComboCount(pos, depth)).toBe(EXPECTED_BY_DEPTH[depth][pos]);
      });
    }
  }
});

describe('invariants that hold at every tier', () => {
  const ordered: Position[] = ['UTG', 'UTG1', 'UTG2', 'HJ', 'CO', 'BTN'];

  for (const depth of DEPTHS) {
    it(`${depth}: ranges widen from UTG to BTN`, () => {
      for (let i = 1; i < ordered.length; i++) {
        expect(rangeComboCount(ordered[i], depth)).toBeGreaterThan(
          rangeComboCount(ordered[i - 1], depth)
        );
      }
    });

    it(`${depth}: LJ is the same seat as UTG2`, () => {
      expect(getRangeSet('LJ', depth)).toEqual(getRangeSet('UTG2', depth));
    });

    it(`${depth}: premiums are played from every seat`, () => {
      for (const pos of POSITIONS) {
        for (const hand of ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo']) {
          expect(isOpen(pos, hand, depth)).toBe(true);
        }
      }
    });

    it(`${depth}: hopeless trash is folded from every seat`, () => {
      for (const pos of POSITIONS) {
        for (const hand of ['72o', '82o', '32o', '42o', '52o']) {
          expect(isOpen(pos, hand, depth)).toBe(false);
        }
      }
    });

    it(`${depth}: no seat opens more than the button`, () => {
      for (const pos of POSITIONS) {
        expect(rangeComboCount(pos, depth)).toBeLessThanOrEqual(
          rangeComboCount('BTN', depth)
        );
      }
    });
  }
});

/**
 * The point of the 20bb tier is that the *shape* moves while the width barely
 * does. If these two suites ever both fail, the tier has stopped teaching
 * anything and should be reconsidered rather than patched.
 */
describe('mid (20bb) — same width, different shape', () => {
  it('stays within 2 percentage points of the deep chart at every seat', () => {
    for (const pos of POSITIONS) {
      const deepPct = (rangeComboCount(pos, 'deep') / TOTAL_COMBOS) * 100;
      const midPct = (rangeComboCount(pos, 'mid') / TOTAL_COMBOS) * 100;
      expect(Math.abs(midPct - deepPct)).toBeLessThanOrEqual(2);
    }
  });

  it('drops the hands whose value was implied odds', () => {
    // UTG suited connectors: playable deep, not at 20bb.
    for (const hand of ['65s', '76s', '87s', '98s']) {
      expect(isOpen('UTG', hand, 'deep')).toBe(true);
      expect(isOpen('UTG', hand, 'mid')).toBe(false);
    }
    // Small pairs from the first seat: no set-mining odds left.
    expect(isOpen('UTG', '33', 'deep')).toBe(false);
    expect(isOpen('UTG', '33', 'mid')).toBe(false);
    // BTN speculative gappers.
    for (const hand of ['85s', '64s']) {
      expect(isOpen('BTN', hand, 'deep')).toBe(true);
      expect(isOpen('BTN', hand, 'mid')).toBe(false);
    }
  });

  it('adds the high-card hands that win without a flop', () => {
    // A9s / A5s open UTG at 20bb but not deep.
    for (const hand of ['A9s', 'A5s']) {
      expect(isOpen('UTG', hand, 'deep')).toBe(false);
      expect(isOpen('UTG', hand, 'mid')).toBe(true);
    }
    // Every suited king from the button — blocker plus top-pair value.
    for (const hand of ['K2s', 'K3s', 'K4s']) {
      expect(isOpen('BTN', hand, 'deep')).toBe(false);
      expect(isOpen('BTN', hand, 'mid')).toBe(true);
    }
    // A9o from the hijack.
    expect(isOpen('HJ', 'A9o', 'deep')).toBe(false);
    expect(isOpen('HJ', 'A9o', 'mid')).toBe(true);
  });

  it('tightens early position and widens late position', () => {
    for (const pos of ['UTG', 'UTG1', 'UTG2'] as Position[]) {
      expect(rangeComboCount(pos, 'mid')).toBeLessThan(rangeComboCount(pos, 'deep'));
    }
    for (const pos of ['HJ', 'CO'] as Position[]) {
      expect(rangeComboCount(pos, 'mid')).toBeGreaterThan(rangeComboCount(pos, 'deep'));
    }
  });
});

describe('short (10bb) — jam or fold', () => {
  it('jams every pocket pair from every seat', () => {
    const pairs = ['22', '33', '44', '55', '66', '77', '88', '99', 'TT', 'JJ', 'QQ', 'KK', 'AA'];
    for (const pos of POSITIONS) {
      for (const hand of pairs) {
        expect(isOpen(pos, hand, 'short')).toBe(true);
      }
    }
    // Which is not true deep — UTG folds 22/33/44 there.
    expect(isOpen('UTG', '22', 'deep')).toBe(false);
  });

  it('jams every suited ace from every seat', () => {
    for (const pos of POSITIONS) {
      for (const lo of ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']) {
        expect(isOpen(pos, `A${lo}s`, 'short')).toBe(true);
      }
    }
    expect(isOpen('UTG', 'A2s', 'deep')).toBe(false);
  });

  it('is wider than the deep chart at every seat — fold equity, not playability', () => {
    for (const pos of POSITIONS) {
      expect(rangeComboCount(pos, 'short')).toBeGreaterThan(
        rangeComboCount(pos, 'deep')
      );
    }
  });

  it('keeps small suited connectors out of early position', () => {
    // The worst hands to be called by: they need to make something.
    for (const hand of ['54s', '65s', '76s']) {
      expect(isOpen('UTG', hand, 'short')).toBe(false);
      expect(isOpen('UTG1', hand, 'short')).toBe(false);
    }
    // But the button jams them — nobody is left to call.
    for (const hand of ['54s', '65s', '76s']) {
      expect(isOpen('BTN', hand, 'short')).toBe(true);
    }
  });

  it('jams over half of all hands on the button', () => {
    const pct = (rangeComboCount('BTN', 'short') / TOTAL_COMBOS) * 100;
    expect(pct).toBeGreaterThan(50);
  });
});
