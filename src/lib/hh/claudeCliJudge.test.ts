import { describe, expect, it } from 'vitest';

import { claudeCliJudge } from './claudeCliJudge.ts';
import type { Enriched } from './enrich.ts';
import { assertBlind, validateFamilyVerdict, type FamilyBrief, type FamilyVerdict, type HandFacts } from './judge.ts';

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
    ref: `${id}#flop`,
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
    board: ['Kd', '7c', '2s'],
    handClass: 'strong',
    boardType: 'dry-high-mine',
    removals: [],
    playersToFlop: 2,
    line: 'R / X',
    enriched: ENRICHED,
  };
}

const BRIEF: FamilyBrief = {
  family: 'PFR flop passivity',
  hypothesis: 'Hero surrenders the initiative. Test this against the hands.',
  spots: [
    {
      label: 'pfa-check-flop',
      cues: ['read boardFavoursPfa'],
      unless: 'a deliberate trap',
      count: 1,
      instances: [facts('h1')],
    },
  ],
};

const VERDICT: FamilyVerdict = {
  family: 'PFR flop passivity',
  verdicts: [
    {
      label: 'pfa-check-flop',
      ref: 'h1#flop',
      verdict: 'leak',
      severity: 3,
      note: 'On this Kd7c2s board boardFavoursPfa is true, so checking AK forfeits a standard c-bet.',
    },
  ],
  throughline: null,
};

describe('claudeCliJudge', () => {
  it('maps clean model output to a FamilyVerdict that clears the seam', async () => {
    const judge = claudeCliJudge({ run: () => Promise.resolve(JSON.stringify(VERDICT)) });
    const v = await judge.evaluate(BRIEF);
    expect(v.family).toBe('PFR flop passivity');
    expect(() => assertBlind(validateFamilyVerdict(BRIEF, v))).not.toThrow();
  });

  it('strips prose and code fences around the JSON', async () => {
    const wrapped = 'Here is my grading:\n```json\n' + JSON.stringify(VERDICT) + '\n```\nLet me know!';
    const judge = claudeCliJudge({ run: () => Promise.resolve(wrapped) });
    const v = await judge.evaluate(BRIEF);
    expect(v.verdicts).toHaveLength(1);
    expect(v.verdicts[0].ref).toBe('h1#flop');
  });

  it('passes the blindness system prompt to the runner', async () => {
    let seenSystem = '';
    const judge = claudeCliJudge({
      run: (system) => {
        seenSystem = system;
        return Promise.resolve(JSON.stringify(VERDICT));
      },
    });
    await judge.evaluate(BRIEF);
    expect(seenSystem).toContain('BLINDNESS');
  });

  it('throws on output with no JSON object', async () => {
    const judge = claudeCliJudge({ run: () => Promise.resolve('I could not grade these hands.') });
    await expect(judge.evaluate(BRIEF)).rejects.toThrow(/unparseable/);
  });
});
