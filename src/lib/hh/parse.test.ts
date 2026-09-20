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

/**
 * The dead-button rule: after a bust the button sits on an empty seat, so no
 * `Seat N:` line matches it. Hero is in seat 4 and posts the small blind.
 */
const DEAD_BUTTON = `Poker Hand #DB1: Tournament #999, Test $1 Hold'em No Limit - Level2(50/100(10)) - 2026/09/11 10:00:00
Table '1' 8-max Seat #3 is the button
Seat 1: p1 (10,000 in chips)
Seat 2: p2 (10,000 in chips)
Seat 4: Hero (6,000 in chips)
Seat 5: p5 (10,000 in chips)
p1: posts the ante 10
p2: posts the ante 10
Hero: posts the ante 10
p5: posts the ante 10
Hero: posts small blind 50
p5: posts big blind 100
*** HOLE CARDS ***
Dealt to p1 
Dealt to p2 
Dealt to Hero [Ah Qc]
Dealt to p5 
p1: folds
p2: folds
Hero: folds
Uncalled bet (50) returned to p5
*** SHOWDOWN ***
p5 collected 140 from pot
*** SUMMARY ***
Total pot 140 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
`;

/** Hero calls the river and loses. GGPoker prints a muck, never a shows line. */
const MUCKED = `Poker Hand #MK1: Tournament #999, Test $1 Hold'em No Limit - Level2(50/100(10)) - 2026/09/10 10:00:00
Table '1' 8-max Seat #4 is the button
Seat 1: p1 (10,000 in chips)
Seat 3: Villain (10,000 in chips)
Seat 4: Hero (10,000 in chips)
p1: posts the ante 10
Villain: posts the ante 10
Hero: posts the ante 10
p1: posts small blind 50
Villain: posts big blind 100
*** HOLE CARDS ***
Dealt to p1 
Dealt to Villain 
Dealt to Hero [Ah Qc]
Hero: raises 150 to 250
p1: folds
Villain: calls 150
*** FLOP *** [Kd 7c 2h]
Villain: checks
Hero: checks
*** TURN *** [Kd 7c 2h] [3s]
Villain: checks
Hero: checks
*** RIVER *** [Kd 7c 2h 3s] [9d]
Villain: bets 350
Hero: calls 350
Villain: shows [Kh Qd] (a pair of Kings)
Hero: mucks hand
*** SHOWDOWN ***
Villain collected 1,280 from pot
*** SUMMARY ***
Total pot 1,280 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
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

describe('a dead button', () => {
  it('labels seats from the first live seat past it, not by seat number', () => {
    const h = parseHands(DEAD_BUTTON).hands[0];
    expect(h.potMatches).toBe(true);
    // Falling back to raw seat order used to make Hero the lojack while he was
    // posting the small blind — and every other label was wrong with it.
    expect(h.position.Hero).toBe('SB');
    expect(h.position.p5).toBe('BB');
    expect(h.position.p1).toBe('CO');
    expect(h.position.p2).toBe('BTN');
  });
});

describe('heroHand', () => {
  it('counts a mucked river call as a showdown', () => {
    const parsed = parseHands(MUCKED).hands[0];
    expect(parsed.potMatches).toBe(true);
    const h = heroHand(parsed)!;
    // Hero shows when he wins and mucks when he loses, so reading `shows` made
    // every losing call-down vanish from WTSD and land on the red line.
    expect(h.showdown).toBe(true);
    expect(h.wonPot).toBe(false);
    expect(h.streetReached).toBe('river');
  });

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
