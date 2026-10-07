import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { faced3Bets } from './faced3bets.ts';
import { heroHand, type HeroHand } from './hero.ts';
import { parseHands } from './parse.ts';

/** Archive hands, verbatim, read through the whole pipeline. */
function archive(path: string): HeroHand[] {
  return parseHands(readFileSync(path, 'utf8')).hands.map((h) => heroHand(h)!);
}
const MTT2 = archive('src/lib/hh/fixtures/mtt/round2.txt');

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
    faced3BetCold4Bet: false,
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
      cold4Bet: false,
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

  it('names the cash chart for a cash hand, not a tournament tier', () => {
    const [f] = faced3Bets([hero({ id: 'rc', variant: 'cash', stackBB: 110 })]);
    expect(f.depth).toBe('cash');
    const [m] = faced3Bets([hero({ id: 'tm', variant: 'mtt', stackBB: 30 })]);
    expect(m.depth).toBe('mid');
  });
});

describe('faced3Bets sizing', () => {
  it('sizes a shove over Hero at what Hero can call, not what was pushed in', () => {
    // A jam for far more than Hero has: the part above Hero's stack is never
    // Hero's to call, so it is not part of the raise Hero faced.
    const sizing = Object.fromEntries(faced3Bets(MTT2).map((f) => [f.id, f.sizing]));
    expect(sizing.TM6436801077).toBe(2.88);
    expect(sizing.TM6436485405).toBe(2.8);
  });
});

describe('faced3Bets cold 4-bet', () => {
  it('flags an entry where a third player re-raised before Hero answered', () => {
    // TM6390221998: open 480, 3-bet 1,280, cold 4-bet 3,700, Hero folds. Kept
    // in the list, but `response` answers two raises, not the 3-bet.
    const f = faced3Bets(MTT2).find((x) => x.id === 'TM6390221998')!;
    expect({ cold4Bet: f.cold4Bet, response: f.response }).toEqual({ cold4Bet: true, response: 'fold' });
    expect(faced3Bets(MTT2).find((x) => x.id === 'TM6436801077')!.cold4Bet).toBe(false);
  });
});
