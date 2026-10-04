/**
 * Shared display metadata for the facing modes (3-bet, 4-bet, Blinds), so the
 * labels live in exactly one place and Header, PhoneTopBar and FacingTrainer
 * never drift.
 *
 * Unlike preflop RFI, these modes have no depth picker: each format's charts
 * come from one source depth (docs/PLAN-3bet.md, "Depth caveat"; cash is
 * 100bb), so this is the whole of the context string rather than something
 * composed with a depth label. One entry per mode and format.
 */

import type { FacingMode } from './preflop/facing';
import type { Format } from './preflop/ranges';

/** The header and table line, e.g. "3-bet · 40–50bb+". The BTN 3-bet charts are 50bb+, the seat pairs 40bb. */
export const MODE_CONTEXT_LABEL: Record<FacingMode, Record<Format, string>> = {
  threebet: { mtt: '3-bet · 40–50bb+', cash: '3-bet · Cash 100bb' },
  fourbet: { mtt: '4-bet · 40bb', cash: '4-bet · Cash 100bb' },
  blinds: { mtt: 'Blinds · 40bb', cash: 'Blinds · Cash 100bb' },
};

/**
 * The phone top bar's context chip, kept to ~7 characters: at 390px a longer
 * chip pushes the stats pill off the bar. The stack figure moves to the
 * seat-ladder line under it.
 */
export const MODE_CHIP_LABEL: Record<FacingMode, Record<Format, string>> = {
  threebet: { mtt: '3-bet', cash: '3b cash' },
  fourbet: { mtt: '4-bet', cash: '4b cash' },
  blinds: { mtt: 'Blinds', cash: 'Bl cash' },
};

/** The range sheet's and briefing's kicker per mode. */
export const MODE_KICKER: Record<FacingMode, string> = {
  threebet: 'Facing an open',
  fourbet: 'Facing a 3-bet',
  blinds: 'In the blinds',
};
