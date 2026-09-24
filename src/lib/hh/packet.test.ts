import { describe, expect, it } from 'vitest';

import { batteryFor } from './battery.ts';
import type { LabelGroup, LabelledDecision } from './labels.ts';
import { packetsByFamily, scenarioPacket } from './packet.ts';
import { rankGroups } from './priority.ts';

function d(over: Partial<LabelledDecision>): LabelledDecision {
  return {
    position: 'CO',
    depth: 'deep',
    handClass: 'air',
    boardType: 'dry-high-mine',
    sizing: 0.5,
    facedSizing: null,
    spr: 4,
    ...over,
  } as LabelledDecision;
}

function group(label: string, decisions: LabelledDecision[]): LabelGroup {
  return { label, decisions, shared: {} } as LabelGroup;
}

describe('scenarioPacket', () => {
  it('carries the battery, the enriched instances, and the dominant cell', () => {
    const [ranked] = rankGroups([group('pfa-check-flop', [d({}), d({})])]);
    const p = scenarioPacket(ranked);

    expect(Object.keys(p.battery)).toEqual(Object.keys(batteryFor('pfa-check-flop')));
    expect(p.instances).toBe(2);
    expect(p.decisions).toHaveLength(2);
    expect(p.decisions[0].enriched.alpha).toBe(0.33); // half-pot bet enriched, not left raw
    expect(p.dominantCell.share).toBe(1);
    expect(p.family).toBe('PFR flop passivity');
  });
});

describe('packetsByFamily', () => {
  it('bundles by family, families and packets both ordered by strength', () => {
    const bundles = packetsByFamily(
      rankGroups([
        group('pfa-check-flop', [d({}), d({})]), // 8 × 1  = 8
        group('check-draw', [d({})]), // 7 × 0.5 = 3.5, same family
        group('river-call-marginal', [d({})]), // 3 × 0.5 = 1.5, other family
      ]),
    );

    expect(bundles.map((b) => b.family)).toEqual([
      'PFR flop passivity', // relevance 8 leads
      'River value / bluff-catch', // relevance 1.5
    ]);
    expect(bundles[0].relevance).toBe(8);
    expect(bundles[0].packets.map((p) => p.label)).toEqual(['pfa-check-flop', 'check-draw']);
  });
});
