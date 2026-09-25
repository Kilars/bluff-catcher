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
    ref: id,
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
    playersToFlop: 2,
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
    expect(v.verdicts.map((iv) => iv.ref).sort()).toEqual(['h1', 'h2']);
  });

  it('passes its own output through validation', async () => {
    const v = await stubJudge.evaluate(BRIEF);
    expect(() => validateFamilyVerdict(BRIEF, v)).not.toThrow();
  });
});

describe('validateFamilyVerdict — the seam contract', () => {
  // A single-instance brief, so a verdict covering just h1 satisfies coverage.
  const VB: FamilyBrief = {
    ...BRIEF,
    spots: [{ ...BRIEF.spots[0], count: 1, instances: [facts('h1')] }],
  };
  const ok = {
    family: 'PFR flop passivity' as const,
    throughline: null,
    verdicts: [{ label: 'pfa-check-flop' as const, ref: 'h1', verdict: 'leak' as const, severity: 3, note: 'x' }],
  };

  it('accepts a well-formed verdict', () => {
    expect(() => validateFamilyVerdict(VB, ok)).not.toThrow();
  });

  it('rejects a hand id the brief never supplied', () => {
    expect(() =>
      validateFamilyVerdict(VB, { ...ok, verdicts: [{ ...ok.verdicts[0], ref: 'ghost' }] }),
    ).toThrow(/ghost/);
  });

  it('rejects a label not in the brief', () => {
    expect(() =>
      validateFamilyVerdict(VB, { ...ok, verdicts: [{ ...ok.verdicts[0], label: 'check-draw' }] }),
    ).toThrow(/check-draw/);
  });

  it('rejects a severity outside 0..5', () => {
    expect(() =>
      validateFamilyVerdict(VB, { ...ok, verdicts: [{ ...ok.verdicts[0], severity: 9 }] }),
    ).toThrow(/severity/);
  });

  it('rejects a family that does not match the brief', () => {
    expect(() =>
      validateFamilyVerdict(VB, { ...ok, family: 'River bluffing' as const }),
    ).toThrow(/family/);
  });

  it('rejects a leak that hides at severity 0', () => {
    expect(() =>
      validateFamilyVerdict(VB, {
        family: 'PFR flop passivity',
        throughline: null,
        verdicts: [{ label: 'pfa-check-flop', ref: 'h1', verdict: 'leak', severity: 0, note: 'x' }],
      }),
    ).toThrow(/severity 0/);
  });

  it('rejects a fine verdict with non-zero severity', () => {
    expect(() =>
      validateFamilyVerdict(VB, {
        family: 'PFR flop passivity',
        throughline: null,
        verdicts: [{ label: 'pfa-check-flop', ref: 'h1', verdict: 'fine', severity: 3, note: 'x' }],
      }),
    ).toThrow(/fine at severity/);
  });

  it('rejects a duplicate verdict for one hand', () => {
    const one = { label: 'pfa-check-flop' as const, ref: 'h1', verdict: 'leak' as const, severity: 2, note: 'x' };
    expect(() =>
      validateFamilyVerdict(VB, { family: 'PFR flop passivity', throughline: null, verdicts: [one, one] }),
    ).toThrow(/duplicate/);
  });

  it('rejects a throughline that cites a hand that did not leak', () => {
    expect(() =>
      validateFamilyVerdict(VB, {
        family: 'PFR flop passivity',
        throughline: { thesis: 't', body: 'b', evidenceRefs: ['h2'] },
        verdicts: [{ label: 'pfa-check-flop', ref: 'h1', verdict: 'leak', severity: 2, note: 'x' }],
      }),
    ).toThrow(/h2/);
  });
});
