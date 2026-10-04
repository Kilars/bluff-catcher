import { describe, expect, it } from 'vitest';

import { bigSpots } from './bigspots.ts';
import type { HeroHand } from './hero.ts';
import type { Action } from './parse.ts';

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
});
