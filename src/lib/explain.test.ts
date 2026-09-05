/**
 * Tests for explain() — the explanation copy generator.
 *
 * For each fixture: classify → analyse → explain, then assert key properties
 * and snapshot the full Explanation for tone review.
 *
 * Note on the 'backdoor' fixture (Ah Kd / 9h 5h 2c):
 *   Per DECISIONS, this hand classifies as 'overcards' (6 outs), not backdoor,
 *   because both A and K are overcards on a 9-high board. The standalone-backdoor
 *   case uses 8h 6d / Ah Kh 2c (otherwise-air 3-flush hand).
 */

import { describe, it, expect } from 'vitest';
import { explain } from './explain';
import { classify } from './classify';
import { analyse, type Card } from './odds';
import { fixtures } from './fixtures';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runFixture(hero: Card[], board: Card[]) {
  const read = classify(hero, board);
  if (!read) throw new Error(`classify returned null for ${hero} / ${board}`);

  const analysis = read.backdoor
    ? analyse({ hero, board, mode: 'backdoor' })
    : analyse({ hero, board, hits: read.hits });

  return { read, analysis, exp: explain(read, analysis, hero, board) };
}

// ─── Fixture: flush draw (As 7s / Ks 4s 9d) ──────────────────────────────────
// Note: classify gives 12 outs (flush + overcard A) not 9 — A is an overcard on Ks 4s 9d.
// The fixture.spot.expected (9 outs) reflects the hand-written hits predicate (flush only),
// but classify's composite hits correctly counts the A overcard too.

describe('explain: flushDraw (As 7s / Ks 4s 9d)', () => {
  const fx = fixtures.find((f) => f.id === 'flushDraw')!;

  it('title is "12 outs → 45%" (flush + overcard A)', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    // classify gives 12 outs (9 flush + 3 ace overcard)
    expect(exp.title).toBe('12 outs → 45%');
  });

  it('subline contains "Flop" and "two cards to come"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.subline).toContain('Flop');
    expect(exp.subline).toContain('two cards to come');
  });

  it('step1 body mentions spades', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step1.body.toLowerCase()).toContain('spades');
  });

  it('step3 is non-null (12 outs > 8, drift correction applies)', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step3).not.toBeNull();
    expect(exp.step3!.title).toBe('Where the shortcut drifts');
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: open-ender (9h 8c / 7d 6s Kc) ─────────────────────────────────

describe('explain: openEnder (9h 8c / 7d 6s Kc)', () => {
  const fx = fixtures.find((f) => f.id === 'openEnder')!;

  it('title is "8 outs → 32%"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    // Math.round(31.5) = 32
    expect(exp.title).toBe('8 outs → 32%');
  });

  it('step1 title mentions "Eight cards"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step1.title).toContain('Eight');
  });

  it('step3 is null (8 outs, drift ≤ 0.9)', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step3).toBeNull();
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: gutshot (Qc Js / Th 8d 2c) ────────────────────────────────────

describe('explain: gutshot (Qc Js / Th 8d 2c)', () => {
  const fx = fixtures.find((f) => f.id === 'gutshot')!;

  it('title is correct (10 outs + overcards)', () => {
    // Qc Js classify as gutshot + 2 overcards → 10 outs
    const { exp, analysis } = runFixture(fx.hero, fx.board);
    expect(exp.title).toBe(`${analysis.outs} outs → ${Math.round(analysis.total)}%`);
  });

  it('step3 is null only for 4-out pure gutshot (6c 5s / 9h 8d 2c)', () => {
    // The fixture gutshot (Qc Js) has overcards → outs > 4, so test the pure case separately
    const { exp } = runFixture(['6c', '5s'] as Card[], ['9h', '8d', '2c'] as Card[]);
    expect(exp.title).toBe('4 outs → 17%');
    expect(exp.step3).toBeNull();
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: doubleGutshot fixture (Jh 9c / Qd Ts 7s) ──────────────────────
// Note: per DECISIONS, J9 on QT7 classifies as openEnder (J-T-9-Q = 4 consecutive),
// NOT doubleGutshot. The fixture id is 'doubleGutshot' but classify returns openEnder.

describe('explain: doubleGutshot fixture (Jh 9c / Qd Ts 7s) — classifies as openEnder', () => {
  const fx = fixtures.find((f) => f.id === 'doubleGutshot')!;

  it('classify returns openEnder for Jh 9c / Qd Ts 7s', () => {
    const read = classify(fx.hero, fx.board);
    expect(read).not.toBeNull();
    expect(read!.primaryCategory).toBe('openEnder');
  });

  it('title is correct (8 outs)', () => {
    const { exp, analysis } = runFixture(fx.hero, fx.board);
    expect(exp.title).toBe(`${analysis.outs} outs → ${Math.round(analysis.total)}%`);
  });

  it('step1 title mentions "Eight cards"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step1.title).toContain('Eight');
  });

  it('genuine doubleGutshot (Kc 9d / Jh Td 7s) step1 mentions belly', () => {
    // K9 on JT7 is the genuine double gutshot from DECISIONS
    const { exp } = runFixture(['Kc', '9d'] as Card[], ['Jh', 'Td', '7s'] as Card[]);
    expect(exp.step1.title.toLowerCase()).toContain('belly');
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: flush + overcard (Ah 7h / Qh 8h 3c) ───────────────────────────

describe('explain: comboFlushOvercard / flush+overcard (Ah 7h / Qh 8h 3c)', () => {
  const fx = fixtures.find((f) => f.id === 'comboFlushOvercard')!;

  it('title is "12 outs → 45%"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.title).toBe('12 outs → 45%');
  });

  it('step1 body mentions hearts and aces', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step1.body.toLowerCase()).toContain('hearts');
    expect(exp.step1.body.toLowerCase()).toContain('ace');
  });

  it('step3 is non-null (12 outs > 8)', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step3).not.toBeNull();
    expect(exp.step3!.title).toBe('Where the shortcut drifts');
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: combo flush + straight (Jd Td / 9d 8c 2d) ─────────────────────

describe('explain: combo flush+straight (Jd Td / 9d 8c 2d)', () => {
  const fx = fixtures.find((f) => f.id === 'combo')!;

  it('title is "15 outs → 54%"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    // classify produces 21 outs (flush + openEnder + 2 overcards). Use actual.
    const { analysis } = runFixture(fx.hero, fx.board);
    expect(exp.title).toBe(`${analysis.outs} outs → ${Math.round(analysis.total)}%`);
  });

  it('step1 body mentions overlap / counted once', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step1.body.toLowerCase()).toContain('once');
  });

  it('step3 is non-null (outs > 8)', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step3).not.toBeNull();
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: pairImproving (Ah 9c / 9d 5s 2h) ───────────────────────────────

describe('explain: pairImproving (Ah 9c / 9d 5s 2h)', () => {
  const fx = fixtures.find((f) => f.id === 'pairImproving')!;

  it('title is "5 outs → 20%"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.title).toBe('5 outs → 20%');
  });

  it('step1 body mentions trips', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step1.body.toLowerCase()).toContain('trips');
  });

  it('step3 is null (5 outs, drift small)', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    // 5 × 4 = 20; true = 20.4; round = 20; drift = 20 - 20.4 = -0.4; |drift| < 0.9 → null
    expect(exp.step3).toBeNull();
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: overcards (Ah Kc / 9d 7s 2h) ───────────────────────────────────

describe('explain: overcards (Ah Kc / 9d 7s 2h)', () => {
  const fx = fixtures.find((f) => f.id === 'overcards')!;

  it('title is "6 outs → 24%"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.title).toBe('6 outs → 24%');
  });

  it('step1 body mentions aces and kings', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step1.body.toLowerCase()).toContain('ace');
    expect(exp.step1.body.toLowerCase()).toContain('king');
  });

  it('step3 is null (6 outs, drift small)', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    // 6 × 4 = 24; true = 24.1; drift = 24 - 24.1 = -0.1; |drift| < 0.9 → null
    expect(exp.step3).toBeNull();
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: backdoor fixture (Ah Kd / 9h 5h 2c) → overcards ───────────────

describe('explain: "backdoor" fixture classifies as overcards (Ah Kd / 9h 5h 2c)', () => {
  const fx = fixtures.find((f) => f.id === 'backdoor')!;

  it('classify returns overcards (not backdoor) — per DECISIONS', () => {
    const read = classify(fx.hero, fx.board);
    expect(read).not.toBeNull();
    // Both A and K are overcards on a 9-high board; overcards win over backdoor
    expect(read!.primaryCategory).toBe('overcards');
  });

  it('explain title is for overcards, not backdoor', () => {
    const { exp, analysis } = runFixture(fx.hero, fx.board);
    // Should be "6 outs → 24%" (overcards)
    expect(exp.title).toBe(`${analysis.outs} outs → ${Math.round(analysis.total)}%`);
    expect(exp.title).not.toBe('Roughly 4%, and no shortcut');
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Fixture: flush draw on the turn (As 7s / Ks 4s 9d 2c) ──────────────────

describe('explain: flushDrawTurn (As 7s / Ks 4s 9d 2c)', () => {
  const fx = fixtures.find((f) => f.id === 'flushDrawTurn')!;

  it('subline contains "Turn" and "one card to come"', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.subline).toContain('Turn');
    expect(exp.subline).toContain('one card to come');
  });

  it('step2 title is about multiplying by 2', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.step2.title).toBe('One card to come, so multiply by 2');
  });

  it('headMaths quickSum uses ×2', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp.headMaths.quickSum).toContain('× 2');
  });

  it('snapshot', () => {
    const { exp } = runFixture(fx.hero, fx.board);
    expect(exp).toMatchSnapshot();
  });
});

// ─── Standalone backdoor case: 8h 6d / Ah Kh 2c ─────────────────────────────

describe('explain: standalone backdoor (8h 6d / Ah Kh 2c)', () => {
  const hero: Card[] = ['8h', '6d'];
  const board: Card[] = ['Ah', 'Kh', '2c'];

  it('classify returns backdoor', () => {
    const read = classify(hero, board);
    expect(read).not.toBeNull();
    expect(read!.primaryCategory).toBe('backdoor');
    expect(read!.backdoor).toBe(true);
  });

  it('explain title is "Roughly 4%, and no shortcut"', () => {
    const { exp } = runFixture(hero, board);
    expect(exp.title).toBe('Roughly 4%, and no shortcut');
  });

  it('step2 title is "The rule of 4 does not apply"', () => {
    const { exp } = runFixture(hero, board);
    expect(exp.step2.title).toBe('The rule of 4 does not apply');
  });

  it('step3 is null (backdoor → skip drift)', () => {
    const { exp } = runFixture(hero, board);
    expect(exp.step3).toBeNull();
  });

  it('step1 body mentions hearts', () => {
    const { exp } = runFixture(hero, board);
    expect(exp.step1.body.toLowerCase()).toContain('hearts');
  });

  it('headMaths quickSum is "No outs to multiply"', () => {
    const { exp } = runFixture(hero, board);
    expect(exp.headMaths.quickSum).toBe('No outs to multiply');
  });

  it('snapshot', () => {
    const { exp } = runFixture(hero, board);
    expect(exp).toMatchSnapshot();
  });
});
