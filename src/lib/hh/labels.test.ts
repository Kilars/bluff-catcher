/**
 * One table, one row per labelled decision, and the row lists the *complete*
 * label set — so a label that starts firing where it should not fails here
 * rather than quietly widening a group.
 *
 * The hands are heads-up because that is the shortest history that still has
 * a real preflop raiser, a real board and a real street order. Every spot
 * below is one a coach would recognise, and none of them is a mistake: that is
 * the point of the module, so it had better be the point of its tests.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { heroHand, type HeroHand } from './hero.ts';
import { labelGroups, labelledDecisions } from './labels.ts';
import { parseHands } from './parse.ts';

/** Two hands, 300bb deep, so every decision here reads the same depth bucket. */
function heads(hole: string, streets: string): string {
  return `Poker Hand #LB${hole[0]}: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level3(50/100) - 2026/09/09 22:00:00
Table '7' 8-max Seat #4 is the button
Seat 2: Hero (30,000 in chips)
Seat 4: Villain (30,000 in chips)
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Villain
Dealt to Hero [${hole}]
Villain: raises 150 to 250
Hero: raises 550 to 800
Villain: calls 550
${streets}
`;
}

/**
 * Hero 3-bets, checks the flop as the raiser and calls the river with second
 * pair. Nothing was check-raised, so the flop check is a c-bet declined.
 */
const CHECK_CALL = heads(
  '8d 8c',
  `*** FLOP *** [Qh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Qh 7c 2d] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Qh 7c 2d 4s] [9h]
Hero: checks
Villain: bets 800
Hero: calls 800
Villain: shows [Ac Th] (high card Ace)
Hero: shows [8d 8c] (a pair of Eights)
*** SHOWDOWN ***
Hero collected 3,200 from pot
*** SUMMARY ***
Total pot 3,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Qh 7c 2d 4s 9h]`,
);

/**
 * Hero check-raises top pair and overbets the turn. The flop check is *not*
 * `pfa-check-flop`: a check that became a raise is a check-raise, which
 * strategy-notes §3 calls underused, and folding it in with giving up on the
 * pot would be the label lying about what happened.
 */
const CHECK_RAISE = heads(
  'Ad Kh',
  `*** FLOP *** [Ah 9h 2c]
Hero: checks
Villain: bets 500
Hero: raises 1,500 to 2,000
Villain: calls 1,500
*** TURN *** [Ah 9h 2c] [3d]
Hero: bets 8,000
Villain: folds
Uncalled bet (8,000) returned to Hero
*** SHOWDOWN ***
Hero collected 5,600 from pot
*** SUMMARY ***
Total pot 5,600 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Ah 9h 2c 3d]`,
);

/** Hero checks it down as the raiser and bluffs a river nothing blocks. */
const BLUFF = heads(
  'Qc Jd',
  `*** FLOP *** [Kd 9s 2c]
Hero: checks
Villain: checks
*** TURN *** [Kd 9s 2c] [4h]
Hero: checks
Villain: checks
*** RIVER *** [Kd 9s 2c 4h] [7d]
Hero: bets 1,200
Villain: folds
Uncalled bet (1,200) returned to Hero
*** SHOWDOWN ***
Hero collected 1,600 from pot
*** SUMMARY ***
Total pot 1,600 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Kd 9s 2c 4h 7d]`,
);

/**
 * Hero bets flop and turn, then checks the river through with an overpair. The
 * check goes to showdown — not a bluff-catch — so it is the value left unbet,
 * and `river-check-value` is the only thing here.
 */
const CHECK_THROUGH = heads(
  'Qc Qd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 800
Villain: calls 800
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 2,000
Villain: calls 2,000
*** RIVER *** [Jh 7c 2d 4s] [9h]
Hero: checks
Villain: checks
Villain: shows [Kh Jd] (a pair of Jacks)
Hero: shows [Qc Qd] (a pair of Queens)
*** SHOWDOWN ***
Hero collected 7,200 from pot
*** SUMMARY ***
Total pot 7,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 9h]`,
);

/** The fixture the CLI and the doc guard already read — TM5 is its only draw. */
const DAY2 = readFileSync('src/lib/hh/fixtures/t310299999/day2.txt', 'utf8');

function parsed(text: string, id?: string) {
  const hands = parseHands(text).hands;
  return id ? hands.find((h) => h.id === id)! : hands[0];
}

function hero(text: string, id?: string): HeroHand {
  return heroHand(parsed(text, id))!;
}

const CASES = [
  {
    name: 'checks the flop as the raiser, then bluff-catches the river',
    text: CHECK_CALL,
    want: [
      ['flop:check', ['pfa-check-flop']],
      ['river:call', ['river-call-marginal']],
    ],
  },
  {
    name: 'check-raises the flop and overbets the turn',
    text: CHECK_RAISE,
    want: [['turn:bet', ['overbet-strong']]],
  },
  {
    name: 'bets flop and turn, then checks the river through with an overpair',
    text: CHECK_THROUGH,
    want: [['river:check', ['river-check-value']]],
  },
  {
    name: 'gives up as the raiser, then bluffs a blank river',
    text: BLUFF,
    want: [
      ['flop:check', ['pfa-check-flop']],
      ['river:bet', ['river-bluff-no-blocker']],
    ],
  },
  {
    name: 'checks a flush draw twice, then bets the river holding the wheel ace',
    text: DAY2,
    id: 'TM5',
    want: [
      ['flop:check', ['check-draw']],
      ['turn:check', ['check-draw']],
      ['river:bet', ['river-bluff-with-blocker']],
    ],
  },
];

describe('labelledDecisions', () => {
  it.each(CASES)('$name', ({ text, id, want }) => {
    // A history whose pot does not reconcile is a history read wrong, and every
    // sizing below it is then a number nobody played.
    expect(parsed(text, id).potMatches).toBe(true);
    const ds = labelledDecisions(hero(text, id));
    expect(ds.map((d) => [`${d.street}:${d.kind}`, d.labels])).toEqual(want);
  });

  it('tells the agent nothing about what a decision returned', () => {
    // The same sweep doc.test.ts runs over the payload, at the source: labels
    // are the selector now, so anything they carry reaches the coach.
    const all = CASES.map((c) => labelledDecisions(hero(c.text, c.id)));
    const keys = JSON.stringify(all).match(/"(\w+)"\s*:/g);
    expect((keys ?? []).filter((k) => /net|won|invested|cost|BB/i.test(k) && !/stackBB/.test(k)))
      .toEqual([]);
  });
});

describe('labelGroups', () => {
  const groups = labelGroups([hero(CHECK_CALL), hero(BLUFF)]);
  const byLabel = new Map(groups.map((g) => [g.label, g]));

  it('shares only the facets every instance agrees on', () => {
    // Two flop checks as the raiser: same seat, same depth, same texture — and
    // one holds a pair while the other holds nothing. Three facets are a rule
    // Hero is carrying; the fourth is not, and dropping it is what stops the
    // group from over-claiming. No count, no rate, no minimum sample anywhere.
    expect(byLabel.get('pfa-check-flop')?.shared).toEqual({
      position: 'BB',
      depth: 'deep',
      boardType: 'dry-high-mine',
    });
  });

  it('says nothing is shared when there is only one instance', () => {
    // A lone decision agrees with itself on all four facets, which would read
    // as a pattern built from one hand. §3's claim is that `shared` is sayable
    // at n = 2 — below that there is nothing to say, and the facets are still
    // on the decision for anyone who wants them.
    expect(byLabel.get('river-bluff-no-blocker')?.decisions).toHaveLength(1);
    expect(byLabel.get('river-bluff-no-blocker')?.shared).toEqual({});
  });
});
