/**
 * BTN vs 3-bet charts: hero opens the button, a blind 3-bets, the other blind
 * folds, and hero folds, calls or 4-bets. Pure, no UI imports.
 *
 * ── Where these come from ─────────────────────────────────────────────────
 * `jensbaagaard/poker-practice`, `data/openSourcePokerData/`, the same repo
 * and commit as `cashRanges.ts` and `bbDefendRanges.ts`. Keys
 * `4BetBTNvs<SB|BB>` and `Call 3BetBTNvs<SB|BB>`, pure ("PTO": one action per
 * hand). Vendored in `research/btn-4bet-pto.json`. `btn4BetRanges.test.ts`
 * checks every list below against it cell for cell. Same provenance caveat
 * (scraped from a commercial trainer; licence unclear; personal use).
 *
 *   Cash — `Cash_100_PTO`: 6-max, 100bb, no ante. 2.5bb open, the blind
 *   3-bets out of position to 5× (12.5bb), and a 4-bet in position is 2×
 *   (25bb).
 *   Tournament — `MTT_40_PTO`: 9-max, 40bb, 1bb BB ante. 2.3bb open, 3-bet
 *   to 4× (9.2bb), and the 4-bet is all-in.
 *
 * ── Value and bluff (cash only) ───────────────────────────────────────────
 * The source does not label 4-bets, but it does say what hero does facing a
 * 5-bet jam (`Call 5BetBTNvs<seat>`). A 4-bet that calls the jam is value. A
 * 4-bet that folds to it is a bluff: it 4-bets for its blockers and gives up
 * when the 3-bettor goes all-in. This is the same lesson as the half-blue
 * bluff cells on the 3-bet charts. At 40bb the 4-bet *is* the jam, so there
 * is nothing to fold to and these charts are plain.
 *
 * ── Only opened hands are reachable ───────────────────────────────────────
 * Hero only gets here with a hand they opened, so every continue hand sits
 * inside the source's BTN open range, and the dealer deals from that range
 * alone (`BTN4_OPEN`). Cash reuses `CASH_RFI.BTN`, which is the same source
 * key. The tournament open range is the 40bb source's own, not the RFI
 * drill's PokerCoaching chart, so that the spot and its chart agree.
 *
 * Hands not listed fold.
 */

import type { HandClass } from './hands.ts';
import type { FourBetChart } from './facing.ts';
import type { Format } from './ranges.ts';
import { CASH_RFI } from './cashRanges.ts';

/** The blinds that can 3-bet a button open, in action order. */
export const BTN4_THREE_BETTORS = ['SB', 'BB'] as const;
export type ThreeBettor = (typeof BTN4_THREE_BETTORS)[number];

/** Cash 100bb. The source's vs SB and vs BB charts are identical. */
const CASH_VS_BLIND: FourBetChart = {
  /** value 50 / bluff 40 / call 68 (of 554 opened). */
  fourBet: {
    value: new Set<HandClass>([
      'AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo',
    ]),
    bluff: new Set<HandClass>(['A5s', 'AQo', 'AJo', 'KQo']),
  },
  call: new Set<HandClass>([
    '99', '88', '77', '66', 'AJs', 'ATs', 'A9s', 'A8s', 'KQs', 'KJs',
    'KTs', 'K9s', 'QJs', 'QTs', 'JTs',
  ]),
};

export const BTN4_CASH_CHARTS: Record<ThreeBettor, FourBetChart> = {
  SB: CASH_VS_BLIND,
  BB: CASH_VS_BLIND,
};

/**
 * Tournament 40bb. The 4-bet is a jam, so the solver flats AA/KK (and QQ/AKs
 * vs the BB) to keep the 3-bettor's bluffs in, and jams the strong-but-not-
 * best hands (JJ, TT, AQ, KQo, AK) that would rather not play a bloated pot.
 */
export const BTN4_MTT_CHARTS: Record<ThreeBettor, FourBetChart> = {
  /** 4-bet 90 / call 194 (of 664 opened). */
  SB: {
    fourBet: new Set<HandClass>([
      'QQ', 'JJ', 'TT', '88', '77', '44', '33', 'AKs', 'AQs', 'KQs',
      'AKo', 'AQo', 'KQo',
    ]),
    call: new Set<HandClass>([
      'AA', 'KK', '99', '66', '55', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s',
      'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s',
      'K6s', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s', 'J8s', 'T9s', 'T8s', '98s',
      '87s', '76s', '65s', '54s', 'AJo', 'ATo', 'KJo', 'QJo',
    ]),
  },
  /** 4-bet 70 / call 274 (of 664 opened). */
  BB: {
    fourBet: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '33', 'AQs', 'AKo', 'AQo', 'KQo',
    ]),
    call: new Set<HandClass>([
      'AA', 'KK', 'QQ', '77', '66', '55', '44', 'AKs', 'AJs', 'ATs',
      'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs',
      'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'QJs', 'QTs', 'Q9s', 'Q8s',
      'JTs', 'J9s', 'J8s', 'T9s', 'T8s', '98s', '97s', '87s', '76s', '65s',
      '54s', 'AJo', 'ATo', 'A9o', 'KJo', 'KTo', 'QJo', 'QTo', 'JTo',
    ]),
  },
};

/** The 40bb source's BTN open (664 combos, 50.1%) — the hands hero can hold here. */
const MTT40_OPEN_BTN = new Set<HandClass>([
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55',
  '44', '33', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s',
  'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s',
  'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s',
  'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s',
  'J5s', 'J4s', 'J3s', 'T9s', 'T8s', 'T7s', 'T6s', 'T5s', '98s', '97s',
  '96s', '95s', '87s', '86s', '85s', '76s', '75s', '65s', '64s', '54s',
  'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o',
  'A3o', 'A2o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'QJo',
  'QTo', 'Q9o', 'Q8o', 'JTo', 'J9o', 'J8o', 'T9o', 'T8o', '98o', '87o',
]);

/** The BTN open range per format: the only hands this drill deals. */
export const BTN4_OPEN: Record<Format, ReadonlySet<HandClass>> = {
  cash: CASH_RFI.BTN,
  mtt: MTT40_OPEN_BTN,
};
