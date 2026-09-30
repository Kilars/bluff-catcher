import { describe, expect, it } from 'vitest';

import type Anthropic from '@anthropic-ai/sdk';

import { anthropicJudge } from './anthropicJudge.ts';
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

/** A fake client that records the request and returns a canned structured response. */
function fakeClient(text: string, stopReason: string = 'end_turn') {
  const calls: unknown[] = [];
  const client = {
    messages: {
      create(body: unknown) {
        calls.push(body);
        return Promise.resolve({ stop_reason: stopReason, content: [{ type: 'text', text }] });
      },
    },
  } as unknown as Anthropic;
  return { client, calls };
}

describe('anthropicJudge', () => {
  it('throws at construction with no key and no client', () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() => anthropicJudge()).toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it('does not need a key when a client is injected', () => {
    const { client } = fakeClient(JSON.stringify(VERDICT));
    expect(() => anthropicJudge({ client })).not.toThrow();
  });

  it('maps the model response to a FamilyVerdict that clears the seam', async () => {
    const { client } = fakeClient(JSON.stringify(VERDICT));
    const v = await anthropicJudge({ client }).evaluate(BRIEF);
    expect(v.family).toBe('PFR flop passivity');
    expect(v.verdicts).toHaveLength(1);
    expect(() => assertBlind(validateFamilyVerdict(BRIEF, v))).not.toThrow();
  });

  it('sends the blindness system prompt, the model, and the json_schema format', async () => {
    const { client, calls } = fakeClient(JSON.stringify(VERDICT));
    await anthropicJudge({ client, model: 'claude-opus-4-8' }).evaluate(BRIEF);
    const body = calls[0] as {
      model: string;
      system: string;
      output_config: { format: { type: string } };
      messages: { content: string }[];
    };
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.system).toContain('BLINDNESS');
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.messages[0].content).toContain('h1#flop');
  });

  it('throws on a refusal stop reason', async () => {
    const { client } = fakeClient('{}', 'refusal');
    await expect(anthropicJudge({ client }).evaluate(BRIEF)).rejects.toThrow(/refused/);
  });

  it('throws on a truncated (max_tokens) response', async () => {
    const { client } = fakeClient('{', 'max_tokens');
    await expect(anthropicJudge({ client }).evaluate(BRIEF)).rejects.toThrow(/truncated/);
  });
});

describe('assertBlind', () => {
  it('lets a clean verdict through', () => {
    expect(() => assertBlind(VERDICT)).not.toThrow();
  });

  it('catches an outcome frame in a note', () => {
    const leaky: FamilyVerdict = {
      ...VERDICT,
      verdicts: [{ ...VERDICT.verdicts[0], note: 'Checking was fine here — villain had top set anyway.' }],
    };
    expect(() => assertBlind(leaky)).toThrow(/blindness breach/);
  });

  it('does not flag fold/call as strategy verbs', () => {
    const strategy: FamilyVerdict = {
      ...VERDICT,
      verdicts: [{ ...VERDICT.verdicts[0], note: 'Betting folds out worse and protects your checking range on Kd7c2s.' }],
    };
    expect(() => assertBlind(strategy)).not.toThrow();
  });

  it('does not flag river strategy vocab (showdown / busted draw)', () => {
    for (const note of [
      'Your top pair is ahead of enough of their range at showdown to bet thin.',
      'On a busted flush draw the no-blocker hand is the better bluff.',
      'A hand with showdown value should check back and take the free showdown.',
    ]) {
      const v: FamilyVerdict = { ...VERDICT, verdicts: [{ ...VERDICT.verdicts[0], note }] };
      expect(() => assertBlind(v), note).not.toThrow();
    }
  });
});
