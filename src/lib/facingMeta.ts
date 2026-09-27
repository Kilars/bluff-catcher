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
