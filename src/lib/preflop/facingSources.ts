/**
 * The six BTN facing-open source charts, one per opener. Pure, no UI imports.
 *
 * Transcribed from PokerCoaching's `full-preflop-charts.pdf`, p.6 "Facing
 * RFI: Button" (100bb, antes, applies ~50bb+) — see `facing.ts` for the
 * provenance and the depth caveat. Each chart's value / bluff / call combo
 * totals equal the counts printed under it in the pack, and
 * `facing.test.ts` pins them.
 *
 * The drill never grades against these directly: it grades against the two
 * bucket charts in `facing.ts` (`EARLY` = the UTG+1 chart, `LATE` = the LJ
 * chart). The six are kept for two readers:
 *   - the dealer's pool (`facingDeal.ts`), whose "trash" tier is defined as
 *     folding in *every* source chart;
 *   - the tests, which measure how far each opener's real chart sits from its
 *     bucket's chart, so a chart edit that drifts gets caught.
 *
 * Hands not listed fold.
 */

import type { HandClass } from './hands.ts';
import type { FacingChart, Opener } from './facing.ts';

export const FACING_SOURCES: Record<Opener, FacingChart> = {
  /** BTN vs UTG — value 34 / bluff 48 / call 108. */
  UTG: {
    value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AKo']),
    bluff: new Set<HandClass>(['A5s', 'A4s', '76s', 'AQo', 'AJo', 'KQo']),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s',
      '98s', '87s',
    ]),
  },
  /** BTN vs UTG+1 — value 34 / bluff 52 / call 116. */
  UTG1: {
    value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AKo']),
    bluff: new Set<HandClass>(['A5s', 'A4s', 'A3s', 'A2s', 'AQo', 'AJo', 'KQo']),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'J9s',
      'T9s', '98s', '87s', '76s',
    ]),
  },
  /** BTN vs UTG+2 — value 50 / bluff 52 / call 136. */
  UTG2: {
    value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AKo', 'AQo']),
    bluff: new Set<HandClass>(['A9s', 'A5s', 'A4s', 'A3s', 'A2s', '65s', '54s', 'ATo', 'KJo']),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AJs', 'ATs', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'J9s', 'T9s',
      '98s', '87s', '76s', 'AJo', 'KQo',
    ]),
  },
  /** BTN vs LJ — value 50 / bluff 60 / call 140. */
  LJ: {
    value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AKo', 'AQo']),
    bluff: new Set<HandClass>([
      'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', '65s', '54s', 'ATo',
      'KJo',
    ]),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'AJs', 'ATs', 'A9s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'J9s',
      'T9s', '98s', '87s', '76s', 'AJo', 'KQo',
    ]),
  },
  /** BTN vs HJ — value 54 / bluff 68 / call 152. */
  HJ: {
    value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AJs', 'AKo', 'AQo']),
    bluff: new Set<HandClass>([
      'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', '86s', '75s', '65s',
      '54s', 'ATo', 'KJo',
    ]),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'ATs', 'A9s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'Q9s', 'JTs',
      'J9s', 'T9s', 'T8s', '98s', '97s', '87s', '76s', 'AJo', 'KQo',
    ]),
  },
  /** BTN vs CO — value 54 / bluff 92 / call 184. */
  CO: {
    value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AJs', 'AKo', 'AQo']),
    bluff: new Set<HandClass>([
      'A8s', 'A7s', 'A6s', 'A3s', 'A2s', 'K8s', 'Q8s', 'J8s', '86s', '75s',
      '65s', '64s', '54s', '43s', 'A9o', 'KTo', 'QJo',
    ]),
    call: new Set<HandClass>([
      'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
      'ATs', 'A9s', 'A5s', 'A4s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs',
      'Q9s', 'JTs', 'J9s', 'T9s', 'T8s', '98s', '97s', '87s', '76s', 'AJo',
      'ATo', 'KQo', 'KJo',
    ]),
  },
};
