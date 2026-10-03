/**
 * The curated "Seat vs open" spots: hero anywhere but the button or big
 * blind faces an open and folds, calls or 3-bets. Pure data, no UI imports.
 *
 * Adding a spot is one line here. The chart comes from `range.ts`, the bucket
 * from `facing.ts`, and the briefing is generated from the charts
 * (`modes/spotsBriefing.ts`), so no other file changes
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

/** The open size per stack, as the sources solve it (2.5bb cash, 2.3bb at 40bb). */
export const OPEN_BB: Record<Stack, number> = { '100bb': 2.5, '40bb': 2.3, '50bb+': 2.5 };

/** The stack each format's spots are drawn from: the one source per format with a full seat grid. */
export const SPOT_STACK: Record<Format, Stack> = { cash: '100bb', mtt: '40bb' };

export const CURATED_SPOTS: readonly CuratedSpot[] = [
  { format: 'cash', hero: 'CO', villain: 'LJ' },
  { format: 'cash', hero: 'CO', villain: 'HJ' },
  { format: 'cash', hero: 'SB', villain: 'BTN' },
  { format: 'mtt', hero: 'CO', villain: 'HJ' },
  { format: 'mtt', hero: 'SB', villain: 'BTN' },
];
