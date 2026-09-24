import { describe, expect, it } from 'vitest';

import { decisionsOf } from './decisions.ts';
import { heroHand } from './hero.ts';
import { parseHands } from './parse.ts';

/**
 * Heads-up, with every sizing shape in one hand and the pots picked so the
 * fractions are exact:
 *
 *   preflop  Hero limps the small blind             pot   100
 *   flop     Villain bets 100, Hero raises to 300   pot   700   raise 200/300
 *   turn     Hero bets 350 into 700                 pot 1,400   bet   350/700
 *   river    Hero jams the last 9,300               pot 1,400   no chosen size
 */
const HAND = `Poker Hand #DC1: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level3(25/50) - 2026/09/09 21:00:00
Table '7' 8-max Seat #4 is the button
Seat 2: Villain (10,000 in chips)
Seat 4: Hero (10,000 in chips)
Hero: posts small blind 25
Villain: posts big blind 50
*** HOLE CARDS ***
Dealt to Villain
Dealt to Hero [Jh Th]
Hero: calls 25
Villain: checks
*** FLOP *** [9h 8c 2d]
Villain: bets 100
Hero: raises 200 to 300
Villain: calls 200
*** TURN *** [9h 8c 2d] [4s]
Villain: checks
Hero: bets 350
Villain: calls 350
*** RIVER *** [9h 8c 2d 4s] [Kc]
Villain: checks
Hero: bets 9,300 and is all-in
Villain: folds
Uncalled bet (9,300) returned to Hero
*** SHOWDOWN ***
Hero collected 1,400 from pot
*** SUMMARY ***
Total pot 1,400 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [9h 8c 2d 4s Kc]
`;

describe('decisionsOf', () => {
  const parsed = parseHands(HAND).hands[0];
  const ds = decisionsOf(heroHand(parsed)!);
  const [pre, flop, turn, river] = ds;

  it('reads the fixture the way the comment claims', () => {
    expect(parsed.potMatches).toBe(true);
    expect(ds.map((d) => `${d.street}:${d.kind}`)).toEqual([
      'preflop:call',
      'flop:raise',
      'turn:bet',
      'river:bet',
    ]);
  });

  it('sizes a raise over the call, not to it', () => {
    // Villain bet 100 into 100, so Hero is putting 200 in over a 100 call and
    // the pot that call makes is 300. Reading `Action.to` instead gives
    // 300/300 = 1.00, because `to` includes the call — every raise bucket in
    // the report would shift one notch bigger.
    const raise = parsed.actions.find((a) => a.player === 'Hero' && a.kind === 'raise')!;
    expect(raise.to! / (raise.potBefore + raise.toCall)).toBe(1);
    expect(flop.sizing).toBeCloseTo(0.67, 2);
    expect(flop.facedBet).toBe(true);
  });

  it('sizes the faced bet on the same scale as the chosen one', () => {
    // Villain bet 100 into 100 — a pot-sized bet — so it reads 1.0 from Hero's
    // seat too, even though `potBefore` (200) already contains it. A spot with
    // no bet faced carries null, not a zero that maths would treat as free.
    expect(flop.facedSizing).toBe(1);
    expect(pre.facedSizing).toBeNull();
    expect(turn.facedSizing).toBeNull();
  });

  it('never sizes a bet as NaN', () => {
    // `to` is undefined on a bet, and `undefined / n` is NaN — which compares
    // false against every bucket threshold and so vanishes without erroring.
    expect(turn.sizing).toBe(0.5);
    for (const d of ds) expect(d.sizing, `${d.street} ${d.kind}`).not.toBeNaN();
  });

  it('carries the all-in but leaves its denominators alone', () => {
    // The jam is 6.6x the pot, but Hero did not pick 6.6x — the stack did.
    expect({ allIn: river.allIn, sizing: river.sizing }).toEqual({ allIn: true, sizing: null });
    expect(flop.allIn).toBe(false);
  });

  it('does not count a forced blind as a bet faced', () => {
    // `toCall > 0` is true of every preflop action but a walked big blind, so
    // testing that would have called this limp — and every open — a call
    // facing a bet.
    expect(pre.facedBet).toBe(false);
    expect({ position: pre.position, stackBB: pre.stackBB, spr: flop.spr }).toEqual({
      position: 'SB/BTN',
      stackBB: 200,
      spr: 99.5,
    });
  });

  it('tells the agent nothing about what the hand returned', () => {
    // The same sweep `doc.test.ts` runs over the payload, at the source.
    const keys = JSON.stringify(ds).match(/"(\w+)"\s*:/g) ?? [];
    expect(keys.filter((k) => /net|won|invested|cost|BB/i.test(k) && !/stackBB/.test(k))).toEqual(
      [],
    );
  });
});
