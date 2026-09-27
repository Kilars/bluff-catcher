/**
 * Shared display metadata for the facing-open (3-bet) mode, so the label lives
 * in exactly one place and Header, PhoneTopBar and FacingTrainer never drift.
 *
 * Unlike preflop RFI, facing mode has no depth picker (see docs/PLAN-3bet.md,
 * "Depth caveat" — the source chart is one span, 50bb+, not a tier the player
 * switches between), so this is the whole of its context string rather than
 * something composed with a depth label.
 */

export const FACING_CONTEXT_LABEL = 'vs open · 50bb+';

/**
 * The phone top bar's context chip. Shorter than FACING_CONTEXT_LABEL because
 * at 390px the full "vs open · 50bb+" chip pushed the stats pill off the bar
 * (it clipped the accuracy). Facing has one depth, so the chip has nothing to
 * pick there; the 50bb+ figure moves to the seat-ladder line under it.
 */
export const FACING_CHIP_LABEL = 'vs open';
