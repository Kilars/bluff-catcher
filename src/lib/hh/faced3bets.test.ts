import { describe, expect, it } from 'vitest';

import { faced3Bets } from './faced3bets.ts';
import type { HeroHand } from './hero.ts';

/** A HeroHand with only the fields faced3Bets reads; the rest are irrelevant here. */
function hero(over: Partial<HeroHand>): HeroHand {
  return {
    role: 'open',
    position: 'LJ',
    cards: ['Kh', 'Qd'],
    stackBB: 100,
    faced3Bet: true,
    threeBettorPos: 'CO',
    faced3BetMultiway: false,
    faced3BetSizing: 0.84,
    faced3BetResponse: 'fold',
    ...over,
  } as HeroHand;
}

describe('faced3Bets', () => {
  it('keeps only hands where Hero was raised over the top', () => {
    const out = faced3Bets([
      hero({ id: 'h1' }),
      hero({ id: 'h2', faced3Bet: false }),
    ]);
    expect(out.map((f) => f.id)).toEqual(['h1']);
    expect(out[0]).toMatchObject({
      position: 'LJ',
      heroRole: 'open',
      threeBettorPos: 'CO',
      hand: 'KQo',
      stackBB: 100,
      depth: 'deep',
      multiway: false,
      sizing: 0.84,
      response: 'fold',
    });
  });

  it('distinguishes an open facing a 3-bet from a 3-bet facing a 4-bet', () => {
    const out = faced3Bets([
      hero({ id: 'open', role: 'open', faced3BetResponse: 'call' }),
      hero({ id: 'reraise', role: '3bet', faced3BetResponse: '4bet' }),
      hero({ id: 'squeeze', role: 'squeeze', faced3BetMultiway: true }),
    ]);
    expect(out.map((f) => [f.id, f.heroRole])).toEqual([
      ['open', 'open'],
      ['reraise', '3bet'],
      ['squeeze', 'squeeze'],
    ]);
  });

  it('skips a faced 3-bet with no recorded cards', () => {
    expect(faced3Bets([hero({ id: 'x', cards: null })])).toEqual([]);
  });

  it('carries no result field and no big-blind figure beyond the stack', () => {
    const [f] = faced3Bets([hero({ id: 'h1' })]);
    for (const k of Object.keys(f)) {
      expect(k).not.toMatch(/net|won|invested|cost/i);
      if (/BB$/.test(k)) expect(k).toBe('stackBB');
    }
  });
});
