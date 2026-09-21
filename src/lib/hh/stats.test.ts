/**
 * Regression tests for the numbers a coach reads off the report.
 *
 * Every case here is a bug that shipped once. They share a shape — a stat
 * whose denominator quietly excludes or includes a whole population — and
 * none of them fails loudly: the report just prints a wrong percentage next
 * to a reference band, which is worse than printing nothing.
 */

import { describe, expect, it } from 'vitest';

import { parseHands } from './parse.ts';
import { heroHand, type HeroHand } from './hero.ts';
import { summarise } from './stats.ts';

/**
 * Four-handed, button on seat 4, so Hero is the big blind: p1 SB, Hero BB,
 * Villain CO, p4 BTN. Antes 4 × 10 + 50 + 100 = 190 in before the first act.
 */
function hand(id: string, body: string, totalPot: number): string {
  return `Poker Hand #${id}: Tournament #900, Test $1 Hold'em No Limit - Level2(50/100(10)) - 2026/09/14 10:00:00
Table '1' 8-max Seat #4 is the button
Seat 1: p1 (10,000 in chips)
Seat 2: Hero (10,000 in chips)
Seat 3: Villain (10,000 in chips)
Seat 4: p4 (10,000 in chips)
p1: posts the ante 10
Hero: posts the ante 10
Villain: posts the ante 10
p4: posts the ante 10
p1: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to p1 
Dealt to Hero [7h 2c]
Dealt to Villain 
Dealt to p4 
Villain: raises 150 to 250
p4: folds
p1: folds
Hero: calls 150
${body}
*** SUMMARY ***
Total pot ${totalPot.toLocaleString('en-US')} | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
`;
}

/** Hero checks the flop and folds to the c-bet — out of position, facing a bet. */
const CHECK_FOLD = hand(
  'CF1',
  `*** FLOP *** [Kd 8c 3h]
Hero: checks
Villain: bets 300
Hero: folds
Uncalled bet (300) returned to Villain
*** SHOWDOWN ***
Villain collected 590 from pot`,
  590,
);

/** Hero bets the flop first and folds to the raise. Never faced a c-bet. */
const DONK_FOLD = hand(
  'DK1',
  `*** FLOP *** [Kd 8c 3h]
Hero: bets 200
Villain: raises 400 to 600
Hero: folds
Uncalled bet (400) returned to Villain
*** SHOWDOWN ***
Villain collected 990 from pot`,
  990,
);

/** Nobody bets the flop, so there was never anything to check-raise. */
const CHECK_THROUGH = hand(
  'CT1',
  `*** FLOP *** [Kd 8c 3h]
Hero: checks
Villain: checks
*** TURN *** [Kd 8c 3h] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Kd 8c 3h 4s] [9d]
Hero: checks
Villain: checks
Villain: shows [Ah Kh] (a pair of Kings)
Hero: mucks hand
*** SHOWDOWN ***
Villain collected 590 from pot`,
  590,
);

/** Hero calls the river and loses. GGPoker prints a muck, never a shows line. */
const MUCKED = hand(
  'MK1',
  `*** FLOP *** [Kd 8c 3h]
Hero: checks
Villain: checks
*** TURN *** [Kd 8c 3h] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Kd 8c 3h 4s] [9d]
Villain: bets 350
Hero: calls 350
Villain: shows [Ah Kh] (a pair of Kings)
Hero: mucks hand
*** SHOWDOWN ***
Villain collected 1,290 from pot`,
  1290,
);

/** Villain folds to Hero's turn bet and flashes the hand. Nobody showed down. */
const FLASHED_FOLD = hand(
  'FS1',
  `*** FLOP *** [Kd 8c 3h]
Hero: checks
Villain: checks
*** TURN *** [Kd 8c 3h] [4s]
Hero: bets 200
Villain: folds
Villain: shows [5h 4c]
Uncalled bet (200) returned to Hero
*** SHOWDOWN ***
Hero collected 590 from pot`,
  590,
);

function read(...texts: string[]): HeroHand[] {
  return texts.map((t) => {
    const parsed = parseHands(t).hands[0];
    // A fixture whose pot does not reconcile would be excluded from the real
    // archive, so a stat computed off one proves nothing.
    expect(parsed.potMatches, `${parsed.id} pot`).toBe(true);
    return heroHand(parsed)!;
  });
}

function stat(hands: HeroHand[], key: string): string {
  const s = summarise(hands).stats.find((x) => x.key === key)!;
  return `${s.made}/${s.opp}`;
}

describe('showdown', () => {
  it('counts a mucked river call', () => {
    expect(read(MUCKED)[0].showdown).toBe(true);
  });

  it('does not count an opponent who folds and flashes', () => {
    // "anyone showed" books an uncontested win to the blue line — the same
    // error as "Hero showed", inverted.
    expect(read(FLASHED_FOLD)[0].showdown).toBe(false);
  });

  it('puts a losing call-down on the blue line and a bet-them-off win on the red', () => {
    expect(summarise(read(MUCKED)).showdownBB).toBeLessThan(0);
    expect(summarise(read(MUCKED)).nonShowdownBB).toBe(0);
    expect(summarise(read(FLASHED_FOLD)).showdownBB).toBe(0);
    expect(summarise(read(FLASHED_FOLD)).nonShowdownBB).toBeGreaterThan(0);
  });
});

describe('fold to flop c-bet', () => {
  it('counts a check-fold out of position', () => {
    // facedBet asks "was a bet made before Hero's first action", which is
    // false here — and dropped the commonest version of the spot entirely.
    expect(stat(read(CHECK_FOLD), 'foldToCbetFlop')).toBe('1/1');
  });

  it('ignores a donk bet that folds to a raise', () => {
    expect(stat(read(DONK_FOLD), 'foldToCbetFlop')).toBe('0/0');
  });

  it('keeps both in the same window', () => {
    expect(stat(read(CHECK_FOLD, DONK_FOLD), 'foldToCbetFlop')).toBe('1/1');
  });
});

describe('check-raise flop', () => {
  it('ignores a flop that checks through', () => {
    expect(stat(read(CHECK_THROUGH), 'checkRaiseFlop')).toBe('0/0');
  });

  it('counts a check that faced a bet', () => {
    expect(stat(read(CHECK_FOLD), 'checkRaiseFlop')).toBe('0/1');
  });
});
