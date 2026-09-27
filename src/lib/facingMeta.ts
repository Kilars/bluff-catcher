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
