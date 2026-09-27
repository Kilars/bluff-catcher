/**
 * Cash-game charts: 6-max, 100bb, no ante. Pure, no UI imports.
 *
 * ── Where these come from ─────────────────────────────────────────────────
 * `jensbaagaard/poker-practice`, `data/openSourcePokerData/Cash_100_PTO.json`
 * — the pure ("PTO", one action per hand) companion of that repo's mixed
 * 100bb cash solve. 2.5bb opens (SB 3bb). The keys used here are vendored in
 * `research/cash-100-pto.json`, and `cashRanges.test.ts` checks every list
 * below against it cell for cell. See docs/PLAN-cash.md, "Source", for the
 * cross-check against the mixed solve and the provenance caveat (scraped from
 * a commercial trainer; licence unclear; personal use).
 *
 * The source's rake is not stated. Real micro-stakes rake is high, which if
 * anything tightens the flats further.
 *
 * ── Opens (% of 1326 combos) ──────────────────────────────────────────────
 *   LJ 16.6 (220) · HJ 21.3 (282) · CO 26.7 (354) · BTN 41.8 (554) · SB 43.3 (574)
 * Same seats as the tournament charts, tighter ranges: no ante means less
 * dead money to win, and rake taxes small pots. The SB raises or folds — the
 * source has no limping range.
 *
 * ── Facing an open on the BTN ─────────────────────────────────────────────
 * The source uses one chart for vs LJ and vs HJ, so they share a bucket.
 *   vs LJ/HJ — 3-bet 110 / call 40 (11.3% continue)
 *   vs CO    — 3-bet 178 / call 40 (16.4% continue)
 * Cash BTN is almost 3-bet or fold. The source does not split 3-bets into
 * value and bluff, so these are plain charts: one `threeBet` set, no kind.
 *
 * Hands not listed fold.
 */

import type { HandClass } from './hands.ts';
import type { PlainChart } from './facing.ts';

/** The five cash seats that can open, in action order. */
export const CASH_SEATS = ['LJ', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type CashSeat = (typeof CASH_SEATS)[number];

/** Raise-first-in ranges per cash seat (source keys `Open<seat>`). */
export const CASH_RFI: Record<CashSeat, ReadonlySet<HandClass>> = {
  /** 220 combos, 16.6%. The first seat to act — GGPoker calls it UTG. */
  LJ: new Set<HandClass>([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s',
    'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'QJs', 'QTs',
    'JTs', 'T9s',
    'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo',
  ]),
  /** 282 combos, 21.3%. */
  HJ: new Set<HandClass>([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s',
    'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
    'QJs', 'QTs', 'Q9s', 'Q8s', 'JTs', 'J9s', 'T9s',
    'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'KQo', 'KJo', 'KTo', 'QJo', 'QTo',
  ]),
  /** 354 combos, 26.7%. */
  CO: new Set<HandClass>([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55',
    '44',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s',
    'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
    'K4s', 'K3s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'JTs',
    'J9s', 'J8s', 'J7s', 'T9s', 'T8s', '98s',
    'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'KQo', 'KJo', 'KTo', 'QJo',
    'QTo', 'JTo',
  ]),
  /** 554 combos, 41.8%. */
  BTN: new Set<HandClass>([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55',
    '44', '33', '22',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s',
    'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
    'K4s', 'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s',
    'Q4s', 'Q3s', 'Q2s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s',
    'T9s', 'T8s', 'T7s', 'T6s', '98s', '97s', '96s', '87s', '86s', '76s',
    '75s', '65s', '54s',
    'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o',
    'A3o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'QJo', 'QTo', 'Q9o', 'JTo',
    'J9o', 'T9o',
  ]),
  /** 574 combos, 43.3%. Raise to 3bb or fold; only the BB is behind. */
  SB: new Set<HandClass>([
    'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55',
    '44', '33', '22',
    'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s',
    'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
    'K4s', 'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s',
    'Q4s', 'Q3s', 'Q2s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s',
    'T9s', 'T8s', 'T7s', 'T6s', '98s', '97s', '96s', '87s', '86s', '85s',
    '76s', '75s', '65s', '64s', '54s',
    'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o',
    'A3o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'QJo', 'QTo', 'Q9o', 'JTo',
    'J9o', 'T9o', '98o',
  ]),
};

// ─── BTN facing an open ───────────────────────────────────────────────────────

/** The seats that can open into the button in 6-max. */
export const CASH_OPENERS = ['LJ', 'HJ', 'CO'] as const;
export type CashOpener = (typeof CASH_OPENERS)[number];

/** The flats are the same against every opener (source `CallBTNvs<seat>`). */
const CASH_BTN_CALL = new Set<HandClass>([
    '99', '88', '77', '66',
    'A9s', 'A8s', 'QTs', 'JTs',
  ]);

/**
 * BTN vs LJ and vs HJ — the source's two charts are identical.
 * 3-bet 110 + call 40 = 150 combos = 11.3% continue.
 */
export const CASH_VS_EARLY: PlainChart = {
  threeBet: new Set<HandClass>([
    'AA', 'KK', 'QQ', 'JJ', 'TT',
    'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s', 'KQs', 'KJs', 'KTs', 'QJs',
    '65s',
    'AKo', 'AQo', 'KQo',
  ]),
  call: CASH_BTN_CALL,
};

/**
 * BTN vs CO. 3-bet 178 + call 40 = 218 combos = 16.4% continue.
 * Only 3-bets are added vs the LJ/HJ chart: 54s, 76s, 87s, A7s, A6s, A3s,
 * A2s, K9s, AJo, ATo, KJo go from fold to 3-bet.
 */
export const CASH_VS_CO: PlainChart = {
  threeBet: new Set<HandClass>([
    'AA', 'KK', 'QQ', 'JJ', 'TT',
    'AKs', 'AQs', 'AJs', 'ATs', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    'KQs', 'KJs', 'KTs', 'K9s', 'QJs', '87s', '76s', '65s', '54s',
    'AKo', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo',
  ]),
  call: CASH_BTN_CALL,
};
