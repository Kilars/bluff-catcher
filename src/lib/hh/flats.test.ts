import { describe, expect, it } from 'vitest';

import { coldCalls } from './flats.ts';
import type { HeroHand } from './hero.ts';

/** A HeroHand with only the fields coldCalls reads; the rest are irrelevant here. */
function hero(over: Partial<HeroHand>): HeroHand {
  return {
    role: 'cold-call',
    position: 'CO',
    facingRaiserPos: 'HJ',
    cards: ['Ah', 'Jd'],
    stackBB: 80,
    limpersAhead: 0,
    ...over,
  } as HeroHand;
}

describe('coldCalls', () => {
  it('keeps only cold-call hands and maps them to blind facts', () => {
    const out = coldCalls([
      hero({ id: 'h1' }),
      hero({ id: 'h2', role: 'open' }),
      hero({ id: 'h3', role: 'fold' }),
      hero({ id: 'h4', role: 'blind-defend' }),
    ]);
    expect(out.map((c) => c.id)).toEqual(['h1']);
    expect(out[0]).toMatchObject({ position: 'CO', vsPos: 'HJ', hand: 'AJo', stackBB: 80, depth: 'deep' });
  });

  it('classifies depth from the stack and rounds it', () => {
    const out = coldCalls([
      hero({ id: 'deep', stackBB: 50.04 }),
      hero({ id: 'mid', stackBB: 22 }),
      hero({ id: 'short', stackBB: 9 }),
    ]);
    expect(out.map((c) => [c.id, c.depth, c.stackBB])).toEqual([
      ['deep', 'deep', 50],
      ['mid', 'mid', 22],
      ['short', 'short', 9],
    ]);
  });

  it('skips a cold-call with no recorded cards', () => {
    expect(coldCalls([hero({ id: 'x', cards: null })])).toEqual([]);
  });

  it('carries no result field', () => {
    const [c] = coldCalls([hero({ id: 'h1' })]);
    for (const k of Object.keys(c)) expect(k).not.toMatch(/net|won|invested|cost/i);
  });
});
