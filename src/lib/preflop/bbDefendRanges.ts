/**
 * Big-blind defence charts: someone opens, it folds to hero in the BB, and
 * hero folds, calls or 3-bets. Pure, no UI imports.
 *
 * ── Where these come from ─────────────────────────────────────────────────
 * `jensbaagaard/poker-practice`, `data/openSourcePokerData/` — the same repo
 * the cash drills vendor (`cashRanges.ts`). Keys `3BetBBvs<seat>` and
 * `CallBBvs<seat>`, pure ("PTO": one action per hand). Vendored in
 * `research/bb-defend-pto.json`; `bbDefendRanges.test.ts` checks every list
 * below against it cell for cell. Same provenance caveat as the cash charts
 * (scraped from a commercial trainer; licence unclear; personal use).
 *
 *   Tournament — `MTT_40_PTO`: 9-max, 40bb, 1bb BB ante, 2.3bb opens (SB
 *   3.5bb), 3-bets out of position to ~4×. The SB never limps at this depth.
 *   Cash — `Cash_100_PTO`: 6-max, 100bb, no ante, 2.5bb opens (SB 3bb).
 *
 * ── One chart per opener, no buckets ──────────────────────────────────────
 * Unlike the BTN drill, BB defence moves a lot from seat to seat: neighbouring
 * openers differ by 74–304 combos (of 1326) at 40bb and 52–176 in cash, so any
 * bucketing would grade hundreds of combos wrong. Each opener gets its exact
 * chart (docs/PLAN-bb-defend.md, "Buckets").
 *
 * The source does not split 3-bets into value and bluff, so these are plain
 * charts. Pure charts round the solver's mixes: hands on a border are close.
 *
 * Hands not listed fold.
 */

import type { HandClass } from './hands.ts';
import type { PlainChart } from './facing.ts';

/** Seats that can open into the BB at a 9-max tournament table, in action order. */
export const BB_MTT_OPENERS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type BbMttOpener = (typeof BB_MTT_OPENERS)[number];

/** Seats that can open into the BB at a 6-max cash table, in action order. */
export const BB_CASH_OPENERS = ['LJ', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type BbCashOpener = (typeof BB_CASH_OPENERS)[number];

/** Tournament, 40bb with a BB ante. Source seats EP1/EP2/EP3 are UTG/UTG+1/UTG+2. */
export const BB_MTT_CHARTS: Record<BbMttOpener, PlainChart> = {
  /** 3-bet 76 / call 510 — defends 44.2%. */
  UTG: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo', 'AQo', 'A5o', 'KJo',
    ]),
    call: new Set<HandClass>([
      'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AQs',
      'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
      'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s',
      'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s',
      'Q2s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s',
      'T9s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s', '98s', '97s',
      '96s', '95s', '94s', '93s', '92s', '87s', '86s', '85s', '84s', '83s',
      '76s', '75s', '74s', '73s', '65s', '64s', '63s', '62s', '54s', '53s',
      '52s', '43s', '42s', '32s', 'AJo', 'ATo', 'A9o', 'A8o', 'KQo', 'KTo',
      'QJo', 'QTo', 'JTo', 'T9o', '98o', '76o', '65o',
    ]),
  },
  /** 3-bet 86 / call 552 — defends 48.1%. */
  UTG1: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'K4s', 'AKo', 'AQo', 'A5o',
      'A4o',
    ]),
    call: new Set<HandClass>([
      '99', '88', '77', '66', '55', '44', '33', '22', 'AQs', 'AJs',
      'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs',
      'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K3s', 'K2s', 'QJs',
      'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'JTs',
      'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s', 'T9s', 'T8s',
      'T7s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s', '98s', '97s', '96s', '95s',
      '94s', '93s', '92s', '87s', '86s', '85s', '84s', '83s', '82s', '76s',
      '75s', '74s', '73s', '65s', '64s', '63s', '62s', '54s', '53s', '52s',
      '43s', '42s', '32s', 'AJo', 'ATo', 'A9o', 'A8o', 'KQo', 'KJo', 'KTo',
      'K9o', 'QJo', 'QTo', 'JTo', 'J9o', 'T9o', '98o', '76o', '65o', '54o',
    ]),
  },
  /** 3-bet 98 / call 604 — defends 52.9%. */
  UTG2: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'K6s', 'AKo', 'AQo', 'A5o',
      'A4o', 'JTo',
    ]),
    call: new Set<HandClass>([
      '99', '88', '77', '66', '55', '44', '33', '22', 'AQs', 'AJs',
      'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs',
      'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs',
      'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'JTs',
      'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s', 'T9s', 'T8s',
      'T7s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s', '98s', '97s', '96s', '95s',
      '94s', '93s', '92s', '87s', '86s', '85s', '84s', '83s', '82s', '76s',
      '75s', '74s', '73s', '72s', '65s', '64s', '63s', '62s', '54s', '53s',
      '52s', '43s', '42s', '32s', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A3o',
      'KQo', 'KJo', 'KTo', 'K9o', 'QJo', 'QTo', 'Q9o', 'J9o', 'T9o', 'T8o',
      '98o', '87o', '76o', '65o', '54o',
    ]),
  },
  /** 3-bet 90 / call 660 — defends 56.6%. */
  LJ: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'K7s', 'K6s', 'AKo', 'AQo',
      'AJo', 'KTo',
    ]),
    call: new Set<HandClass>([
      '99', '88', '77', '66', '55', '44', '33', '22', 'AQs', 'AJs',
      'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs',
      'KJs', 'KTs', 'K9s', 'K8s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QTs',
      'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'JTs', 'J9s',
      'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s', 'T9s', 'T8s', 'T7s',
      'T6s', 'T5s', 'T4s', 'T3s', 'T2s', '98s', '97s', '96s', '95s', '94s',
      '93s', '92s', '87s', '86s', '85s', '84s', '83s', '82s', '76s', '75s',
      '74s', '73s', '72s', '65s', '64s', '63s', '62s', '54s', '53s', '52s',
      '43s', '42s', '32s', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o',
      'A3o', 'KQo', 'KJo', 'K9o', 'K8o', 'K7o', 'QJo', 'QTo', 'Q9o', 'JTo',
      'J9o', 'T9o', 'T8o', '98o', '97o', '87o', '76o', '65o', '54o',
    ]),
  },
  /** 3-bet 128 / call 670 — defends 60.2%. */
  HJ: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AKo', 'AQo',
      'AJo', 'A9o', 'A6o', 'A5o', 'T9o',
    ]),
    call: new Set<HandClass>([
      '88', '77', '66', '55', '44', '33', '22', 'AJs', 'ATs', 'A9s',
      'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs',
      'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QTs',
      'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'JTs', 'J9s',
      'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s', 'T9s', 'T8s', 'T7s',
      'T6s', 'T5s', 'T4s', 'T3s', 'T2s', '98s', '97s', '96s', '95s', '94s',
      '93s', '92s', '87s', '86s', '85s', '84s', '83s', '82s', '76s', '75s',
      '74s', '73s', '72s', '65s', '64s', '63s', '62s', '54s', '53s', '52s',
      '43s', '42s', '32s', 'ATo', 'A8o', 'A7o', 'A4o', 'A3o', 'A2o', 'KQo',
      'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'K5o', 'QJo', 'QTo', 'Q9o',
      'JTo', 'J9o', 'J8o', 'T8o', '98o', '97o', '87o', '76o', '65o', '54o',
    ]),
  },
  /** 3-bet 166 / call 716 — defends 66.5%. */
  CO: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', 'AQs', 'AJs',
      'KQs', 'AKo', 'AQo', 'AJo', 'A7o', 'A4o', 'K9o', 'K6o', 'Q9o', 'T7o',
    ]),
    call: new Set<HandClass>([
      '77', '66', '55', '44', '33', '22', 'ATs', 'A9s', 'A8s', 'A7s',
      'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s',
      'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s',
      'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s',
      'J5s', 'J4s', 'J3s', 'J2s', 'T9s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s',
      'T3s', 'T2s', '98s', '97s', '96s', '95s', '94s', '93s', '92s', '87s',
      '86s', '85s', '84s', '83s', '82s', '76s', '75s', '74s', '73s', '72s',
      '65s', '64s', '63s', '62s', '54s', '53s', '52s', '43s', '42s', '32s',
      'ATo', 'A9o', 'A8o', 'A6o', 'A5o', 'A3o', 'A2o', 'KQo', 'KJo', 'KTo',
      'K8o', 'K7o', 'K5o', 'K4o', 'K3o', 'QJo', 'QTo', 'Q8o', 'Q7o', 'Q6o',
      'JTo', 'J9o', 'J8o', 'T9o', 'T8o', '98o', '97o', '87o', '86o', '76o',
      '65o', '54o',
    ]),
  },
  /** 3-bet 218 / call 820 — defends 78.3%. */
  BTN: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs',
      'AQs', 'AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'A7o', 'A6o',
      'A3o', 'KQo', 'K5o', 'QJo', 'Q8o', 'T7o',
    ]),
    call: new Set<HandClass>([
      '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s',
      'A3s', 'A2s', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s',
      'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s',
      'Q3s', 'Q2s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s',
      'J2s', 'T9s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s', '98s',
      '97s', '96s', '95s', '94s', '93s', '92s', '87s', '86s', '85s', '84s',
      '83s', '82s', '76s', '75s', '74s', '73s', '72s', '65s', '64s', '63s',
      '62s', '54s', '53s', '52s', '43s', '42s', '32s', 'A9o', 'A8o', 'A5o',
      'A4o', 'A2o', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'K4o', 'K3o',
      'K2o', 'QTo', 'Q9o', 'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o', 'JTo',
      'J9o', 'J8o', 'J7o', 'J6o', 'J5o', 'T9o', 'T8o', 'T6o', '98o', '97o',
      '96o', '87o', '86o', '76o', '75o', '65o', '64o', '54o', '53o',
    ]),
  },
  /** 3-bet 208 / call 754 — defends 72.5%. */
  SB: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '66', 'AKs', 'AQs',
      'AJs', 'ATs', 'AKo', 'AQo', 'AJo', 'A9o', 'A6o', 'A2o', 'K4o', 'K3o',
      'K2o', 'J6o', 'T6o', '96o',
    ]),
    call: new Set<HandClass>([
      '77', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s',
      'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s',
      'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s',
      'Q5s', 'Q4s', 'Q3s', 'Q2s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s',
      'J4s', 'J3s', 'J2s', 'T9s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s', 'T3s',
      'T2s', '98s', '97s', '96s', '95s', '94s', '93s', '92s', '87s', '86s',
      '85s', '84s', '83s', '82s', '76s', '75s', '74s', '73s', '65s', '64s',
      '63s', '62s', '54s', '53s', '52s', '43s', '42s', '32s', 'ATo', 'A8o',
      'A7o', 'A5o', 'A4o', 'A3o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o',
      'K6o', 'K5o', 'QJo', 'QTo', 'Q9o', 'Q8o', 'Q7o', 'Q6o', 'Q5o', 'Q4o',
      'JTo', 'J9o', 'J8o', 'J7o', 'T9o', 'T8o', 'T7o', '98o', '97o', '87o',
      '86o', '76o', '65o', '54o',
    ]),
  },
};

/** Cash, 6-max, 100bb, no ante. */
export const BB_CASH_CHARTS: Record<BbCashOpener, PlainChart> = {
  /** 3-bet 86 / call 204 — defends 21.9%. */
  LJ: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'AKs', 'AQs', 'A5s', 'A4s', '87s', '76s', '65s',
      '54s', 'AKo', 'AQo', 'KQo',
    ]),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A3s', 'A2s', 'KQs', 'KJs',
      'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'QJs', 'QTs', 'Q9s', 'JTs',
      'J9s', 'T9s', 'T8s', 'T7s', '98s', '97s', '96s', '86s', '85s', '75s',
      '64s', '53s', '43s', 'AJo',
    ]),
  },
  /** 3-bet 86 / call 256 — defends 25.8%. */
  HJ: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'AKs', 'AQs', 'A5s', 'A4s', '87s', '76s', '65s',
      '54s', 'AKo', 'AQo', 'KQo',
    ]),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A3s', 'A2s', 'KQs', 'KJs',
      'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'QJs', 'QTs',
      'Q9s', 'Q8s', 'JTs', 'J9s', 'J8s', 'T9s', 'T8s', 'T7s', '98s', '97s',
      '96s', '86s', '85s', '75s', '64s', '53s', '43s', 'AJo', 'ATo', 'KJo',
      'QJo',
    ]),
  },
  /** 3-bet 118 / call 288 — defends 30.6%. */
  CO: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'A5s', 'A4s', 'A3s',
      'A2s', '87s', '76s', '65s', '54s', 'AKo', 'AQo', 'AJo', 'KQo',
    ]),
    call: new Set<HandClass>([
      '99', '88', '77', '66', '55', '44', '33', '22', 'AJs', 'ATs',
      'A9s', 'A8s', 'A7s', 'A6s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s',
      'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s',
      'Q6s', 'Q5s', 'Q4s', 'JTs', 'J9s', 'J8s', 'T9s', 'T8s', 'T7s', '98s',
      '97s', '96s', '86s', '85s', '75s', '74s', '64s', '63s', '53s', '43s',
      'ATo', 'A9o', 'KJo', 'KTo', 'QJo', 'JTo',
    ]),
  },
  /** 3-bet 188 / call 342 — defends 40.0%. */
  BTN: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'A5s',
      'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'QJs', 'JTs', 'T9s', '98s', '87s',
      '76s', '65s', '54s', 'AKo', 'AQo', 'AJo', 'A7o', 'A6o', 'A5o', 'KQo',
    ]),
    call: new Set<HandClass>([
      '88', '77', '66', '55', '44', '33', '22', 'ATs', 'A9s', 'A8s',
      'A7s', 'A6s', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s',
      'K2s', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
      'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'T8s', 'T7s', 'T6s', '97s',
      '96s', '86s', '85s', '75s', '74s', '64s', '63s', '53s', '43s', 'ATo',
      'A9o', 'A8o', 'KJo', 'KTo', 'K9o', 'QJo', 'QTo', 'JTo', 'J9o', 'T9o',
    ]),
  },
  /** 3-bet 236 / call 458 — defends 52.3%. */
  SB: {
    threeBet: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs',
      'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs',
      'T9s', '98s', '87s', '76s', '65s', '54s', 'AKo', 'AQo', 'AJo', 'A7o',
      'A6o', 'A5o', 'A4o', 'A3o', 'A2o', 'KQo',
    ]),
    call: new Set<HandClass>([
      '88', '77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s',
      'A6s', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'Q9s',
      'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'J9s', 'J8s', 'J7s',
      'J6s', 'J5s', 'J4s', 'J3s', 'J2s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s',
      'T3s', 'T2s', '97s', '96s', '95s', '86s', '85s', '84s', '75s', '74s',
      '64s', '63s', '53s', '52s', '43s', '42s', '32s', 'ATo', 'A9o', 'A8o',
      'KJo', 'KTo', 'K9o', 'K8o', 'QJo', 'QTo', 'Q9o', 'JTo', 'J9o', 'T9o',
      'T8o', '98o', '87o', '76o', '65o',
    ]),
  },
};
