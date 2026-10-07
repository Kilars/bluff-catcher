import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { callablePot, decisionsOf, shoved, sizing } from './decisions.ts';
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

/**
 * RC4854654350 and RC4834985541, verbatim: a villain who covers Hero bets more
 * than Hero has, and Hero calls all-in for less. `toCall` is capped at Hero's
 * stack, but `potBefore` still holds the whole bet — including the part Hero can
 * never win, which comes back uncalled. Pricing the capped call against the
 * uncapped pot made a 2.4x-pot shove read as a 39% bet.
 */
const SHORT_CALLS = readFileSync('src/lib/hh/fixtures/rc/short-calls.txt', 'utf8');

describe('a call all-in for less than the bet', () => {
  const [river, pre] = parseHands(SHORT_CALLS).hands;

  it('keeps the uncallable excess out of the pot Hero is priced against', () => {
    const call = river.actions.find((a) => a.player === 'Hero' && a.street === 'river')!;
    // $17.85 before the bet, villain's $135.08 in, $92.25 of it out of reach.
    expect({ potBefore: call.potBefore, toCall: call.toCall, potCallable: call.potCallable }).toEqual({
      potBefore: 15293,
      toCall: 4283,
      potCallable: 6068,
    });
    expect(callablePot(call)).toBe(6068);
  });

  it('sizes the faced shove against the pot it bet into', () => {
    const d = decisionsOf(heroHand(river)!).find((x) => x.street === 'river')!;
    // 42.83 / 17.85 — a 2.4x-pot bet as far as Hero's stack is concerned.
    expect(d.facedSizing).toBeCloseTo(2.4, 2);
    // enrich's g/(1+2g) then reduces to toCall / (callable pot + toCall).
    const g = d.facedSizing!;
    expect(g / (1 + 2 * g)).toBeCloseTo(4283 / (6068 + 4283), 6);
  });

  it('applies to a preflop jam over a 4-bet too', () => {
    const call = pre.actions.find((a) => a.player === 'Hero' && a.kind === 'call')!;
    // Villain's $123.79 against Hero's $59.76: $64.03 is never in play.
    expect(call.potBefore - callablePot(call)).toBe(6403);
    expect(call.toCall / (callablePot(call) + call.toCall)).toBeCloseTo(0.29, 2);
  });

  it('leaves a call Hero covers alone', () => {
    const parsed = parseHands(HAND).hands[0];
    for (const a of parsed.actions) {
      expect(a.potCallable, `${a.street} ${a.player} ${a.kind}`).toBeUndefined();
      expect(callablePot(a)).toBe(a.potBefore);
    }
  });
});

/**
 * Heads-up with Hero covering a short villain by ten times:
 *
 *   preflop  Hero raises to 300, Villain calls        pot   600
 *   flop     Hero bets 200, Villain calls             pot 1,000   Villain 700 behind
 *   turn     Hero bets 500, Villain calls all-in      pot 2,000
 *
 * Only Villain's 700 can ever go in on the flop, so the pot is already more than
 * half the effective stack — committed, whatever Hero's own 9,700 says.
 */
const COVERED = `Poker Hand #SP1: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level3(50/100) - 2026/09/09 21:00:00
Table '7' 8-max Seat #4 is the button
Seat 2: Villain (1,000 in chips)
Seat 4: Hero (10,000 in chips)
Hero: posts small blind 50
Villain: posts big blind 100
*** HOLE CARDS ***
Dealt to Villain
Dealt to Hero [Ah Kh]
Hero: raises 200 to 300
Villain: calls 200
*** FLOP *** [9h 8c 2d]
Villain: checks
Hero: bets 200
Villain: calls 200
*** TURN *** [9h 8c 2d] [4s]
Villain: checks
Hero: bets 500
Villain: calls 500 and is all-in
*** RIVER *** [9h 8c 2d 4s] [Kc]
Villain: shows [Qd Qs] (a pair of Queens)
Hero: shows [Ah Kh] (a pair of Kings)
*** SHOWDOWN ***
Hero collected 2,000 from pot
*** SUMMARY ***
Total pot 2,000 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [9h 8c 2d 4s Kc]
`;

describe('spr', () => {
  const parsed = parseHands(COVERED).hands[0];
  const h = heroHand(parsed)!;
  const street = (s: string) => h.streets.find((x) => x.street === s)!;

  it('measures the stack that can actually go in, not Hero’s own', () => {
    expect(parsed.potMatches).toBe(true);
    // min(9,700 Hero, 700 Villain) / 600, not 9,700 / 600 = 16.2.
    expect(street('flop').spr).toBeCloseTo(700 / 600, 6);
    expect(street('turn').spr).toBeCloseTo(500 / 1000, 6);
    // stackAtStart stays Hero's own.
    expect(street('flop').stackAtStart).toBe(9700);
  });

  it('carries the effective figure into each decision', () => {
    const flop = decisionsOf(h).find((d) => d.street === 'flop')!;
    expect(flop.spr).toBeCloseTo(700 / 600, 6);
  });

  it('ignores an opponent who folded on an earlier street', () => {
    // Three-way: the 50,000 stack folds preflop, so the cover it would give
    // is not in play on the flop.
    const text = COVERED.replace(
      'Seat 4: Hero (10,000 in chips)',
      'Seat 3: Whale (50,000 in chips)\nSeat 4: Hero (10,000 in chips)',
    )
      .replace('Dealt to Hero [Ah Kh]', 'Dealt to Whale\nDealt to Hero [Ah Kh]')
      .replace('Hero: raises 200 to 300', 'Whale: folds\nHero: raises 200 to 300');
    const three = heroHand(parseHands(text).hands[0])!;
    expect(three.streets.find((s) => s.street === 'flop')!.spr).toBeCloseTo(700 / 600, 6);
  });
});

/**
 * A bet bigger than any live opponent can match: RC4848809818's turn jam is
 * $45.11 into $36.77, but the villain has $34.27 behind. The part above that
 * comes back uncalled, so the bet anyone could call is 0.93 pot, not 1.23.
 */
const ROUND2 = readFileSync('src/lib/hh/fixtures/rc/round2.txt', 'utf8');
const MTT_ROUND2 = readFileSync('src/lib/hh/fixtures/mtt/round2.txt', 'utf8');

describe('a bet that covers every opponent', () => {
  const hand = (text: string, id: string) => parseHands(text).hands.find((h) => h.id === id)!;

  it('records how far the deepest live opponent can follow it', () => {
    const p = hand(ROUND2, 'RC4848809818');
    const jam = p.actions.find((a) => a.player === 'Hero' && a.street === 'turn')!;
    expect(jam.coverBehind).toBe(3427 - 4511);
    expect(sizing(jam)).toBeCloseTo(3427 / 3677, 6);
    expect(shoved(jam)).toBe(true);
  });

  it('leaves a bet an opponent covers alone', () => {
    const p = hand(ROUND2, 'RC4848809818');
    const raise = p.actions.find((a) => a.player === 'Hero' && a.street === 'flop' && a.kind === 'raise')!;
    // Hero covers the villain, but the raise is well inside the villain's stack.
    expect(raise.coverBehind).toBe(5203 - 550 - 1226);
    expect(sizing(raise)).toBeCloseTo(raise.raiseBy! / (raise.potBefore + raise.toCall), 6);
    // Equal stacks: nobody's bet can outreach the other.
    for (const a of parseHands(HAND).hands[0].actions) {
      expect(a.coverBehind, `${a.street} ${a.player} ${a.kind}`).toBeUndefined();
    }
  });

  it('calls a bet that puts every opponent all-in a shove, whatever its size', () => {
    // TM6393633319: 9,600 into 39,200 against a villain with 519 behind. No
    // size was chosen — the bet just gets the last chips in.
    const d = decisionsOf(heroHand(hand(MTT_ROUND2, 'TM6393633319'))!).find((x) => x.street === 'flop')!;
    expect(d.allIn).toBe(true);
    expect(d.sizing).toBeNull();
  });
});
