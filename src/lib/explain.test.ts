/**
 * Tests for explain() — the explanation copy generator.
 *
 * The division of labour here is deliberate. The *numbers* a learner reads —
 * the out count, the rounded percentage, whether the drift correction (step 3)
 * appears, which multiplier the street uses — are asserted case by case,
 * because each is a branch in the generator. The *wording* is left to one
 * snapshot per case: it is the copy contract for tone review, it updates with
 * `vitest -u`, and asserting it twice (once by hand, once by snapshot) only
 * made a rewording fail in two places.
 *
 * Note on the 'overcardsWithThreeFlush' fixture (Ah Kd / 9h 5h 2c):
 *   It is the hand that used to be the backdoor fixture. It classifies as
 *   'overcards' (6 outs) and always did — both A and K are over a 9-high board.
 *   Backdoors are out of the taxonomy entirely now (DECISIONS.md), so the three
 *   hearts change nothing about the read or the copy.
 */

import { describe, it, expect } from 'vitest';
import { explain } from './explain';
import { classify } from './classify';
import { analyse, type Card } from './odds';
import { fixtures } from './fixtures';
import type { Category } from './classify';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runFixture(hero: Card[], board: Card[]) {
  const read = classify(hero, board);
  if (!read) throw new Error(`classify returned null for ${hero} / ${board}`);

  const analysis = analyse({ hero, board, hits: read.hits });

  return { read, analysis, exp: explain(read, analysis, hero, board) };
}

function spot(id: string): { hero: Card[]; board: Card[] } {
  const fx = fixtures.find((f) => f.id === id)!;
  return { hero: fx.hero, board: fx.board };
}

// ─── The cases ───────────────────────────────────────────────────────────────

interface Case {
  /** Reads as the describe() name, and keys the snapshot. */
  name: string;
  hero: Card[];
  board: Card[];
  category: Category;
  outs: number;
  /** The rounded percentage in the title — what the learner is told. */
  pct: number;
  /**
   * Step 3 is the drift correction, and it is the one branch in the generator
   * that turns on a computed quantity: it appears when |quick − true| > 0.9,
   * which in practice means outs above 8.
   */
  drift: boolean;
  /** 4 on the flop, 2 on the turn — the rule of 2 and 4 in one number. */
  multiplier: 2 | 4;
}

const CASES: Case[] = [
  // The A is an overcard on Ks 4s 9d, so this is 12 outs, not the flush's 9.
  { name: 'flushDraw (As 7s / Ks 4s 9d)', ...spot('flushDraw'), category: 'flushDraw', outs: 12, pct: 45, drift: true, multiplier: 4 },
  { name: 'openEnder (9h 8c / 7d 6s Kc)', ...spot('openEnder'), category: 'openEnder', outs: 8, pct: 32, drift: false, multiplier: 4 },
  // Qc Js is a gutshot plus two overcards, so 4 + 6.
  { name: 'gutshot (Qc Js / Th 8d 2c)', ...spot('gutshot'), category: 'gutshot', outs: 10, pct: 38, drift: true, multiplier: 4 },
  // J9 on QT7 is J-T-9-Q — four consecutive, both ends live. DECISIONS.md
  // calls that an open-ender, not the double gutshot the fixture id suggests.
  { name: 'doubleGutshot fixture (Jh 9c / Qd Ts 7s) — classifies as openEnder', ...spot('doubleGutshot'), category: 'openEnder', outs: 8, pct: 32, drift: false, multiplier: 4 },
  { name: 'comboFlushOvercard / flush+overcard (Ah 7h / Qh 8h 3c)', ...spot('comboFlushOvercard'), category: 'flushDraw', outs: 12, pct: 45, drift: true, multiplier: 4 },
  { name: 'combo flush+straight (Jd Td / 9d 8c 2d)', ...spot('combo'), category: 'combo', outs: 21, pct: 70, drift: true, multiplier: 4 },
  { name: 'pairImproving (Ah 9c / 9d 5s 2h)', ...spot('pairImproving'), category: 'pairImproving', outs: 5, pct: 20, drift: false, multiplier: 4 },
  { name: 'overcards (Ah Kc / 9d 7s 2h)', ...spot('overcards'), category: 'overcards', outs: 6, pct: 24, drift: false, multiplier: 4 },
  { name: 'overcards over three hearts (Ah Kd / 9h 5h 2c)', ...spot('overcardsWithThreeFlush'), category: 'overcards', outs: 6, pct: 24, drift: false, multiplier: 4 },
  { name: 'flushDrawTurn (As 7s / Ks 4s 9d 2c)', ...spot('flushDrawTurn'), category: 'flushDraw', outs: 12, pct: 26, drift: true, multiplier: 2 },
  // Not fixtures: the genuine double gutshot, and the two pocket-pair reads.
  { name: 'genuine doubleGutshot (Kc 9d / Jh Td 7s)', hero: ['Kc', '9d'], board: ['Jh', 'Td', '7s'], category: 'doubleGutshot', outs: 11, pct: 42, drift: true, multiplier: 4 },
  { name: 'pure 4-out gutshot (6c 5s / 9h 8d 2c)', hero: ['6c', '5s'], board: ['9h', '8d', '2c'], category: 'gutshot', outs: 4, pct: 17, drift: false, multiplier: 4 },
  { name: 'setDraw (5s 5d / Kh Qc 8d)', hero: ['5s', '5d'], board: ['Kh', 'Qc', '8d'], category: 'setDraw', outs: 2, pct: 8, drift: false, multiplier: 4 },
  // The underpair that also has the straight: 8 straight outs + 2 set outs.
  { name: 'openEnder+set (5s 5d / 6h 7c 8d)', hero: ['5s', '5d'], board: ['6h', '7c', '8d'], category: 'openEnder', outs: 10, pct: 38, drift: true, multiplier: 4 },
];

describe.each(CASES)('explain: $name', ({ hero, board, category, outs, pct, drift, multiplier }) => {
  it(`reads as ${category}, ${outs} outs → ${pct}%`, () => {
    const { read, analysis, exp } = runFixture(hero, board);
    expect(read.primaryCategory).toBe(category);
    expect(analysis.outs).toBe(outs);
    expect(exp.title).toBe(`${outs} outs → ${pct}%`);
    expect(Math.round(analysis.total)).toBe(pct);
  });

  it(`multiplies by ${multiplier}, and ${drift ? 'corrects' : 'does not correct'} for drift`, () => {
    const { exp } = runFixture(hero, board);
    expect(exp.headMaths.quickSum).toContain(`× ${multiplier}`);
    if (drift) expect(exp.step3?.title).toBe('Where the shortcut drifts');
    else expect(exp.step3).toBeNull();
  });

  it('copy snapshot', () => {
    const { exp } = runFixture(hero, board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── The set component, which the title alone cannot show ────────────────────

describe('a pocket pair that is also drawing', () => {
  it('carries a set component alongside the straight it is named for', () => {
    const read = classify(['5s', '5d'], ['6h', '7c', '8d']);
    expect(read?.primaryCategory).toBe('openEnder');
    expect(read?.components).toContain('set');
  });
});

// ─── The retired backdoor case: 8h 6d / Ah Kh 2c ────────────────────────────

describe('the old standalone backdoor (8h 6d / Ah Kh 2c) is no longer a hand', () => {
  it('classify rejects it as air, so explain is never called on it', () => {
    // It used to be the one hand that reached explain() with zero outs, and
    // every 'no shortcut' branch in the generator existed for it. Both are
    // gone: see DECISIONS.md, "Backdoors are out".
    expect(classify(['8h', '6d'], ['Ah', 'Kh', '2c'])).toBeNull();
  });
});
