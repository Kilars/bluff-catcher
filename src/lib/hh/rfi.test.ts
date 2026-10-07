import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { heroHand, type HeroHand } from './hero.ts';
import { parseHands } from './parse.ts';
import { chartKeyForHand, rfiFolds } from './rfi.ts';

/** A first-in fold with only the fields rfiFolds reads; the rest are irrelevant here. */
function hero(over: Partial<HeroHand>): HeroHand {
  return {
    id: 'h',
    variant: 'cash',
    role: 'fold',
    firstInOpp: true,
    limpersAhead: 0,
    playersDealt: 6,
    position: 'BTN',
    seatsToButton: 0,
    cards: ['Kh', '8c'],
    stackBB: 100,
    ...over,
  } as HeroHand;
}

describe('rfiFolds — cash reads the cash chart', () => {
  it('does not flag what the 6-max 100bb chart folds', () => {
    // The 2026-10-06 repro: the 9-max ante chart opens all three, and is 7–10
    // points wider than the cash chart at every seat — far past the band.
    expect(
      rfiFolds([
        hero({ id: 'k6', position: 'BTN', cards: ['Kh', '6c'], stackBB: 118.8 }),
        hero({ id: 'j8', position: 'BTN', cards: ['8c', 'Jd'], stackBB: 107.3 }),
        hero({ id: '76', position: 'LJ', seatsToButton: 3, cards: ['6c', '7c'], stackBB: 117.3 }),
      ]),
    ).toEqual([]);
  });

  it('flags a fold the cash chart opens, named by its own chart', () => {
    expect(rfiFolds([hero({ id: 'k8', cards: ['Kh', '8c'], stackBB: 122 })])).toEqual([
      {
        id: 'k8',
        position: 'BTN',
        hand: 'K8o',
        cards: ['Kh', '8c'],
        stackBB: 122,
        depth: 'cash',
        action: 'an open',
        caveat: null,
      },
    ]);
  });

  it('keeps the tolerance band, computed on the cash chart', () => {
    expect(rfiFolds([hero({ cards: ['Ah', '3c'] })])).toEqual([]);
  });

  it('carries no between-charts caveat for a cash stack', () => {
    // 28–45bb names the 20bb and 60bb tournament charts; cash has one chart.
    const [f] = rfiFolds([hero({ cards: ['Kh', '8c'], stackBB: 35 })]);
    expect(f).toMatchObject({ depth: 'cash', caveat: null });
  });

  it('checks a small-blind fold first in against the cash SB range', () => {
    expect(rfiFolds([hero({ position: 'SB', seatsToButton: 5, cards: ['Kh', '9c'] })])).toMatchObject([
      { position: 'SB', hand: 'K9o', depth: 'cash' },
    ]);
    // Inside the SB band.
    expect(rfiFolds([hero({ position: 'SB', seatsToButton: 5, cards: ['8c', '9h'] })])).toEqual([]);
  });

  it('reads a 7+-handed early seat as the lojack, the tightest cash seat', () => {
    const [f] = rfiFolds([hero({ position: 'UTG', seatsToButton: 4, cards: ['Ah', 'Kd'] })]);
    expect(f).toMatchObject({ position: 'LJ', depth: 'cash' });
  });

  it('agrees end to end on the archived hands', () => {
    // RC4857717961 BTN K6o, RC4857718298 BTN J8o, RC4857718073 LJ 76s are
    // quiet; RC4834993430 BTN K8o is a real chart fold.
    const text = readFileSync('src/lib/hh/fixtures/rc/preflop.txt', 'utf8');
    const hs = parseHands(text).hands.map((h) => heroHand(h)!);
    expect(hs).toHaveLength(5);
    expect(rfiFolds(hs).map((f) => [f.id, f.position, f.hand, f.depth])).toEqual([
      ['RC4834993430', 'BTN', 'K8o', 'cash'],
    ]);
  });
});

describe('rfiFolds — tournaments', () => {
  const mtt = (over: Partial<HeroHand>) =>
    hero({ variant: 'mtt', playersDealt: 9, stackBB: 80, ...over });

  it('still reads the deep chart at 60bb+', () => {
    const [f] = rfiFolds([mtt({ position: 'LJ', seatsToButton: 3, cards: ['7h', '6h'] })]);
    expect(f).toMatchObject({ position: 'LJ', hand: '76s', depth: 'deep', action: 'an open' });
  });

  it('keeps the between-charts caveat', () => {
    const [f] = rfiFolds([mtt({ cards: ['Kh', '8c'], stackBB: 35 })]);
    expect(f.caveat).toMatch(/between the 20bb and 60bb charts/);
  });

  it('has no small-blind chart', () => {
    expect(rfiFolds([mtt({ position: 'SB', seatsToButton: 8, cards: ['Kh', '9c'] })])).toEqual([]);
  });

  it('maps early seats by distance from the button, not by label', () => {
    // positionNames counts early seats from the front, so a 7-handed UTG has
    // four players behind it: the 9-max UTG+2, not the UTG chart.
    const at = (position: string, seatsToButton: number, cards: string[]) =>
      rfiFolds([mtt({ position, seatsToButton, cards })])[0]?.position ?? null;
    expect(at('UTG', 4, ['Jh', '8h'])).toBe('UTG2'); // 7-handed
    expect(at('UTG', 5, ['9h', '8h'])).toBe('UTG1'); // 8-handed
    expect(at('UTG', 6, ['Jh', '8h'])).toBeNull(); // 9-handed: UTG folds J8s
    expect(at('UTG3', 4, ['Jh', '8h'])).toBe('UTG2'); // 10-handed: the latest early seat
  });
});

describe('chartKeyForHand', () => {
  it('names the cash chart for cash and a tournament tier otherwise', () => {
    expect(chartKeyForHand(hero({ variant: 'cash', stackBB: 30 }))).toBe('cash');
    expect(chartKeyForHand(hero({ variant: 'mtt', stackBB: 30 }))).toBe('mid');
    expect(chartKeyForHand(hero({ variant: 'mtt', stackBB: 80 }))).toBe('deep');
  });
});
