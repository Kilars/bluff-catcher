import { describe, expect, it } from 'vitest';

import type { LabelGroup, LabelledDecision } from './labels.ts';
import { LABELS } from './labels.ts';
import {
  BASE_PRIORITY,
  FAMILIES,
  dominantCell,
  evidence,
  familyOf,
  familyRelevance,
  rankGroups,
} from './priority.ts';

function d(over: Partial<LabelledDecision>): LabelledDecision {
  return {
    position: 'CO',
    depth: 'deep',
    handClass: 'air',
    boardType: 'dry-high-mine',
    ...over,
  } as LabelledDecision;
}

function group(label: string, decisions: LabelledDecision[]): LabelGroup {
  return { label, decisions, shared: {} } as LabelGroup;
}

describe('priority tables', () => {
  it('weights every label and ranks missed aggression above bluff-catching', () => {
    for (const l of LABELS) expect(BASE_PRIORITY[l], l).toBeGreaterThan(0);
    expect(BASE_PRIORITY['pfa-check-flop']).toBeGreaterThan(BASE_PRIORITY['river-call-marginal']);
    expect(BASE_PRIORITY['river-check-value']).toBeGreaterThan(BASE_PRIORITY['river-call-marginal']);
  });

  it('partitions the nine labels into the four families exactly once each', () => {
    const flat = Object.values(FAMILIES).flat();
    expect(flat.sort()).toEqual([...LABELS].sort());
    expect(new Set(flat).size).toBe(LABELS.length);
    expect(familyOf('pfa-check-flop')).toBe('PFR flop passivity');
  });
});

describe('evidence', () => {
  it('is the dominant cell’s share once there are two instances', () => {
    const alike = [d({ position: 'CO' }), d({ position: 'CO' })];
    const split = [d({ position: 'CO' }), d({ position: 'BTN' })];
    expect(dominantCell(alike).share).toBe(1);
    expect(evidence(alike)).toBe(1);
    expect(dominantCell(split).share).toBe(0.5);
    expect(evidence(split)).toBe(0.5);
  });

  it('floors a lone instance instead of trusting its trivial agreement', () => {
    expect(evidence([d({})])).toBe(0.5);
  });
});

describe('rankGroups', () => {
  it('orders by base × evidence and drops empty groups', () => {
    const ranked = rankGroups([
      group('pfa-check-flop', [d({})]), // base 8 × 0.5 floor = 4
      group('river-check-value', [d({ position: 'BB' }), d({ position: 'BB' })]), // 7 × 1 = 7
      group('overbet-strong', []), // empty → dropped
    ]);
    expect(ranked.map((r) => r.label)).toEqual(['river-check-value', 'pfa-check-flop']);
    expect(ranked[0].priority).toBe(7);
    expect(ranked[1].priority).toBe(4);
  });

  it('surfaces each family on its strongest label', () => {
    const ranked = rankGroups([
      group('pfa-check-flop', [d({ position: 'BB' }), d({ position: 'BB' })]), // 8×1 = 8
      group('check-draw', [d({})]), // 7×0.5 = 3.5, same family
    ]);
    expect(familyRelevance(ranked)['PFR flop passivity']).toBe(8);
  });
});
