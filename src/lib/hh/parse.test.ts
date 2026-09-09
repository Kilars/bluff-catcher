import { describe, expect, it } from 'vitest';

import { parseHands, positionNames } from './parse.ts';
import { heroHand } from './hero.ts';

/**
 * A real-shaped hand with the numbers worked out by hand, so the pot check is
 * a genuine assertion rather than a tautology:
 *
 *   antes    8 x 45                          =    360
 *   blinds   175 + 350                       =    525
 *   preflop  Villain 875 + Hero 875          =  1,750
 *   flop     1,050 x 2                       =  2,100
 *   turn     2,368 x 2                       =  4,736
 *   river    22,722 + 13,756 - 8,966 back    = 27,512
 *                                             ───────
 *                                              36,983
 */
const HAND = `Poker Hand #TM1: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level7(175/350(45)) - 2026/09/08 20:03:09
Table '19' 8-max Seat #6 is the button
Seat 1: p1 (11,405 in chips)
Seat 2: p2 (5,155 in chips)
Seat 3: Villain (27,060 in chips)
Seat 4: p4 (18,250 in chips)
Seat 5: p5 (10,295 in chips)
Seat 6: Hero (18,094 in chips)
Seat 7: p7 (7,485 in chips)
Seat 8: p8 (9,910 in chips)
Hero: posts the ante 45
Villain: posts the ante 45
p8: posts the ante 45
p4: posts the ante 45
p2: posts the ante 45
p7: posts the ante 45
p5: posts the ante 45
p1: posts the ante 45
p7: posts small blind 175
p8: posts big blind 350
*** HOLE CARDS ***
Dealt to p1 
Dealt to p2 
Dealt to Villain 
Dealt to p4 
Dealt to p5 
Dealt to Hero [4s Ac]
Dealt to p7 
Dealt to p8 
p1: folds
p2: folds
Villain: raises 525 to 875
p4: folds
p5: folds
Hero: calls 875
p7: folds
p8: folds
*** FLOP *** [3h 2c As]
Villain: bets 1,050
Hero: calls 1,050
*** TURN *** [3h 2c As] [2d]
Villain: bets 2,368
Hero: calls 2,368
*** RIVER *** [3h 2c As 2d] [8s]
Villain: bets 22,722 and is all-in
Hero: calls 13,756 and is all-in
Uncalled bet (8,966) returned to Villain
Villain: shows [Ad Kh] (two pair, Aces and Twos)
Hero: shows [4s Ac] (two pair, Aces and Twos)
*** SHOWDOWN ***
Villain collected 36,983 from pot
*** SUMMARY ***
Total pot 36,983 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [3h 2c As 2d 8s]
Seat 6: Hero (button) showed [4s Ac] and lost with two pair, Aces and Twos
`;

/** Hero 3-bets a lone open from the big blind and takes it down. */
const THREEBET = `Poker Hand #TM2: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level5(100/200(25)) - 2026/09/08 19:30:00
Table '19' 8-max Seat #4 is the button
Seat 3: Villain (10,000 in chips)
Seat 4: p4 (10,000 in chips)
Seat 5: p5 (10,000 in chips)
Seat 6: Hero (10,000 in chips)
Villain: posts the ante 25
p4: posts the ante 25
p5: posts the ante 25
Hero: posts the ante 25
p5: posts small blind 100
Hero: posts big blind 200
*** HOLE CARDS ***
Dealt to Villain 
Dealt to p4 
Dealt to p5 
Dealt to Hero [Ks Kd]
Villain: raises 200 to 400
p4: folds
p5: folds
Hero: raises 800 to 1,200
Villain: folds
Uncalled bet (800) returned to Hero
*** SHOWDOWN ***
Hero collected 1,000 from pot
*** SUMMARY ***
Total pot 1,000 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
`;

describe('positionNames', () => {
  it('labels an 8-handed pot in preflop action order', () => {
    expect(positionNames(8)).toEqual(['SB', 'BB', 'UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN']);
  });

  it('drops early seats as the table shrinks', () => {
    expect(positionNames(6)).toEqual(['SB', 'BB', 'LJ', 'HJ', 'CO', 'BTN']);
    expect(positionNames(4)).toEqual(['SB', 'BB', 'CO', 'BTN']);
    expect(positionNames(2)).toEqual(['SB/BTN', 'BB']);
  });
});

describe('parseHands', () => {
  const { hands, skipped } = parseHands(HAND);
  const h = hands[0];

  it('parses one hand with no skipped blocks', () => {
    expect(skipped).toEqual([]);
    expect(hands).toHaveLength(1);
  });

  it('reads the header', () => {
    expect(h.id).toBe('TM1');
    expect(h.tournamentId).toBe('310296737');
    expect({ sb: h.sb, bb: h.bb, ante: h.ante, level: h.level }).toEqual({
      sb: 175,
      bb: 350,
      ante: 45,
      level: 7,
    });
  });

  it('rebuilds the pot to the printed total', () => {
    expect(h.computedPot).toBe(36983);
    expect(h.totalPot).toBe(36983);
    expect(h.potMatches).toBe(true);
  });

  it('treats "raises A to B" as a raise to B, not a bet of A', () => {
    const raise = h.actions.find((a) => a.kind === 'raise')!;
    expect(raise.raiseBy).toBe(525);
    expect(raise.to).toBe(875);
    // Villain had nothing in yet, so the chips that actually move are 875.
    expect(raise.amount).toBe(875);
  });

  it('detects Hero from the only face-up Dealt line', () => {
    expect(h.hero).toBe('Hero');
    expect(h.heroCards).toEqual(['4s', 'Ac']);
  });

  it('assigns positions from the button', () => {
    expect(h.position.Hero).toBe('BTN');
    expect(h.position.p7).toBe('SB');
    expect(h.position.p8).toBe('BB');
    expect(h.position.Villain).toBe('LJ');
  });

  it('nets the returned uncalled bet out of the raiser stake', () => {
    expect(h.invested.Hero).toBe(18094);
    expect(h.invested.Villain).toBe(18094);
    expect(h.won.Villain).toBe(36983);
  });

  it('accumulates the board street by street', () => {
    expect(h.board).toEqual(['3h', '2c', 'As', '2d', '8s']);
    expect(h.streets).toEqual(['preflop', 'flop', 'turn', 'river']);
  });

  it('tracks what each call cost against the pot it was facing', () => {
    const river = h.actions.find((a) => a.player === 'Hero' && a.street === 'river')!;
    expect(river.potBefore).toBe(32193);
    // Capped at Hero's remaining stack, not Villain's full jam.
    expect(river.toCall).toBe(13756);
  });
});

describe('heroHand', () => {
  it('classifies a flat of a single raise as a cold-call', () => {
    const h = heroHand(parseHands(HAND).hands[0])!;
    expect(h.role).toBe('cold-call');
    expect(h.threeBetOpp).toBe(true);
    expect(h.threeBet).toBe(false);
    expect(h.vpip).toBe(true);
    expect(h.pfr).toBe(false);
    expect(h.sawFlop).toBe(true);
    expect(h.streetReached).toBe('river');
    expect(h.showdown).toBe(true);
    expect(h.net).toBe(-18094);
    expect(h.netBB).toBeCloseTo(-51.7, 1);
  });

  it('classifies a raise over a lone open as a 3-bet', () => {
    const h = heroHand(parseHands(THREEBET).hands[0])!;
    expect(h.role).toBe('3bet');
    expect(h.threeBet).toBe(true);
    expect(h.pfr).toBe(true);
    expect(h.position).toBe('BB');
    // 25 ante + 200 blind + 1,000 raise, minus the 800 that came back.
    expect(h.invested).toBe(425);
    expect(h.won).toBe(1000);
    // Four-handed, button in seat 4: Villain is the CO, so this doubles as a
    // big-blind defence against a steal.
    expect(h.stealDefenceOpp).toBe(true);
    expect(h.stealDefence).toBe('3bet');
  });
});
