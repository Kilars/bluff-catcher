import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { bigSpots } from './bigspots.ts';
import { heroHand, type HeroHand } from './hero.ts';
import { parseHands, type Action } from './parse.ts';

function act(over: Partial<Action>): Action {
  return {
    street: 'preflop',
    player: 'Hero',
    kind: 'raise',
    amount: 0,
    allIn: false,
    potBefore: 0,
    toCall: 0,
    stackBefore: 1000,
    ...over,
  };
}

/** A HeroHand with only the fields bigSpots reads; results set to prove they're dropped. */
function hero(over: Partial<HeroHand>): HeroHand {
  return {
    id: 'h',
    position: 'BTN',
    role: 'open',
    pfa: true,
    cards: ['Ks', 'Qs'],
    bb: 10,
    stackBB: 100,
    grossBB: 10,
    board: ['Js', 'Ad', 'Th', '6s', '6h'],
    streetReached: 'flop',
    decisions: [],
    showdown: true,
    netBB: -50,
    won: 0,
    ...over,
  } as HeroHand;
}

describe('bigSpots', () => {
  it('ranks by chips committed, biggest first, and caps the list', () => {
    const out = bigSpots(
      [hero({ id: 'small', grossBB: 5 }), hero({ id: 'big', grossBB: 80 }), hero({ id: 'mid', grossBB: 30 })],
      2,
    );
    expect(out.map((s) => [s.id, s.committedBB])).toEqual([
      ['big', 80],
      ['mid', 30],
    ]);
  });

  it('names the cash chart as the depth of a cash hand', () => {
    expect(bigSpots([hero({ variant: 'cash', stackBB: 30 })])[0].depth).toBe('cash');
    expect(bigSpots([hero({ variant: 'mtt', stackBB: 30 })])[0].depth).toBe('mid');
  });

  it('stops the board at the last street Hero acted on', () => {
    const [s] = bigSpots([hero({ streetReached: 'flop' })]);
    expect(s.board).toEqual(['Js', 'Ad', 'Th']);
  });

  it('converts each decision to big blinds with pot odds and hand strength', () => {
    const [s] = bigSpots([
      hero({
        decisions: [
          act({ street: 'preflop', kind: 'raise', amount: 30, potBefore: 15, toCall: 10, raiseBy: 20 }),
          act({ street: 'flop', kind: 'call', amount: 50, potBefore: 150, toCall: 50 }),
        ],
      }),
    ]);
    expect(s.decisions[0]).toMatchObject({ street: 'preflop', amountBB: 3, potBB: 1.5, handClass: null });
    // Facing 50 with 150 already in (villain's bet included): 50 / 200 = 25%.
    expect(s.decisions[1]).toMatchObject({ amountBB: 5, potBB: 15, toCallBB: 5, equityNeeded: 25 });
    expect(s.decisions[1].handClass).toBe('strong'); // the nut straight on J-A-T
  });

  it('carries no result', () => {
    const [s] = bigSpots([hero({})]);
    for (const key of ['showdown', 'netBB', 'grossBB', 'won', 'streetReached', 'wonPot']) {
      expect(s).not.toHaveProperty(key);
    }
  });

  it('prices a call all-in for less against the pot Hero can win', () => {
    // RC4834985541: villain jams $123.79 over Hero's $59.76. The $64.03 Hero
    // cannot match stays in potBB (as printed) but not in the price: 29.0%,
    // where pricing it against the whole pot said 18.9%.
    // RC4854654350: the river shove reads 41.4%, not 21.9%.
    const text = readFileSync('src/lib/hh/fixtures/rc/short-calls.txt', 'utf8');
    const spots = bigSpots(parseHands(text).hands.map((h) => heroHand(h)!));
    const call = (id: string) =>
      spots.find((s) => s.id === id)!.decisions.find((d) => d.action === 'call')!;
    expect(call('RC4834985541')).toMatchObject({ potBB: 298.6, toCallBB: 69.5, equityNeeded: 29 });
    expect(call('RC4854654350')).toMatchObject({ street: 'river', equityNeeded: 41.4 });
  });
});

describe('bigSpots all-in', () => {
  it('reads a near-all-in bet the way the labels do', () => {
    // RC4835306771 river: $37.50 into $32.10 leaves $6 behind, under a tenth of
    // the pot — the labels call it a shove, so bigSpots must too.
    const text = readFileSync('src/lib/hh/fixtures/rc/round2.txt', 'utf8');
    const h = parseHands(text).hands.map((x) => heroHand(x)!).find((x) => x.id === 'RC4835306771')!;
    const river = bigSpots([h])[0].decisions.find((d) => d.street === 'river')!;
    expect(river).toMatchObject({ action: 'bet', allIn: true, sizing: null });
  });
});
