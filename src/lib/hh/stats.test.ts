/**
 * Regression tests for the numbers a coach reads off the report.
 *
 * Every case here is a bug that shipped once. They share a shape — a stat
 * whose denominator quietly excludes or includes a whole population — and
 * none of them fails loudly: the report just prints a wrong percentage next
 * to a reference band, which is worse than printing nothing.
 */

import { readFileSync } from 'node:fs';

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

describe('biggest calls', () => {
  it('prices a call all-in for less against the pot Hero can win', () => {
    // RC4834985541 / RC4854654350: the bettor covers Hero, and the excess Hero
    // cannot match is not part of what the call buys.
    const text = readFileSync('src/lib/hh/fixtures/rc/short-calls.txt', 'utf8');
    const hs = parseHands(text).hands.map((h) => heroHand(h)!);
    const odds = Object.fromEntries(summarise(hs).biggestCalls.map((c) => [c.hand.id, c.potOdds]));
    expect(odds.RC4834985541).toBeCloseTo(0.29, 2);
    expect(odds.RC4854654350).toBeCloseTo(0.414, 3);
  });
});

/** Three-handed, button on seat 3, no antes: seat 1 SB, seat 2 BB, seat 3 BTN. */
function threeHanded(id: string, seats: [string, string, string], body: string, totalPot: number): string {
  return `Poker Hand #${id}: Tournament #900, Test $1 Hold'em No Limit - Level2(50/100) - 2026/09/14 10:00:00
Table '1' 8-max Seat #3 is the button
Seat 1: ${seats[0]}
Seat 2: ${seats[1]}
Seat 3: ${seats[2]}
${body}
*** SUMMARY ***
Total pot ${totalPot.toLocaleString('en-US')} | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
`;
}

/** Hero opens the button all-in for 5bb and the big blind re-shoves. No decision follows. */
const JAM_RESHOVED = threeHanded(
  'JR1',
  ['p1 (10,000 in chips)', 'Villain (10,000 in chips)', 'Hero (500 in chips)'],
  `p1: posts small blind 50
Villain: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Kh 9c]
Hero: raises 400 to 500 and is all-in
p1: folds
Villain: raises 9,500 to 10,000 and is all-in
Uncalled bet (9,500) returned to Villain
Villain: shows [As Ad]
Hero: shows [Kh 9c]
*** FLOP *** [2c 7d Jh]
*** TURN *** [2c 7d Jh] [3s]
*** RIVER *** [2c 7d Jh 3s] [4c]
*** SHOWDOWN ***
Villain collected 1,050 from pot`,
  1050,
);

/** Hero 3-bets the small blind, gets 4-bet, folds. A fold to a 4-bet. */
const FOLD_TO_4BET = threeHanded(
  'F4',
  ['Hero (10,000 in chips)', 'p2 (10,000 in chips)', 'Villain (10,000 in chips)'],
  `Hero: posts small blind 50
p2: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ah 5h]
Villain: raises 150 to 250
Hero: raises 650 to 900
p2: folds
Villain: raises 1,400 to 2,300
Hero: folds
Uncalled bet (1,400) returned to Villain
*** SHOWDOWN ***
Villain collected 1,900 from pot`,
  1900,
);

/** Hero opens the button, the big blind 3-bets, Hero folds. */
const FOLD_TO_3BET = threeHanded(
  'F3',
  ['p1 (10,000 in chips)', 'Villain (10,000 in chips)', 'Hero (10,000 in chips)'],
  `p1: posts small blind 50
Villain: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Kh 9c]
Hero: raises 150 to 250
p1: folds
Villain: raises 650 to 900
Hero: folds
Uncalled bet (650) returned to Villain
*** SHOWDOWN ***
Villain collected 550 from pot`,
  550,
);

describe('fold to 3-bet', () => {
  it('has no spot when Hero’s own raise was all-in', () => {
    // Re-shoving over a jam leaves Hero nothing to decide, so it is not a
    // 3-bet faced — and was a denominator the stat could never satisfy.
    const [h] = read(JAM_RESHOVED);
    expect({ faced3Bet: h.faced3Bet, response: h.faced3BetResponse }).toEqual({
      faced3Bet: false,
      response: null,
    });
    expect(stat([h], 'foldTo3Bet')).toBe('0/0');
  });

  it('counts an open that folds to the 3-bet', () => {
    expect(stat(read(FOLD_TO_3BET), 'foldTo3Bet')).toBe('1/1');
  });

  it('leaves out a 3-bet that folds to a 4-bet', () => {
    // faced3Bets[] still lists it (heroRole tells them apart); the stat is
    // banded as fold-to-3-bet and must not read a 4-bet fold as one.
    const [h] = read(FOLD_TO_4BET);
    expect({ role: h.role, faced3Bet: h.faced3Bet }).toEqual({ role: '3bet', faced3Bet: true });
    expect(stat([h], 'foldTo3Bet')).toBe('0/0');
    expect(stat(read(FOLD_TO_3BET, FOLD_TO_4BET), 'foldTo3Bet')).toBe('1/1');
  });

  it('leaves out an open that folds after a cold 4-bet lands on the 3-bet', () => {
    // RC4834994197: Hero opens, gets 3-bet, a third player 4-bets before Hero
    // acts, Hero folds. Hero folded to two raises — a 4-bet, not a 3-bet.
    const rc = readFileSync('src/lib/hh/fixtures/rc/round2.txt', 'utf8');
    const mtt = readFileSync('src/lib/hh/fixtures/mtt/round2.txt', 'utf8');
    const all = [...parseHands(rc).hands, ...parseHands(mtt).hands].map((x) => heroHand(x)!);
    const byId = (id: string) => all.find((x) => x.id === id)!;
    const h = byId('RC4834994197');
    expect({ faced3Bet: h.faced3Bet, cold4Bet: h.faced3BetCold4Bet, role: h.role }).toEqual({
      faced3Bet: true,
      cold4Bet: true,
      role: 'open',
    });
    expect(stat([h], 'foldTo3Bet')).toBe('0/0');
    expect(byId('RC4835304855').faced3BetCold4Bet).toBe(true);
    expect(byId('TM6390221998').faced3BetCold4Bet).toBe(true);
    const [plain] = read(FOLD_TO_3BET);
    expect(plain.faced3BetCold4Bet).toBe(false);
    expect(stat([h, plain], 'foldTo3Bet')).toBe('1/1');
  });
});

describe('a preflop all-in that runs out', () => {
  it('counts as a flop seen and a showdown', () => {
    // Hero never acts on the flop, but it is dealt with Hero live and the hand
    // goes to showdown — the tracker convention the bands come from.
    const hs = read(JAM_RESHOVED);
    expect(hs[0].flopDealtLive).toBe(true);
    expect(hs[0].sawFlop).toBe(false);
    expect(stat(hs, 'wtsd')).toBe('1/1');
    expect(stat(hs, 'wsd')).toBe('0/1');
    expect(stat(hs, 'wwsf')).toBe('0/1');
  });

  it('leaves c-bet opportunities alone', () => {
    expect(stat(read(JAM_RESHOVED), 'cbetFlop')).toBe('0/0');
  });

  it('is no flop when the hand ends preflop', () => {
    const hs = read(FOLD_TO_3BET);
    expect(hs[0].flopDealtLive).toBe(false);
    expect(stat(hs, 'wtsd')).toBe('0/0');
  });

  it('agrees with the blue line on what a showdown is', () => {
    const hs = read(JAM_RESHOVED, MUCKED, FLASHED_FOLD);
    const s = summarise(hs);
    const wtsd = s.stats.find((x) => x.key === 'wtsd')!;
    expect(wtsd.made).toBe(hs.filter((h) => h.showdown).length);
  });
});

const SB_BB_BTN = (sb: string, bb: string, btn: string): [string, string, string] => [
  `${sb} (10,000 in chips)`,
  `${bb} (10,000 in chips)`,
  `${btn} (10,000 in chips)`,
];

/** The button raises, the small blind calls and leads the flop into it; Hero folds. A donk, not a c-bet. */
const DONK_INTO_PFA = threeHanded(
  'DI1',
  SB_BB_BTN('p1', 'Hero', 'Villain'),
  `p1: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [7h 2c]
Villain: raises 150 to 250
p1: calls 200
Hero: calls 150
*** FLOP *** [Kd 8c 3h]
p1: bets 400
Hero: folds
Villain: folds
Uncalled bet (400) returned to p1
*** SHOWDOWN ***
p1 collected 750 from pot`,
  750,
);

/** Nobody raised preflop; the small blind bets the flop and Hero folds. */
const LIMPED_BET = threeHanded(
  'LB1',
  SB_BB_BTN('p1', 'Hero', 'Villain'),
  `p1: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [7h 2c]
Villain: calls 100
p1: calls 50
Hero: checks
*** FLOP *** [Kd 8c 3h]
p1: bets 200
Hero: folds
Villain: folds
Uncalled bet (200) returned to p1
*** SHOWDOWN ***
p1 collected 300 from pot`,
  300,
);

/** The small blind raises and checks the flop; the button bets and Hero calls. */
const PFA_CHECKS = threeHanded(
  'PC1',
  SB_BB_BTN('p1', 'Hero', 'Villain'),
  `p1: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [7h 2c]
Villain: calls 100
p1: raises 250 to 350
Hero: calls 250
Villain: calls 250
*** FLOP *** [Kd 8c 3h]
p1: checks
Hero: checks
Villain: bets 500
p1: folds
Hero: calls 500
*** TURN *** [Kd 8c 3h] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Kd 8c 3h 4s] [9d]
Hero: bets 1,000
Villain: folds
Uncalled bet (1,000) returned to Hero
*** SHOWDOWN ***
Hero collected 2,050 from pot`,
  2050,
);

/** The raiser c-bets, Hero calls, the button raises behind and Hero folds. Hero did not fold to the c-bet. */
const CALL_THEN_FOLD = threeHanded(
  'CR1',
  SB_BB_BTN('Villain', 'Hero', 'p3'),
  `Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [7h 2c]
p3: calls 100
Villain: raises 250 to 350
Hero: calls 250
p3: calls 250
*** FLOP *** [Kd 8c 3h]
Villain: bets 500
Hero: calls 500
p3: raises 1,000 to 1,500
Villain: folds
Hero: folds
Uncalled bet (1,000) returned to p3
*** SHOWDOWN ***
p3 collected 2,550 from pot`,
  2550,
);

describe('fold to flop c-bet counts only c-bets', () => {
  it('ignores a donk bet in front of the raiser', () => {
    expect(stat(read(DONK_INTO_PFA), 'foldToCbetFlop')).toBe('0/0');
  });

  it('ignores a bet in a limped pot, where nobody can c-bet', () => {
    expect(stat(read(LIMPED_BET), 'foldToCbetFlop')).toBe('0/0');
  });

  it('ignores a bet from someone else after the raiser checks', () => {
    expect(stat(read(PFA_CHECKS), 'foldToCbetFlop')).toBe('0/0');
  });

  it('reads Hero’s answer to the c-bet, not a later fold to a raise', () => {
    expect(stat(read(CALL_THEN_FOLD), 'foldToCbetFlop')).toBe('0/1');
  });

  it('cuts the texture split from the same population', () => {
    const hs = read(CHECK_FOLD, DONK_INTO_PFA, LIMPED_BET, PFA_CHECKS, CALL_THEN_FOLD);
    expect(stat(hs, 'foldToCbetFlop')).toBe('1/2');
    const split = summarise(hs).byBoard.filter((b) => b.key === 'foldToCbetFlop');
    expect(split.reduce((t, b) => [t[0] + b.made, t[1] + b.opp], [0, 0])).toEqual([1, 2]);
  });
});

/** Everyone folds to Hero's big blind: a walk, with no decision for Hero. */
const BB_WALK = `Poker Hand #WK1: Tournament #900, Test $1 Hold'em No Limit - Level2(50/100(10)) - 2026/09/14 10:00:00
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
Villain: folds
p4: folds
p1: folds
Uncalled bet (50) returned to Hero
*** SHOWDOWN ***
Hero collected 140 from pot
*** SUMMARY ***
Total pot 140 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
`;

describe('a hand with no preflop decision', () => {
  it('is neither a fold nor a VPIP opportunity', () => {
    const [walk] = read(BB_WALK);
    expect(walk.decisions).toEqual([]);
    expect(walk.role).toBe('no-decision');
    expect(walk.vpip).toBe(false);
    // A walk is not a hand Hero declined to play: counting it in the
    // denominator pulled VPIP and PFR down by the walk rate.
    const [played] = read(CHECK_FOLD);
    expect(stat([walk, played], 'vpip')).toBe('1/1');
    expect(stat([walk, played], 'pfr')).toBe('0/1');
    expect(stat([walk, played], 'gap')).toBe('1/1');
    expect(summarise([walk, played]).hands).toBe(2);
  });

  it('includes an all-in from the blind post', () => {
    const text = readFileSync('src/lib/hh/fixtures/mtt/round2.txt', 'utf8');
    const h = parseHands(text).hands.map((x) => heroHand(x)!).find((x) => x.id === 'TM6393636443')!;
    expect(h.role).toBe('no-decision');
    expect(h.vpip).toBe(false);
    expect(h.decisions).toEqual([]);
    expect(stat([h], 'vpip')).toBe('0/0');
  });
});
