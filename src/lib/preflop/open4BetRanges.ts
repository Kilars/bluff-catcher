/**
 * Opener vs 3-bet charts (cash): hero opens from LJ, HJ or CO, a seat behind
 * 3-bets, everyone else folds, and hero folds, calls or 4-bets. Pure, no UI
 * imports. The BTN's own spot lives in `btn4BetRanges.ts`.
 *
 * ── Where these come from ─────────────────────────────────────────────────
 * `Cash_100_PTO` from `jensbaagaard/poker-practice` (same repo and commit as
 * `cashRanges.ts`): keys `4Bet<opener>vs<seat>`, `Call 3Bet<opener>vs<seat>`
 * and `Call 5Bet<opener>vs<seat>`, vendored in `research/open-4bet-pto.json`.
 * `open4BetRanges.test.ts` checks every list below against it for every
 * 3-bettor. Same provenance caveat (licence unclear; personal use).
 *
 * ── One chart per opener ──────────────────────────────────────────────────
 * The source answers a 3-bet the same way whoever made it, so each opener has
 * one chart. Only the sizes change with the 3-bettor (`facing.ts`).
 *
 * ── Value and bluff ───────────────────────────────────────────────────────
 * As in the BTN chart: a 4-bet that calls a 5-bet jam is value, one that
 * folds to it is a bluff. JJ is a bluff from the LJ only.
 *
 * Hero only reaches this spot with a hand they opened, so the dealer deals
 * from `CASH_RFI[opener]`. Hands not listed fold.
 */

import type { HandClass } from './hands.ts';
import type { FourBetChart } from './facing.ts';

/** The cash seats that open and can be 3-bet by a seat behind (the BTN has its own drill). */
export const OPEN4_OPENERS = ['LJ', 'HJ', 'CO'] as const;
export type Open4Opener = (typeof OPEN4_OPENERS)[number];

/** The seats behind each opener that can 3-bet it, in action order. */
export const OPEN4_THREE_BETTORS: Record<Open4Opener, readonly ('HJ' | 'CO' | 'BTN' | 'SB' | 'BB')[]> = {
  LJ: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  HJ: ['CO', 'BTN', 'SB', 'BB'],
  CO: ['BTN', 'SB', 'BB'],
};

/** The calls are the same from every opener but the LJ, which drops 66. */
const CALLS = ['TT', '99', '88', '77', '66', 'AQs', 'AJs', 'KQs', 'KJs'] as const;

export const OPEN4_CASH_CHARTS: Record<Open4Opener, FourBetChart> = {
  /** value 34 / bluff 18 / call 40 (of 220 opened). */
  LJ: {
    fourBet: {
      value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AKo']),
      bluff: new Set<HandClass>(['JJ', 'ATs', 'A5s', 'KTs']),
    },
    call: new Set<HandClass>(CALLS.filter((hc) => hc !== '66')),
  },
  /** value 40 / bluff 12 / call 46 (of 282 opened). */
  HJ: {
    fourBet: {
      value: new Set<HandClass>(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo']),
      bluff: new Set<HandClass>(['ATs', 'A5s', 'KTs']),
    },
    call: new Set<HandClass>(CALLS),
  },
  /** value 40 / bluff 24 / call 46 (of 354 opened). */
  CO: {
    fourBet: {
      value: new Set<HandClass>(['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo']),
      bluff: new Set<HandClass>(['ATs', 'A5s', 'KTs', 'AQo']),
    },
    call: new Set<HandClass>(CALLS),
  },
};
