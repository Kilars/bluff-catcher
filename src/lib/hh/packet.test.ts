import { describe, expect, it } from 'vitest';

import type { LabelGroup, LabelledDecision } from './labels.ts';
import { familyBriefs, spotBrief } from './packet.ts';
import { rankGroups } from './priority.ts';
import { rubricFor } from './rubric.ts';

function d(over: Partial<LabelledDecision>): LabelledDecision {
  return {
    id: 'h1',
    kind: 'check',
    position: 'CO',
    depth: 'deep',
    handClass: 'air',
    boardType: 'dry-high-mine',
    sizing: 0.5,
    facedSizing: null,
    spr: 4,
    allIn: false,
    pfa: true,
    cards: ['Ah', 'Kh'],
    board: ['9h', '8c', '2d'],
    removals: [],
    line: 'R / X',
    ...over,
  } as LabelledDecision;
}

function group(label: string, decisions: LabelledDecision[]): LabelGroup {
  return { label, decisions, shared: {} } as LabelGroup;
}

describe('spotBrief', () => {
  it('carries the rubric, the total count, and enriched instances', () => {
    const [ranked] = rankGroups([group('pfa-check-flop', [d({}), d({})])]);
    const s = spotBrief(ranked);

    expect(s.label).toBe('pfa-check-flop');
    expect(s.cues).toEqual(rubricFor('pfa-check-flop').cues);
    expect(s.unless).toBe(rubricFor('pfa-check-flop').unless);
    expect(s.count).toBe(2);
    expect(s.instances).toHaveLength(2);
    // half-pot bet enriched, not left raw
    expect(s.instances[0].enriched.alpha).toBe(0.33);
    expect(s.instances[0].line).toBe('R / X');
  });

  it('samples a large group to PER_SPOT but keeps the true count', () => {
    const decisions = Array.from({ length: 12 }, () => d({}));
    const [ranked] = rankGroups([group('check-draw', decisions)]);
    const s = spotBrief(ranked);
    expect(s.count).toBe(12);
    expect(s.instances).toHaveLength(4); // every ⌈12/5⌉ = 3rd
  });

  it('sends every instance when perSpot is Infinity (the --label case)', () => {
    const decisions = Array.from({ length: 12 }, () => d({}));
    const [ranked] = rankGroups([group('check-draw', decisions)]);
    expect(spotBrief(ranked, Infinity).instances).toHaveLength(12);
  });
});

describe('familyBriefs', () => {
  it('bundles spots by family, families ordered by strongest candidate', () => {
    const briefs = familyBriefs(
      rankGroups([
        group('pfa-check-flop', [d({}), d({})]), // 8 × 1  = 8
        group('check-draw', [d({})]), // 7 × 0.5, same family
        group('river-call-marginal', [d({})]), // 3 × 0.5, other family
      ]),
    );

    expect(briefs.map((b) => b.family)).toEqual([
      'PFR flop passivity',
      'River value / bluff-catch',
    ]);
    expect(briefs[0].hypothesis).toMatch(/initiative/);
    expect(briefs[0].spots.map((s) => s.label)).toEqual(['pfa-check-flop', 'check-draw']);
  });
});
