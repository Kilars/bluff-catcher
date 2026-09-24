import { describe, expect, it } from 'vitest';

import { batteryFor } from './battery.ts';
import { stubJudge, type Question } from './judge.ts';
import { LABELS } from './labels.ts';

const KINDS = new Set(['choice', 'score', 'noul']);

function valid(q: Question): boolean {
  if (!KINDS.has(q.kind) || !q.instructions) return false;
  if (q.kind === 'choice') return Object.keys(q.criteria).length >= 2;
  if (q.kind === 'score') return q.levels.length >= 2;
  return true;
}

describe('batteryFor', () => {
  it('gives every label a non-empty battery of well-formed questions', () => {
    for (const label of LABELS) {
      const battery = batteryFor(label);
      const qs = Object.values(battery);
      expect(qs.length, label).toBeGreaterThan(0);
      for (const q of qs) expect(valid(q), `${label}: ${q.instructions}`).toBe(true);
    }
  });

  it('is answerable by the judge port for every label', async () => {
    for (const label of LABELS) {
      const battery = batteryFor(label);
      const answers = await stubJudge.evaluate({}, battery);
      expect(Object.keys(answers).sort(), label).toEqual(Object.keys(battery).sort());
    }
  });
});
