import { describe, expect, it } from 'vitest';

import type { Enriched } from './enrich.ts';
import { stubJudge, validateFamilyVerdict, type FamilyBrief, type HandFacts } from './judge.ts';

const ENRICHED: Enriched = {
  alpha: 0.33,
  mdfOffered: 0.67,
  requiredEquity: null,
  mdf: null,
  sprCommitment: 'medium',
  boardFavoursPfa: true,
};

function facts(id: string): HandFacts {
  return {
    id,
    street: 'flop',
    action: 'check',
    position: 'CO',
    depth: 'deep',
    spr: 4,
    sizing: null,
    facedSizing: null,
    allIn: false,
    pfa: true,
    cards: ['Ah', 'Kh'],
    board: ['9h', '8c', '2d'],
    handClass: 'draw',
    boardType: 'wet-high-mine',
    removals: [],
    line: 'R / X',
    enriched: ENRICHED,
  };
}

const BRIEF: FamilyBrief = {
  family: 'PFR flop passivity',
  hypothesis: 'test me',
  spots: [
    {
      label: 'pfa-check-flop',
      cues: ['read boardFavoursPfa'],
      unless: 'a deliberate trap',
      count: 2,
      instances: [facts('h1'), facts('h2')],
    },
  ],
};

describe('stubJudge', () => {
  it('judges every instance fine at zero severity, no throughline', async () => {
    const v = await stubJudge.evaluate(BRIEF);
    expect(v.family).toBe('PFR flop passivity');
    expect(v.throughline).toBeNull();
    expect(v.verdicts).toHaveLength(2);
    expect(v.verdicts.every((iv) => iv.verdict === 'fine' && iv.severity === 0)).toBe(true);
    expect(v.verdicts.map((iv) => iv.id).sort()).toEqual(['h1', 'h2']);
  });

  it('passes its own output through validation', async () => {
    const v = await stubJudge.evaluate(BRIEF);
    expect(() => validateFamilyVerdict(BRIEF, v)).not.toThrow();
  });
});

describe('validateFamilyVerdict — the seam contract', () => {
  const ok = {
    family: 'PFR flop passivity' as const,
    throughline: null,
    verdicts: [{ label: 'pfa-check-flop' as const, id: 'h1', verdict: 'leak' as const, severity: 3, note: 'x' }],
  };

  it('accepts a well-formed verdict', () => {
    expect(() => validateFamilyVerdict(BRIEF, ok)).not.toThrow();
  });

  it('rejects a hand id the brief never supplied', () => {
    expect(() =>
      validateFamilyVerdict(BRIEF, { ...ok, verdicts: [{ ...ok.verdicts[0], id: 'ghost' }] }),
    ).toThrow(/ghost/);
  });

  it('rejects a label not in the brief', () => {
    expect(() =>
      validateFamilyVerdict(BRIEF, { ...ok, verdicts: [{ ...ok.verdicts[0], label: 'check-draw' }] }),
    ).toThrow(/check-draw/);
  });

  it('rejects a severity outside 0..5', () => {
    expect(() =>
      validateFamilyVerdict(BRIEF, { ...ok, verdicts: [{ ...ok.verdicts[0], severity: 9 }] }),
    ).toThrow(/severity/);
  });

  it('rejects a family that does not match the brief', () => {
    expect(() =>
      validateFamilyVerdict(BRIEF, { ...ok, family: 'River bluffing' as const }),
    ).toThrow(/family/);
  });
});
