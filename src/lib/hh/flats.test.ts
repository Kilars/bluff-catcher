import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { coldCalls } from './flats.ts';
import { heroHand, type HeroHand } from './hero.ts';
import { parseHands } from './parse.ts';

/** A HeroHand with only the fields coldCalls reads; the rest are irrelevant here. */
function hero(over: Partial<HeroHand>): HeroHand {
  return {
    role: 'cold-call',
    position: 'CO',
    facingRaiserPos: 'HJ',
    cards: ['Ah', 'Jd'],
    stackBB: 80,
    limpersAhead: 0,
    facingRaises: 1,
    openerPos: 'HJ',
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

  it('names the cash chart for a cash hand, not a tournament tier', () => {
    const [c] = coldCalls([hero({ id: 'rc', variant: 'cash', stackBB: 110 })]);
    expect(c.depth).toBe('cash');
  });

  it('says how many raises were in, and who opened a pot that was 3-bet', () => {
    const out = coldCalls([
      hero({ id: 'vs-open' }),
      hero({ id: 'vs-3bet', facingRaises: 2, facingRaiserPos: 'HJ', openerPos: 'LJ' }),
    ]);
    expect(out.map((c) => [c.id, c.facingRaises, c.vsPos, c.openerPos])).toEqual([
      ['vs-open', 1, 'HJ', null],
      ['vs-3bet', 2, 'HJ', 'LJ'],
    ]);
  });

  it('reads a cold-call of a 3-bet off the archived hand', () => {
    // RC4857719751: LJ opens, HJ 3-bets, Hero flats on the button. Without the
    // raise count it read exactly like "BTN flats an HJ open".
    const text = readFileSync('src/lib/hh/fixtures/rc/preflop.txt', 'utf8');
    const h = parseHands(text).hands.find((x) => x.id === 'RC4857719751')!;
    const [c] = coldCalls([heroHand(h)!]);
    expect(c).toMatchObject({
      position: 'BTN',
      vsPos: 'HJ',
      openerPos: 'LJ',
      facingRaises: 2,
      hand: '66',
      depth: 'cash',
    });
  });
});
