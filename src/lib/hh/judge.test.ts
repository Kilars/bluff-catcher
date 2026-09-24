import { describe, expect, it } from 'vitest';

import { stubJudge, type QuestionSet } from './judge.ts';

const QS: QuestionSet = {
  pick: { kind: 'choice', instructions: 'pick one', criteria: { a: 'A', b: 'B', c: 'C' } },
  rate: { kind: 'score', instructions: 'rate it', levels: ['low', 'mid', 'high', 'top'] },
  yesno: { kind: 'noul', instructions: 'is it so' },
};

describe('stubJudge', () => {
  it('answers every question, well-formed, at zero confidence', async () => {
    const a = await stubJudge.evaluate({ anything: true }, QS);

    expect(a.pick).toEqual({
      kind: 'choice',
      choice: 'a', // first option
      confidence: 0,
      probabilities: { a: 1 / 3, b: 1 / 3, c: 1 / 3 },
    });
    // Middle of four ordered levels is 1.5, and it never claims confidence.
    expect(a.rate).toEqual({ kind: 'score', score: 1.5, confidence: 0 });
    expect(a.yesno).toEqual({ kind: 'noul', noul: 0.5 });
  });

  it('returns one answer per question and nothing more', async () => {
    const a = await stubJudge.evaluate(null, QS);
    expect(Object.keys(a).sort()).toEqual(['pick', 'rate', 'yesno']);
  });
});
