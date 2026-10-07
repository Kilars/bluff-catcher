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
import { actionLine } from './lines.ts';
import { parseHands } from './parse.ts';

/**
 * A two-handed, 300bb-deep hand so every decision reads the same depth bucket.
 * `preflop` is the only axis that varies between `heads` and `caller`; the
 * shared header keeps their depth identical without a comment-only promise.
 */
function dealt(idPrefix: string, hole: string, preflop: string, streets: string): string {
  return `Poker Hand #${idPrefix}${hole[0]}: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level3(50/100) - 2026/09/09 22:00:00
Table '7' 8-max Seat #4 is the button
Seat 2: Hero (30,000 in chips)
Seat 4: Villain (30,000 in chips)
Villain: posts small blind 50
Hero: posts big blind 100
*** HOLE CARDS ***
Dealt to Villain
Dealt to Hero [${hole}]
${preflop}
${streets}
`;
}

/** Hero 3-bets and takes the initiative. */
function heads(hole: string, streets: string): string {
  return dealt('LB', hole, 'Villain: raises 150 to 250\nHero: raises 550 to 800\nVillain: calls 550', streets);
}

/**
 * A three-handed hand so `playersToFlop > 2` is real: Hero opens the button,
 * both blinds call, and all three see the flop. This is the only fixture that
 * is not two-handed, built to exercise the multiway gate on `cbet-multiway-air`;
 * the two-handed `heads`/`caller` fixtures are the heads-up negatives.
 */
function multiway(hole: string, preflop: string, streets: string): string {
  return `Poker Hand #MW${hole[0]}: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level3(50/100) - 2026/09/09 22:00:00
Table '7' 8-max Seat #4 is the button
Seat 3: SB (30,000 in chips)
Seat 1: BB (30,000 in chips)
Seat 4: Hero (30,000 in chips)
SB: posts small blind 50
BB: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [${hole}]
${preflop}
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

/**
 * Hero bets flop and turn as the raiser, then faces a river check-raise-style
 * bet and raises back holding an overpair — a river value raise. The overpair
 * is `strong`, so `river-raise-value` is the river label. The flop/turn bets
 * carry no label of their own.
 */
const RIVER_RAISE_VALUE = heads(
  'Qc Qd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 800
Villain: calls 800
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 2,000
Villain: calls 2,000
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: bets 3,000
Hero: raises 6,000 to 9,000
Villain: folds
Uncalled bet (6,000) returned to Hero
*** SHOWDOWN ***
Hero collected 13,200 from pot
*** SUMMARY ***
Total pot 13,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero checks the river with second pair (a `marginal-made` hand), faces a bet
 * and raises it — still a value raise by hand class, so `river-raise-value`.
 * Proves the label spans both made classes, mirroring the river bet split.
 */
const RIVER_RAISE_MARGINAL = heads(
  '7d 7h',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: bets 800
Hero: raises 1,600 to 2,400
Villain: folds
Uncalled bet (1,600) returned to Hero
*** SHOWDOWN ***
Hero collected 3,200 from pot
*** SUMMARY ***
Total pot 3,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero gives up as the raiser, then faces a river bet and raises it with
 * ace-high — `air`, so this is a bluff-raise: `river-raise-bluff`. The flop
 * check with no bet before it is `pfa-check-flop`.
 */
const RIVER_RAISE_BLUFF = heads(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: bets 800
Hero: raises 1,600 to 2,400
Villain: folds
Uncalled bet (1,600) returned to Hero
*** SHOWDOWN ***
Hero collected 3,200 from pot
*** SUMMARY ***
Total pot 3,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero faces a river bet and only calls (ace-high) — a call, not a raise, so
 * neither river-raise label may fire. The raise labels are gated on `d.kind`,
 * and a call with air carries no label at all. The negative for the raise pair.
 */
const RIVER_CALL_NOT_RAISE = heads(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 800
Villain: calls 800
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 2,000
Villain: calls 2,000
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: bets 3,000
Hero: calls 3,000
Villain: shows [Qs Qh] (a pair of Queens)
Hero: shows [Ac Kd] (high card Ace)
*** SHOWDOWN ***
Villain collected 13,200 from pot
*** SUMMARY ***
Total pot 13,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
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

/**
 * Hero opens the button with ace-high, both blinds call, and Hero c-bets the
 * flop into the two of them — three players saw the flop, so this is the
 * multiway air c-bet. Ace-high on 9-6-2 is `air`, and the bet is a first bet
 * (`!facedBet`), so `cbet-multiway-air` is the only label.
 */
const CBET_MULTIWAY_AIR = multiway(
  'Ac Kd',
  `Hero: raises 150 to 250
SB: calls 200
BB: calls 150`,
  `*** FLOP *** [9d 6c 2s]
SB: checks
BB: checks
Hero: bets 400
SB: folds
BB: folds
Uncalled bet (400) returned to Hero
*** SHOWDOWN ***
Hero collected 750 from pot
*** SUMMARY ***
Total pot 750 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [9d 6c 2s]`,
);

/**
 * The same button open and flop c-bet with air, but heads-up: only the BB
 * calls, so two players saw the flop. `cbet-multiway-air` must not fire — a
 * heads-up air c-bet on a dry board is standard. Proves the `playersToFlop > 2`
 * gate.
 */
const CBET_HEADSUP_AIR = multiway(
  'Ac Kd',
  `Hero: raises 150 to 250
SB: folds
BB: calls 150`,
  `*** FLOP *** [9d 6c 2s]
BB: checks
Hero: bets 300
BB: folds
Uncalled bet (300) returned to Hero
*** SHOWDOWN ***
Hero collected 550 from pot
*** SUMMARY ***
Total pot 550 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [9d 6c 2s]`,
);

/**
 * Hero opens, both blinds call, and Hero c-bets the flop multiway holding a set
 * — a `strong` hand, not `air`. `cbet-multiway-air` must not fire: the label is
 * a selection error about betting *air* into a field, not any multiway c-bet.
 * Proves the `hand === 'air'` gate.
 */
const CBET_MULTIWAY_MADE = multiway(
  '9h 9s',
  `Hero: raises 150 to 250
SB: calls 200
BB: calls 150`,
  `*** FLOP *** [9d 6c 2s]
SB: checks
BB: checks
Hero: bets 400
SB: folds
BB: folds
Uncalled bet (400) returned to Hero
*** SHOWDOWN ***
Hero collected 750 from pot
*** SUMMARY ***
Total pot 750 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [9d 6c 2s]`,
);

/**
 * Hero is the caller, not the preflop raiser: the SB opens, Hero calls on the
 * button and the BB comes along, so three see the flop. Hero leads the flop
 * with air — but `cbet-multiway-air` gates on `d.pfa`, so it is not a c-bet.
 * The SB checked first, so it is not a donk either: a stab at a declined c-bet.
 * Proves the `d.pfa` gate and the donk's raiser-yet-to-act gate.
 */
const CBET_MULTIWAY_CALLER = multiway(
  'Ac Kd',
  `SB: raises 150 to 250
Hero: calls 250
BB: calls 150`,
  `*** FLOP *** [9d 6c 2s]
SB: checks
Hero: bets 400
BB: folds
SB: folds
Uncalled bet (400) returned to Hero
*** SHOWDOWN ***
Hero collected 750 from pot
*** SUMMARY ***
Total pot 750 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [9d 6c 2s]`,
);

/**
 * Hero is the caller, not the preflop raiser: Villain opens the button and Hero
 * defends the big blind by calling. Same 300bb depth as `heads`, so the shared
 * facets still line up.
 */
function caller(hole: string, streets: string): string {
  return dealt('LC', hole, 'Villain: raises 150 to 250\nHero: calls 150', streets);
}

/**
 * Hero 3-bets, c-bets the flop, then checks the turn as the raiser. The flop
 * bet kept the initiative, so the turn check is a barrel declined —
 * `pfa-check-turn`. The overpair is not a draw, so nothing else fires.
 */
const BET_THEN_CHECK_TURN = heads(
  'Qc Qd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 800
Villain: calls 800
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: checks
Villain: shows [Kh Th] (high card King)
Hero: shows [Qc Qd] (a pair of Queens)
*** SHOWDOWN ***
Hero collected 3,200 from pot
*** SUMMARY ***
Total pot 3,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero c-bets the flop, barrels the turn, then checks the river with ace-high
 * (`air`) — two barrels and then a give-up on the river. `betFlop && betTurn`
 * and `hand === 'air'` all hold, so `barrel-abandon` fires. The flop and turn
 * bets carry no label of their own, and air on the river fires no bluff bet.
 */
const BARREL_ABANDON = heads(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 800
Villain: calls 800
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 2,000
Villain: calls 2,000
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: checks
Villain: shows [Qs Qh] (a pair of Queens)
Hero: shows [Ac Kd] (high card Ace)
*** SHOWDOWN ***
Villain collected 7,200 from pot
*** SUMMARY ***
Total pot 7,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero checks the flop, bets the turn, then checks the river with air. Only one
 * barrel was fired (the flop was checked, not bet), so `betFlop` is false and
 * `barrel-abandon` must not fire — there is no barrel line to abandon. Proves
 * the `betFlop && betTurn` gate. The flop check with no bet before it is
 * `pfa-check-flop`.
 */
const CHECK_FLOP_BET_TURN_CHECK_RIVER = heads(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 500
Villain: calls 500
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: checks
Villain: shows [Qs Qh] (a pair of Queens)
Hero: shows [Ac Kd] (high card Ace)
*** SHOWDOWN ***
Villain collected 2,600 from pot
*** SUMMARY ***
Total pot 2,600 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero bets the flop and turn, then checks the river holding an overpair (a
 * made hand, not `air`). Two barrels then a river check, but `hand !== 'air'`,
 * so this is the showdown-value check-back — `river-check-value`, not
 * `barrel-abandon`. Proves the `air` gate keeps the two labels from co-firing.
 */
const TWO_BARRELS_THEN_CHECK_MADE = heads(
  'Qc Qd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 800
Villain: calls 800
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 2,000
Villain: calls 2,000
*** RIVER *** [Jh 7c 2d 4s] [3h]
Hero: checks
Villain: checks
Villain: shows [Kh Jd] (a pair of Jacks)
Hero: shows [Qc Qd] (a pair of Queens)
*** SHOWDOWN ***
Hero collected 7,200 from pot
*** SUMMARY ***
Total pot 7,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 3h]`,
);

/**
 * Hero checks the flop and then checks the turn. The turn check is NOT
 * `pfa-check-turn`: without a flop bet the initiative was gone on the flop, and
 * the flop check is `pfa-check-flop`'s to name. Proves the `betFlop` gate.
 */
const CHECK_FLOP_CHECK_TURN = heads(
  'Qc Qd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: checks
Villain: shows [Kh Th] (high card King)
Hero: shows [Qc Qd] (a pair of Queens)
*** SHOWDOWN ***
Hero collected 1,600 from pot
*** SUMMARY ***
Total pot 1,600 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero c-bets the flop, then check-raises the turn. The turn check-then-raise
 * is a different line, not a declined barrel, so `pfa-check-turn` must not fire
 * — the same check-raise exclusion `pfa-check-flop` carries, one street later.
 */
const BET_THEN_CHECKRAISE_TURN = heads(
  'Qc Qd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 800
Villain: calls 800
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: bets 1,000
Hero: raises 1,500 to 2,500
Villain: folds
Uncalled bet (1,500) returned to Hero
*** SHOWDOWN ***
Hero collected 5,200 from pot
*** SUMMARY ***
Total pot 5,200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * Hero calls preflop, the flop checks through (the raiser declined the c-bet),
 * and Hero leads the turn — a probe into a declined c-bet. `turn-probe` is the
 * only thing here: air on the turn fires no bluff label off the river.
 */
const TURN_PROBE = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 300
Villain: folds
Uncalled bet (300) returned to Hero
*** SHOWDOWN ***
Hero collected 500 from pot
*** SUMMARY ***
Total pot 500 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * Hero defends the big blind and leads the flop before the button raiser acts:
 * the strict meaning of a donk bet.
 */
const DONK_INTO_RAISER = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: bets 300
Villain: folds
Uncalled bet (300) returned to Hero
*** SHOWDOWN ***
Hero collected 500 from pot
*** SUMMARY ***
Total pot 500 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d]`,
);

/**
 * Hero calls preflop, then faces and calls a flop c-bet before leading the
 * turn. The flop was NOT checked back, so this turn lead is not a probe —
 * `turn-probe` must not fire. Proves the `pfaCheckedFlop` gate.
 */
const TURN_LEAD_AFTER_CBET = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: bets 300
Hero: calls 300
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 600
Villain: folds
Uncalled bet (600) returned to Hero
*** SHOWDOWN ***
Hero collected 1,100 from pot
*** SUMMARY ***
Total pot 1,100 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * Hero is the raiser (pfa), checks the flop back, then bets the turn. Even
 * though the flop checked through, this is not a probe: `turn-probe` is the
 * caller's line into a declined c-bet, and Hero declined it. Proves the
 * `!d.pfa` guard.
 */
const PFA_BET_TURN_AFTER_CHECK = heads(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 500
Villain: folds
Uncalled bet (500) returned to Hero
*** SHOWDOWN ***
Hero collected 1,600 from pot
*** SUMMARY ***
Total pot 1,600 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * Hero calls preflop, then faces a flop c-bet and calls, faces a turn barrel
 * and folds. The villain bet the flop too, so the turn bet is a continued bet
 * — `fold-to-turn-barrel`. Ace-high is `air`, which fires no other label.
 */
const FOLD_TO_TURN_BARREL = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: bets 300
Hero: calls 300
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: bets 900
Hero: folds
Uncalled bet (900) returned to Villain
*** SHOWDOWN ***
Villain collected 1,100 from pot
*** SUMMARY ***
Total pot 1,100 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * Hero calls flop and turn barrels, then folds to a third barrel on the river.
 * The villain bet the turn too, so the river bet is a continued bet —
 * `fold-to-river-barrel`. No other label fires on the fold.
 */
const FOLD_TO_RIVER_BARREL = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: bets 300
Hero: calls 300
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: bets 900
Hero: calls 900
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: bets 2,700
Hero: folds
Uncalled bet (2,700) returned to Villain
*** SHOWDOWN ***
Villain collected 2,900 from pot
*** SUMMARY ***
Total pot 2,900 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * The flop checks through, then Hero folds the turn to a lone stab. The villain
 * did NOT bet the flop, so this is not a barrel — `fold-to-turn-barrel` must not
 * fire. Proves the "barrel" (prior-street villain bet) gate on the turn.
 */
const FOLD_TO_TURN_STAB = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: bets 300
Hero: folds
Uncalled bet (300) returned to Villain
*** SHOWDOWN ***
Villain collected 500 from pot
*** SUMMARY ***
Total pot 500 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * Hero calls a flop c-bet, the turn checks through, then Hero folds the river to
 * a lone stab. The villain did NOT bet the turn, so the river bet is not a
 * continued bet — `fold-to-river-barrel` must not fire even though the flop was
 * bet. Proves the gate reads the *previous* street, not any earlier one.
 */
const FOLD_TO_RIVER_STAB = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: bets 300
Hero: calls 300
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: bets 600
Hero: folds
Uncalled bet (600) returned to Villain
*** SHOWDOWN ***
Villain collected 1,100 from pot
*** SUMMARY ***
Total pot 1,100 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * Hero calls the turn barrel rather than folding it. A call, not a fold, so no
 * fold-to-barrel label may fire — the labels are gated on `d.kind === 'fold'`.
 * The negative that proves the family is folds only.
 */
const CALL_TURN_BARREL = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: bets 300
Hero: calls 300
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: bets 900
Hero: calls 900
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: checks
Villain: checks
Villain: shows [Qs Qh] (a pair of Queens)
Hero: shows [Ac Kd] (high card Ace)
*** SHOWDOWN ***
Villain collected 2,900 from pot
*** SUMMARY ***
Total pot 2,900 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * RC4857718435's line: a pocket pair under a turned board pair. The probe and
 * the river check-back both fire, and both read the hand as the one pair it is
 * — the board's nines are everyone's, so this is not two pair.
 */
const PROBE_UNDER_BOARD_PAIR = caller(
  '4h 4s',
  `*** FLOP *** [3c 5d 9s]
Hero: checks
Villain: checks
*** TURN *** [3c 5d 9s] [9d]
Hero: bets 300
Villain: calls 300
*** RIVER *** [3c 5d 9s 9d] [Qd]
Hero: checks
Villain: checks
Villain: shows [Ac Kd] (a pair of Nines)
Hero: shows [4h 4s] (two pair, Nines and Fours)
*** SHOWDOWN ***
Hero collected 1,100 from pot
*** SUMMARY ***
Total pot 1,100 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [3c 5d 9s 9d Qd]`,
);

/**
 * RC4840435045: jacks under an ace with the river pairing the board. One pair
 * calling a river bet is the bluff-catch `river-call-marginal` names; reading
 * it as two pair (strong) hid it.
 */
const CALL_UNDER_BOARD_PAIR = caller(
  'Jc Jd',
  `*** FLOP *** [3c Ah 2d]
Hero: checks
Villain: checks
*** TURN *** [3c Ah 2d] [7h]
Hero: checks
Villain: checks
*** RIVER *** [3c Ah 2d 7h] [7c]
Hero: checks
Villain: bets 300
Hero: calls 300
Villain: shows [Ac 5c] (two pair, Aces and Sevens)
Hero: shows [Jc Jd] (two pair, Jacks and Sevens)
*** SHOWDOWN ***
Villain collected 1,100 from pot
*** SUMMARY ***
Total pot 1,100 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [3c Ah 2d 7h 7c]`,
);

/**
 * RC4848809818's shape: a strong hand shoves the river for many times the pot.
 * `sizing` is null on a shove (the stack chose the size), but the label is
 * about a bet bigger than the pot, which a jam is — so it must still fire.
 */
const SHOVE_STRONG = heads(
  'Ac Ad',
  `*** FLOP *** [Kh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Kh 7c 2d] [4s]
Hero: checks
Villain: checks
*** RIVER *** [Kh 7c 2d 4s] [9h]
Hero: bets 29,200 and is all-in
Villain: folds
Uncalled bet (29,200) returned to Hero
*** SHOWDOWN ***
Hero collected 1,600 from pot
*** SUMMARY ***
Total pot 1,600 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Kh 7c 2d 4s 9h]`,
);

/**
 * RC4851716369: top pair with a jack kicker overbets a river that paired the
 * board earlier. The kicker is below Q and the eights are the board's, so the
 * hand is `marginal-made` and `overbet-strong` must not fire.
 */
const OVERBET_TOP_PAIR_BOARD_PAIR = heads(
  'Kd Jh',
  `*** FLOP *** [Qc 8c 3h]
Hero: checks
Villain: checks
*** TURN *** [Qc 8c 3h] [8h]
Hero: checks
Villain: checks
*** RIVER *** [Qc 8c 3h 8h] [Kc]
Hero: bets 4,000
Villain: folds
Uncalled bet (4,000) returned to Hero
*** SHOWDOWN ***
Hero collected 1,600 from pot
*** SUMMARY ***
Total pot 1,600 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Qc 8c 3h 8h Kc]`,
);

/**
 * Hero calls a flop bet, then leads the turn and folds to a raise. The villain
 * bet the flop, but the turn bet Hero folded to is a raise of Hero's own lead,
 * not a continued barrel — `fold-to-turn-barrel` must not fire.
 */
const LEAD_TURN_FOLD_TO_RAISE = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: bets 300
Hero: calls 300
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 600
Villain: raises 1,200 to 1,800
Hero: folds
Uncalled bet (1,200) returned to Villain
*** SHOWDOWN ***
Villain collected 2,300 from pot
*** SUMMARY ***
Total pot 2,300 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * RC4854845086's line: Hero calls a turn barrel, leads the river and folds to
 * a raise. No river barrel was faced, so `fold-to-river-barrel` must not fire;
 * the river lead itself is still a bluff with air.
 */
const LEAD_RIVER_FOLD_TO_RAISE = caller(
  'Ac Kd',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: bets 300
Hero: calls 300
*** TURN *** [Jh 7c 2d] [4s]
Hero: checks
Villain: bets 900
Hero: calls 900
*** RIVER *** [Jh 7c 2d 4s] [8h]
Hero: bets 1,000
Villain: raises 2,000 to 3,000
Hero: folds
Uncalled bet (2,000) returned to Villain
*** SHOWDOWN ***
Villain collected 4,900 from pot
*** SUMMARY ***
Total pot 4,900 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 8h]`,
);

/**
 * A limped pot: the button completes, Hero checks the big blind, the flop
 * checks through and Hero bets the turn. With no preflop raiser there is no
 * declined c-bet to probe into, so `turn-probe` must not fire.
 */
const LIMPED_TURN_BET = dealt(
  'LL',
  'Ac Kd',
  'Villain: calls 50\nHero: checks',
  `*** FLOP *** [Jh 7c 2d]
Hero: checks
Villain: checks
*** TURN *** [Jh 7c 2d] [4s]
Hero: bets 200
Villain: folds
Uncalled bet (200) returned to Hero
*** SHOWDOWN ***
Hero collected 200 from pot
*** SUMMARY ***
Total pot 200 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]`,
);

/**
 * Hero calls a cutoff open on the button and is in position. The raiser checks
 * the flop, Hero checks back, the raiser checks the turn and Hero bets. That is
 * a delayed stab from position: the raiser checked *to* Hero rather than
 * checking back, so it is not a `turn-probe`.
 */
const IP_DELAYED_STAB = `Poker Hand #IPAc: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level3(50/100) - 2026/09/09 22:00:00
Table '7' 8-max Seat #4 is the button
Seat 2: Villain (30,000 in chips)
Seat 4: Hero (30,000 in chips)
Seat 5: SB (30,000 in chips)
Seat 6: BB (30,000 in chips)
SB: posts small blind 50
BB: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ac Kd]
Villain: raises 150 to 250
Hero: calls 250
SB: folds
BB: folds
*** FLOP *** [Jh 7c 2d]
Villain: checks
Hero: checks
*** TURN *** [Jh 7c 2d] [4s]
Villain: checks
Hero: bets 400
Villain: folds
Uncalled bet (400) returned to Hero
*** SHOWDOWN ***
Hero collected 650 from pot
*** SUMMARY ***
Total pot 650 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s]
`;

/** The fixture the CLI and the doc guard already read — TM5 is its only draw. */
/**
 * The only preflop raise is a short stack's all-in: SB jams over Hero's limp,
 * both others call. Nobody left in the hand raised with chips behind, so there
 * is no preflop aggressor to lead into, and Hero's flop bet is no donk-bet.
 */
const ALL_IN_RAISER_ONLY = `Poker Hand #AIR1: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level3(50/100) - 2026/09/09 22:00:00
Table '7' 8-max Seat #4 is the button
Seat 1: BB (30,000 in chips)
Seat 3: SB (1,000 in chips)
Seat 4: Hero (30,000 in chips)
SB: posts small blind 50
BB: posts big blind 100
*** HOLE CARDS ***
Dealt to Hero [Ac Kd]
Hero: calls 100
SB: raises 900 to 1,000 and is all-in
BB: calls 900
Hero: calls 900
*** FLOP *** [Jh 7c 2d]
BB: checks
Hero: bets 1,000
BB: folds
Uncalled bet (1,000) returned to Hero
*** TURN *** [Jh 7c 2d] [4s]
*** RIVER *** [Jh 7c 2d 4s] [9c]
*** SHOWDOWN ***
SB: shows [Qs Qd]
Hero: shows [Ac Kd]
SB collected 3,000 from pot
*** SUMMARY ***
Total pot 3,000 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
Board [Jh 7c 2d 4s 9c]
`;

const DAY2 = readFileSync('src/lib/hh/fixtures/t310299999/day2.txt', 'utf8');
/** Archive hands, verbatim, behind the round-2 fixes (cash and MTT). */
const RC2 = readFileSync('src/lib/hh/fixtures/rc/round2.txt', 'utf8');
const MTT2 = readFileSync('src/lib/hh/fixtures/mtt/round2.txt', 'utf8');

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
    name: 'c-bets the flop as the raiser, then checks the turn',
    text: BET_THEN_CHECK_TURN,
    want: [
      ['turn:check', ['pfa-check-turn']],
      ['river:check', ['river-check-value']],
    ],
  },
  {
    name: 'checks the flop then the turn — no pfa-check-turn without a flop bet',
    text: CHECK_FLOP_CHECK_TURN,
    want: [
      ['flop:check', ['pfa-check-flop']],
      ['river:check', ['river-check-value']],
    ],
  },
  {
    name: 'c-bets the flop then check-raises the turn — not a declined barrel',
    text: BET_THEN_CHECKRAISE_TURN,
    want: [],
  },
  {
    name: 'bets flop and turn, then checks the river with air — barrel-abandon',
    text: BARREL_ABANDON,
    want: [['river:check', ['barrel-abandon']]],
  },
  {
    name: 'checks flop, bets turn, checks river with air — one barrel, not barrel-abandon',
    text: CHECK_FLOP_BET_TURN_CHECK_RIVER,
    want: [['flop:check', ['pfa-check-flop']]],
  },
  {
    name: 'two barrels then a river check with a made hand — river-check-value, not barrel-abandon',
    text: TWO_BARRELS_THEN_CHECK_MADE,
    want: [['river:check', ['river-check-value']]],
  },
  {
    name: 'c-bets the flop with air into two callers — cbet-multiway-air',
    text: CBET_MULTIWAY_AIR,
    want: [['flop:bet', ['cbet-multiway-air']]],
  },
  {
    name: 'c-bets the flop with air heads-up — no multiway without 3+ players',
    text: CBET_HEADSUP_AIR,
    want: [],
  },
  {
    name: 'c-bets the flop multiway with a set — not air, no cbet-multiway-air',
    text: CBET_MULTIWAY_MADE,
    want: [],
  },
  {
    name: 'bets the flop as the caller after the raiser checked — a stab, not a donk',
    text: CBET_MULTIWAY_CALLER,
    want: [],
  },
  {
    name: 'leads the flop into the raiser from the big blind — a donk',
    text: DONK_INTO_RAISER,
    want: [['flop:bet', ['donk-bet']]],
  },
  {
    name: 'as the caller, leads the turn after the raiser checked back the flop',
    text: TURN_PROBE,
    want: [['turn:bet', ['turn-probe']]],
  },
  {
    name: 'as the caller, leads the turn after calling a flop c-bet — not a probe',
    text: TURN_LEAD_AFTER_CBET,
    want: [],
  },
  {
    name: 'as the raiser, bets the turn after checking the flop back — not a probe',
    text: PFA_BET_TURN_AFTER_CHECK,
    want: [['flop:check', ['pfa-check-flop']]],
  },
  {
    name: 'faces a river bet and raises with an overpair — a value raise',
    text: RIVER_RAISE_VALUE,
    want: [['river:raise', ['river-raise-value']]],
  },
  {
    name: 'faces a river bet and only calls with air — no raise label',
    text: RIVER_CALL_NOT_RAISE,
    want: [],
  },
  {
    name: 'raises a river bet with second pair — value raise spans marginal-made',
    text: RIVER_RAISE_MARGINAL,
    want: [
      ['flop:check', ['pfa-check-flop']],
      ['river:raise', ['river-raise-value']],
    ],
  },
  {
    name: 'raises a river bet with ace-high — a bluff-raise',
    text: RIVER_RAISE_BLUFF,
    want: [
      ['flop:check', ['pfa-check-flop']],
      ['river:raise', ['river-raise-bluff']],
    ],
  },
  {
    name: 'folds the turn to a continued bet — fold-to-turn-barrel',
    text: FOLD_TO_TURN_BARREL,
    want: [['turn:fold', ['fold-to-turn-barrel']]],
  },
  {
    name: 'folds the river to a third barrel — fold-to-river-barrel',
    text: FOLD_TO_RIVER_BARREL,
    want: [['river:fold', ['fold-to-river-barrel']]],
  },
  {
    name: 'folds the turn to a lone stab — no barrel without a flop bet',
    text: FOLD_TO_TURN_STAB,
    want: [],
  },
  {
    name: 'folds the river to a lone stab after a checked turn — not a barrel',
    text: FOLD_TO_RIVER_STAB,
    want: [],
  },
  {
    name: 'calls the turn barrel instead of folding — folds-only, no label',
    text: CALL_TURN_BARREL,
    want: [],
  },
  {
    name: 'leads the turn after calling a flop bet, folds to a raise — fold-to-raise, no turn barrel',
    text: LEAD_TURN_FOLD_TO_RAISE,
    want: [['turn:fold', ['fold-to-raise']]],
  },
  {
    name: 'leads the river after calling a turn barrel, folds to a raise — fold-to-raise, no river barrel',
    text: LEAD_RIVER_FOLD_TO_RAISE,
    want: [
      ['river:bet', ['river-bluff-no-blocker']],
      ['river:fold', ['fold-to-raise']],
    ],
  },
  {
    // Hero c-bets, BB check-raises, Hero calls; BB bets the turn, Hero folds.
    // A raise of Hero's flop bet is the villain's flop aggression too.
    name: 'RC4851719710: folds the turn after calling a flop check-raise — fold-to-turn-barrel',
    text: RC2,
    id: 'RC4851719710',
    want: [['turn:fold', ['fold-to-turn-barrel']]],
  },
  {
    name: 'RC4857718745: c-bets the flop, is raised, folds — fold-to-raise',
    text: RC2,
    id: 'RC4857718745',
    want: [['flop:fold', ['fold-to-raise']]],
  },
  {
    // The check was the first half of a check-raise: the aggressive line, not
    // a draw checked passively.
    name: 'RC4834989265: check-raises a flush draw — no check-draw on the check',
    text: RC2,
    id: 'RC4834989265',
    want: [['flop:raise', ['check-raise-flop']]],
  },
  {
    name: 'TM6436800479: check-raises a flush draw multiway — no check-draw on the check',
    text: MTT2,
    id: 'TM6436800479',
    want: [['flop:raise', ['check-raise-flop']]],
  },
  {
    name: 'bets the turn in a limped pot after the flop checks through — no raiser to probe',
    text: LIMPED_TURN_BET,
    want: [],
  },
  {
    name: 'in position, bets the turn after the raiser checked twice — a stab, not a probe',
    text: IP_DELAYED_STAB,
    want: [],
  },
  {
    name: 'probes the turn with a pocket pair under a board pair, checks the river back',
    text: PROBE_UNDER_BOARD_PAIR,
    want: [
      ['turn:bet', ['turn-probe']],
      ['river:check', ['river-check-value']],
    ],
  },
  {
    name: 'calls a river bet with an underpair on a paired board — river-call-marginal',
    text: CALL_UNDER_BOARD_PAIR,
    want: [['river:call', ['river-call-marginal']]],
  },
  {
    name: 'shoves the river for many pots with an overpair — overbet-strong',
    text: SHOVE_STRONG,
    want: [
      ['flop:check', ['pfa-check-flop']],
      ['river:bet', ['overbet-strong']],
    ],
  },
  {
    // The villain has $34.27 behind against Hero's $45.11 jam into $36.77: the
    // most anyone can call is 0.93 pot, a just-under-pot jam, not an overbet.
    name: 'RC4848809818: jams the turn past what the villain can call — not an overbet',
    text: RC2,
    id: 'RC4848809818',
    want: [['flop:raise', ['check-raise-flop']]],
  },
  {
    // A near-all-in river bet the villain can call for 1.15 pot.
    name: 'RC4835306771: bets all but $6 into a pot the villain can match past 1x — overbet-strong',
    text: RC2,
    id: 'RC4835306771',
    want: [['river:bet', ['overbet-strong']]],
  },
  {
    name: 'TM6393633319: leads for more than the villain has left — still a donk-bet',
    text: MTT2,
    id: 'TM6393633319',
    want: [['flop:bet', ['donk-bet']]],
  },
  {
    // SB's short all-in raise is no aggressor: Hero, whose open it raised, is.
    name: 'TM6393633744: the raiser checks the flop behind a short all-in re-raise — pfa-check-flop',
    text: MTT2,
    id: 'TM6393633744',
    want: [['flop:check', ['pfa-check-flop', 'check-draw']]],
  },
  {
    name: 'bets the flop when the only preflop raiser is all-in — no raiser to donk into',
    text: ALL_IN_RAISER_ONLY,
    want: [],
  },
  {
    name: 'overbets the river with top pair, weak kicker, on a paired board — not strong',
    text: OVERBET_TOP_PAIR_BOARD_PAIR,
    want: [['flop:check', ['pfa-check-flop']]],
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

  it('takes the last preflop raiser with chips behind as the aggressor', () => {
    // A raiser who is all-in never acts postflop, so naming them would make
    // every flop lead a donk-bet and hide the real raiser's check.
    expect(hero(MTT2, 'TM6393633744')).toMatchObject({ preflopRaiser: 'Hero', pfa: true });
    expect(hero(ALL_IN_RAISER_ONLY)).toMatchObject({ preflopRaiser: null, pfa: false });
  });

  it('counts a preflop all-in among the players who saw the flop', () => {
    // An all-in player never acts on the flop, so counting flop actors missed
    // them: TM6393633744 is three-way to the flop, TM6393142394 four-way.
    expect(hero(MTT2, 'TM6393633744').playersToFlop).toBe(3);
    expect(labelledDecisions(hero(MTT2, 'TM6393633744'))[0].playersToFlop).toBe(3);
    expect(hero(MTT2, 'TM6393142394').playersToFlop).toBe(4);
    expect(hero(ALL_IN_RAISER_ONLY).playersToFlop).toBe(3);
    // No flop, nobody saw one.
    expect(hero(MTT2, 'TM6390221998').playersToFlop).toBe(0);
  });

  it('prices a fold to a raise of Hero’s own bet', () => {
    // RC4857718745: Hero c-bets a third of the pot, BB raises to 0.75 of it.
    const [d] = labelledDecisions(hero(RC2, 'RC4857718745'));
    expect(d.facedSizing).toBeCloseTo(0.75, 2);
    expect(d.line).toBe('ffffR100c / B33r75F');
  });

  it('prints a jam in the line at the size anyone could call', () => {
    // RC4848809818: $34.27 of the $45.11 jam is callable into $36.77.
    expect(actionLine(hero(RC2, 'RC4848809818'), 'turn').split(' / ').at(-1)).toBe('B93');
  });

  it('reads one pair beside a board pair as marginal-made', () => {
    // The labels above would fire with `strong` too; the class is the facet a
    // coach reads them by, so pin it on the decisions themselves.
    const ds = labelledDecisions(hero(PROBE_UNDER_BOARD_PAIR));
    expect(ds.map((d) => [`${d.street}:${d.kind}`, d.handClass])).toEqual([
      ['turn:bet', 'marginal-made'],
      ['river:check', 'marginal-made'],
    ]);
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

  it('never shares the cash chart key, which every cash hand reads', () => {
    // 'cash' is a constant of the variant, not something the instances agree
    // on: sharing it made every cash group of two a "pattern". The two
    // check-raises differ in seat, hand class and board.
    const cash = labelGroups([hero(RC2, 'RC4848809818'), hero(RC2, 'RC4834989265')]);
    expect(cash.find((g) => g.label === 'check-raise-flop')?.shared).toEqual({});
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
