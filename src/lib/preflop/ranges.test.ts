/**
 * Tests for preflop RFI range data.
 *
 * The charts are transcriptions of solver-derived 9-handed MTT charts (see the
 * header of ranges.ts for provenance), so these tests pin two different kinds
 * of thing:
 *
 *   - **Widths.** Exact combo counts, verified against the counts printed on
 *     the source charts. A chart edit that moves a count has to move the
 *     number here too, deliberately.
 *   - **Shape.** The boundaries and the cross-tier moves that are the point of
 *     having three tiers at all. These are the tests that would catch a chart
 *     that is the right size and the wrong hands.
 *
 * Suites that call the lookups without a depth argument pin the deep (60bb+)
 * chart, which is the default every pre-tier caller gets.
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

/**
 * Implemented widths per tier, in combos. Each deep/mid figure is the count
 * printed on the reference chart it was transcribed from; the short figures
 * are built to Nash/push-fold widths for 10bb with antes.
 *
 *            deep 60bb+      mid 20bb        short 10bb
 *   UTG      214 (16.1%)     222 (16.7%)     214 (16.1%)
 *   UTG+1    232 (17.5%)     248 (18.7%)     234 (17.6%)
 *   UTG+2    272 (20.5%)     272 (20.5%)     262 (19.8%)
 *   LJ       312 (23.5%)     300 (22.6%)     310 (23.4%)
 *   HJ       380 (28.7%)     344 (25.9%)     374 (28.2%)
 *   CO       484 (36.5%)     430 (32.4%)     462 (34.8%)
 *   BTN      674 (50.8%)     574 (43.3%)     674 (50.8%)
 */
const EXPECTED_BY_DEPTH: Record<Depth, Record<Position, number>> = {
  deep: {
    UTG: 214, UTG1: 232, UTG2: 272, LJ: 312, HJ: 380, CO: 484, BTN: 674,
  },
  mid: {
    UTG: 222, UTG1: 248, UTG2: 272, LJ: 300, HJ: 344, CO: 430, BTN: 574,
  },
  short: {
    UTG: 214, UTG1: 234, UTG2: 262, LJ: 310, HJ: 374, CO: 462, BTN: 674,
  },
};

/** Seats in order, earliest first. Used by every monotonicity check. */
const ORDERED: Position[] = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN'];

describe('rangeComboCount() — deep chart widths', () => {
  for (const pos of POSITIONS) {
    it(`${pos} = ${EXPECTED_BY_DEPTH.deep[pos]} combos`, () => {
      expect(rangeComboCount(pos)).toBe(EXPECTED_BY_DEPTH.deep[pos]);
    });
  }

  it('widens strictly from UTG to BTN', () => {
    for (let i = 1; i < ORDERED.length; i++) {
      expect(rangeComboCount(ORDERED[i])).toBeGreaterThan(rangeComboCount(ORDERED[i - 1]));
    }
  });

  it('LJ is a separate, wider seat than UTG+2', () => {
    // They are adjacent seats at a 9-handed table, not the same seat: the
    // reference charts put them ~3 percentage points apart.
    expect(rangeComboCount('LJ')).toBeGreaterThan(rangeComboCount('UTG2'));
  });
});

describe('isOpen() — deep chart boundaries', () => {
  describe('UTG: suited aces in, small connectors out', () => {
    it('opens A3s', () => expect(isOpen('UTG', 'A3s')).toBe(true));
    it('opens A9s', () => expect(isOpen('UTG', 'A9s')).toBe(true));
    it('folds A2s', () => expect(isOpen('UTG', 'A2s')).toBe(false));
    it('opens T9s', () => expect(isOpen('UTG', 'T9s')).toBe(true));
    it('folds 98s — the connector needs a deeper stack', () => {
      expect(isOpen('UTG', '98s')).toBe(false);
    });
    it('folds 65s', () => expect(isOpen('UTG', '65s')).toBe(false));
    it('opens ATo', () => expect(isOpen('UTG', 'ATo')).toBe(true));
    it('folds A9o', () => expect(isOpen('UTG', 'A9o')).toBe(false));
    it('opens KJo, folds KTo', () => {
      expect(isOpen('UTG', 'KJo')).toBe(true);
      expect(isOpen('UTG', 'KTo')).toBe(false);
    });
    it('opens 66, folds 55', () => {
      expect(isOpen('UTG', '66')).toBe(true);
      expect(isOpen('UTG', '55')).toBe(false);
    });
  });

  describe('UTG+1: A2s and 98s join', () => {
    it('opens A2s', () => expect(isOpen('UTG1', 'A2s')).toBe(true));
    it('opens 98s', () => expect(isOpen('UTG1', '98s')).toBe(true));
    it('folds 87s', () => expect(isOpen('UTG1', '87s')).toBe(false));
    it('opens 55, folds 44', () => {
      expect(isOpen('UTG1', '55')).toBe(true);
      expect(isOpen('UTG1', '44')).toBe(false);
    });
  });

  describe('UTG+2: suited kings extend, KTo joins', () => {
    it('opens K6s, folds K5s', () => {
      expect(isOpen('UTG2', 'K6s')).toBe(true);
      expect(isOpen('UTG2', 'K5s')).toBe(false);
    });
    it('opens 87s', () => expect(isOpen('UTG2', '87s')).toBe(true));
    it('opens KTo, folds K9o', () => {
      expect(isOpen('UTG2', 'KTo')).toBe(true);
      expect(isOpen('UTG2', 'K9o')).toBe(false);
    });
    it('opens QJo, folds QTo', () => {
      expect(isOpen('UTG2', 'QJo')).toBe(true);
      expect(isOpen('UTG2', 'QTo')).toBe(false);
    });
  });

  describe('LJ: the first offsuit ace below ATo', () => {
    it('opens A9o, folds A8o', () => {
      expect(isOpen('LJ', 'A9o')).toBe(true);
      expect(isOpen('LJ', 'A8o')).toBe(false);
    });
    it('opens K5s, folds K4s', () => {
      expect(isOpen('LJ', 'K5s')).toBe(true);
      expect(isOpen('LJ', 'K4s')).toBe(false);
    });
    it('opens 76s, folds 65s', () => {
      expect(isOpen('LJ', '76s')).toBe(true);
      expect(isOpen('LJ', '65s')).toBe(false);
    });
    it('opens JTo', () => expect(isOpen('LJ', 'JTo')).toBe(true));
  });

  describe('HJ: pairs down to 33, wheel connectors in', () => {
    it('opens 33, folds 22', () => {
      expect(isOpen('HJ', '33')).toBe(true);
      expect(isOpen('HJ', '22')).toBe(false);
    });
    it('opens K3s, folds K2s', () => {
      expect(isOpen('HJ', 'K3s')).toBe(true);
      expect(isOpen('HJ', 'K2s')).toBe(false);
    });
    it('opens 54s, folds 43s', () => {
      expect(isOpen('HJ', '54s')).toBe(true);
      expect(isOpen('HJ', '43s')).toBe(false);
    });
    it('opens A8o, folds A7o', () => {
      expect(isOpen('HJ', 'A8o')).toBe(true);
      expect(isOpen('HJ', 'A7o')).toBe(false);
    });
    it('opens QTo, folds Q9o', () => {
      expect(isOpen('HJ', 'QTo')).toBe(true);
      expect(isOpen('HJ', 'Q9o')).toBe(false);
    });
  });

  describe('CO: every suited king, offsuit aces down to A5o', () => {
    it('opens K2s', () => expect(isOpen('CO', 'K2s')).toBe(true));
    it('opens Q4s, folds Q3s', () => {
      expect(isOpen('CO', 'Q4s')).toBe(true);
      expect(isOpen('CO', 'Q3s')).toBe(false);
    });
    it('opens A5o, folds A4o', () => {
      expect(isOpen('CO', 'A5o')).toBe(true);
      expect(isOpen('CO', 'A4o')).toBe(false);
    });
    it('opens K8o, folds K7o', () => {
      expect(isOpen('CO', 'K8o')).toBe(true);
      expect(isOpen('CO', 'K7o')).toBe(false);
    });
    it('opens Q9o, folds Q8o', () => {
      expect(isOpen('CO', 'Q9o')).toBe(true);
      expect(isOpen('CO', 'Q8o')).toBe(false);
    });
  });

  describe('BTN: just over half of all hands', () => {
    it('opens 22', () => expect(isOpen('BTN', '22')).toBe(true));
    it('opens Q2s', () => expect(isOpen('BTN', 'Q2s')).toBe(true));
    it('opens J3s, folds J2s', () => {
      expect(isOpen('BTN', 'J3s')).toBe(true);
      expect(isOpen('BTN', 'J2s')).toBe(false);
    });
    it('opens T4s, folds T3s', () => {
      expect(isOpen('BTN', 'T4s')).toBe(true);
      expect(isOpen('BTN', 'T3s')).toBe(false);
    });
    it('opens A2o', () => expect(isOpen('BTN', 'A2o')).toBe(true));
    it('opens K5o, folds K4o', () => {
      expect(isOpen('BTN', 'K5o')).toBe(true);
      expect(isOpen('BTN', 'K4o')).toBe(false);
    });
    it('opens 98o, folds 97o', () => {
      expect(isOpen('BTN', '98o')).toBe(true);
      expect(isOpen('BTN', '97o')).toBe(false);
    });
    it('opens more than half of all combos', () => {
      expect(rangeComboCount('BTN') / TOTAL_COMBOS).toBeGreaterThan(0.5);
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

  describe('suited aces are phased in before suited connectors', () => {
    // The single most common error in a homemade chart is the reverse: opening
    // 76s from UTG while folding A8s. Pin the correct order at every seat.
    for (const pos of POSITIONS) {
      it(`${pos}: opens A8s if it opens 76s`, () => {
        if (isOpen(pos, '76s')) expect(isOpen(pos, 'A8s')).toBe(true);
      });
      it(`${pos}: opens KTs if it opens 98s`, () => {
        if (isOpen(pos, '98s')) expect(isOpen(pos, 'KTs')).toBe(true);
      });
    }
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

  it('describes 60bb+ / 20bb / 10bb, and only 10bb is a jam', () => {
    expect(DEPTH_META.deep.label).toBe('60bb+');
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
  for (const depth of DEPTHS) {
    it(`${depth}: ranges widen from UTG to BTN`, () => {
      for (let i = 1; i < ORDERED.length; i++) {
        expect(rangeComboCount(ORDERED[i], depth)).toBeGreaterThanOrEqual(
          rangeComboCount(ORDERED[i - 1], depth)
        );
      }
    });

    it(`${depth}: every earlier seat's range is contained in every later one`, () => {
      // A later seat plays everything an earlier seat plays, plus more. This is
      // what makes the charts learnable, and it is what a hand-edited chart
      // breaks first.
      for (let i = 1; i < ORDERED.length; i++) {
        const earlier = getRangeSet(ORDERED[i - 1], depth);
        const later = getRangeSet(ORDERED[i], depth);
        for (const hc of earlier) {
          expect(
            later.has(hc),
            `${depth}: ${ORDERED[i]} should play ${hc} because ${ORDERED[i - 1]} does`
          ).toBe(true);
        }
      }
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
 * The 20bb tier exists to teach one counter-intuitive thing: shortening the
 * stack costs *late* position, not early position. If these suites stop
 * holding, the tier has stopped teaching it.
 */
describe('mid (20bb) — late position tightens, early position does not', () => {
  it('tightens hardest on the button', () => {
    const btnDeep = rangeComboCount('BTN', 'deep');
    const btnMid = rangeComboCount('BTN', 'mid');
    const dropPct = ((btnDeep - btnMid) / TOTAL_COMBOS) * 100;
    expect(dropPct).toBeGreaterThan(5);
  });

  it('tightens every seat from the LJ on', () => {
    for (const pos of ['LJ', 'HJ', 'CO', 'BTN'] as Position[]) {
      expect(rangeComboCount(pos, 'mid')).toBeLessThan(rangeComboCount(pos, 'deep'));
    }
  });

  it('does not tighten early position — antes push it a shade wider', () => {
    for (const pos of ['UTG', 'UTG1', 'UTG2'] as Position[]) {
      expect(rangeComboCount(pos, 'mid')).toBeGreaterThanOrEqual(
        rangeComboCount(pos, 'deep')
      );
    }
  });

  it('drops the hands whose value was implied odds', () => {
    // Button speculative hands: they were profitable because of what happens
    // after the flop, and after the flop is now an all-in.
    for (const hand of ['T5s', 'J3s', 'Q2s', '64s', 'K5o', '98o']) {
      expect(isOpen('BTN', hand, 'deep')).toBe(true);
      expect(isOpen('BTN', hand, 'mid')).toBe(false);
    }
    // Hijack wheel connectors, same reason.
    for (const hand of ['54s', '65s']) {
      expect(isOpen('HJ', hand, 'deep')).toBe(true);
      expect(isOpen('HJ', hand, 'mid')).toBe(false);
    }
  });

  it('adds the high-card hands that win without a flop', () => {
    // UTG picks up a suited king and the connector it can actually play.
    for (const hand of ['K7s', 'T8s', '98s']) {
      expect(isOpen('UTG', hand, 'deep')).toBe(false);
      expect(isOpen('UTG', hand, 'mid')).toBe(true);
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
    // Which is not true deep — UTG folds 22 there.
    expect(isOpen('UTG', '22', 'deep')).toBe(false);
  });

  it('jams every suited ace from every seat', () => {
    for (const pos of POSITIONS) {
      for (const lo of ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K']) {
        expect(isOpen(pos, `A${lo}s`, 'short')).toBe(true);
      }
    }
    // Deep, the first seat folds the bottom one.
    expect(isOpen('UTG', 'A2s', 'deep')).toBe(false);
  });

  it('lands within 2 points of the deep chart at every seat', () => {
    // The counter-intuitive bit is *not* that a jam range is much wider than an
    // open range — it is not. Fold equity buys the bottom of the range and the
    // inability to fold to a re-raise sells the top back. What differs is which
    // hands, not how many.
    for (const pos of POSITIONS) {
      const deepPct = (rangeComboCount(pos, 'deep') / TOTAL_COMBOS) * 100;
      const shortPct = (rangeComboCount(pos, 'short') / TOTAL_COMBOS) * 100;
      expect(Math.abs(shortPct - deepPct)).toBeLessThanOrEqual(2);
    }
  });

  it('swaps playability hands for showdown hands at the same width', () => {
    // UTG is the same size deep and short (214 combos) out of different hands.
    expect(rangeComboCount('UTG', 'short')).toBe(rangeComboCount('UTG', 'deep'));
    // In: the bottom pairs and the bottom suited ace, which never see a turn.
    for (const hand of ['22', '33', '44', '55', 'A2s']) {
      expect(isOpen('UTG', hand, 'deep')).toBe(false);
      expect(isOpen('UTG', hand, 'short')).toBe(true);
    }
    // Out: the hands that needed a flop and a stack behind them.
    for (const hand of ['K8s', 'Q9s', 'J9s', 'T9s']) {
      expect(isOpen('UTG', hand, 'deep')).toBe(true);
      expect(isOpen('UTG', hand, 'short')).toBe(false);
    }
  });

  it('keeps small suited connectors out of early position', () => {
    // The worst hands to get called by: they need to make something.
    for (const hand of ['54s', '65s', '76s']) {
      expect(isOpen('UTG', hand, 'short')).toBe(false);
      expect(isOpen('UTG1', hand, 'short')).toBe(false);
    }
    // But the button jams them — only two players can call.
    for (const hand of ['54s', '65s', '76s']) {
      expect(isOpen('BTN', hand, 'short')).toBe(true);
    }
  });

  it('jams over half of all hands on the button', () => {
    const pct = (rangeComboCount('BTN', 'short') / TOTAL_COMBOS) * 100;
    expect(pct).toBeGreaterThan(50);
  });
});
