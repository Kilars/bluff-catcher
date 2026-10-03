/**
 * The curated "Seat vs open" spots: hero anywhere but the button or big
 * blind faces an open and folds, calls or 3-bets. Pure data, no UI imports.
 *
 * Adding a spot is one line here. The chart comes from `range.ts`, the bucket
 * from `facing.ts`, and the briefing is generated from the charts
 * (`seatBriefing` in `modes/facingBriefing.tsx`), so no other file changes
 * (docs/PLAN-range-generator.md, phase 4). A spot whose chart the source does
 * not have fails at module load and in `spots.test.ts`.
 */

import type { Format, TableSeat } from './ranges.ts';
import type { Stack } from './range.ts';

export interface CuratedSpot {
  format: Format;
  /** Hero's seat: acts after the opener. */
  hero: TableSeat;
  /** The seat that opened. */
  villain: TableSeat;
}

/**
 * The open hero faces, as the sources' sizing profiles solve it: 2.5bb in
 * cash (the SB 3bb), 2.3bb at 40bb (the SB 3.5bb).
 */
export function openSizeBb(format: Format, opener: TableSeat): number {
  if (format === 'cash') return opener === 'SB' ? 3 : 2.5;
  return opener === 'SB' ? 3.5 : 2.3;
}

/** The stack each format's spots are drawn from: the one source per format with a full seat grid. */
export const SPOT_STACK: Record<Format, Stack> = { cash: '100bb', mtt: '40bb' };

/**
 * Cash has only two distinct charts here: the source answers every open with
 * one 3-bet-or-fold chart wherever hero sits outside the BTN and BB (CO vs HJ
 * stands for HJ vs LJ, CO vs LJ and SB vs LJ/HJ/CO), and SB vs BTN is its own.
 * The 40bb source solves every seat pair apart.
 */
export const CURATED_SPOTS: readonly CuratedSpot[] = [
  { format: 'cash', hero: 'CO', villain: 'HJ' },
  { format: 'cash', hero: 'SB', villain: 'BTN' },
  { format: 'mtt', hero: 'HJ', villain: 'LJ' },
  { format: 'mtt', hero: 'CO', villain: 'HJ' },
  { format: 'mtt', hero: 'SB', villain: 'CO' },
  { format: 'mtt', hero: 'SB', villain: 'BTN' },
];
