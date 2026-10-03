/**
 * Shared display metadata for the facing-open (3-bet) mode, so the label lives
 * in exactly one place and Header, PhoneTopBar and FacingTrainer never drift.
 *
 * Unlike preflop RFI, facing mode has no depth picker (see docs/PLAN-3bet.md,
 * "Depth caveat" — the tournament chart is one span, 50bb+; cash is 100bb), so
 * this is the whole of its context string rather than something composed with
 * a depth label. One entry per format.
 */

import type { Format } from './preflop/ranges';

export const FACING_CONTEXT_LABEL: Record<Format, string> = {
  mtt: 'vs open · 50bb+',
  cash: 'vs open · Cash 100bb',
};

/**
 * The phone top bar's context chip. Shorter than FACING_CONTEXT_LABEL because
 * at 390px the full "vs open · 50bb+" chip pushed the stats pill off the bar
 * (it clipped the accuracy). Facing has one depth, so the chip has nothing to
 * pick there; the stack figure moves to the seat-ladder line under it. In cash
 * the chip names the format — "Cash" is no wider than "vs open".
 */
export const FACING_CHIP_LABEL: Record<Format, string> = {
  mtt: 'vs open',
  cash: 'Cash',
};

/** BB-defence mode's context string (docs/PLAN-bb-defend.md): one depth per format. */
export const BB_CONTEXT_LABEL: Record<Format, string> = {
  mtt: 'BB defend · 40bb',
  cash: 'BB defend · Cash 100bb',
};

/** BB-defence mode's phone chip — kept to ~7 characters for the 390px bar. */
export const BB_CHIP_LABEL: Record<Format, string> = {
  mtt: 'BB 40bb',
  cash: 'BB cash',
};

/** BTN vs 3-bet mode's context string (docs/PLAN-btn-4bet.md): one depth per format. */
export const BTN4_CONTEXT_LABEL: Record<Format, string> = {
  mtt: 'BTN vs 3-bet · 40bb',
  cash: 'BTN vs 3-bet · Cash 100bb',
};

/** BTN vs 3-bet mode's phone chip — kept to ~7 characters for the 390px bar. */
export const BTN4_CHIP_LABEL: Record<Format, string> = {
  mtt: 'vs 3b',
  cash: '3b cash',
};

/** Seat vs open mode's context string (docs/PLAN-range-generator.md): one stack per format. */
export const SEAT_CONTEXT_LABEL: Record<Format, string> = {
  mtt: 'Seat vs open · 40bb',
  cash: 'Seat vs open · Cash 100bb',
};

/** Seat vs open mode's phone chip — kept to ~7 characters for the 390px bar. */
export const SEAT_CHIP_LABEL: Record<Format, string> = {
  mtt: 'Seat 40',
  cash: 'Seat cash',
};

/** Open vs 3-bet mode's context string: cash only, whatever the format switch says. */
export const OPEN4_CONTEXT_LABEL: Record<Format, string> = {
  mtt: 'Open vs 3-bet · Cash 100bb',
  cash: 'Open vs 3-bet · Cash 100bb',
};

/** Open vs 3-bet mode's phone chip — kept to ~7 characters for the 390px bar. */
export const OPEN4_CHIP_LABEL = 'op v 3b';
