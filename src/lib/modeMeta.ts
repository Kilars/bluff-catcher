/**
 * Each mode's one-line note in the menus (desktop dropdown and phone sheet),
 * so the two never drift (docs/PLAN-menu.md). The facing modes' notes are
 * derived from the charts they deal, so a new chart updates its note.
 */

import type { AppMode } from '../hooks/useAppPrefs';
import { MODE_CONTEXT_LABEL } from './facingMeta';
import { positionLabel } from './preflop/boundary';
import { BUCKET_META, bucketsForMode, type FacingMode } from './preflop/facing';
import type { Format } from './preflop/ranges';

/** The decision each facing mode drills. */
const MODE_ACTION: Record<FacingMode, string> = {
  threebet: 'Fold, call or 3-bet vs an open',
  fourbet: 'Fold, call or 4-bet after a 3-bet',
  blinds: 'Fold, call or 3-bet from the blinds',
};

/** Hero's seats in a mode, in deal order: "BTN/HJ/CO". */
export function modeSeats(mode: FacingMode, format: Format): string {
  return [...new Set(bucketsForMode(format, mode).map((b) => positionLabel(BUCKET_META[b].hero)))].join('/');
}

/** "Fold, call or 3-bet vs an open · BTN/HJ/CO · 40–50bb+". */
export function modeNote(mode: AppMode, format: Format): string {
  switch (mode) {
    case 'odds':
      return 'Chance you improve by the river';
    case 'preflop':
      return format === 'mtt' ? 'Open or fold, by seat and stack' : 'Open or fold, by seat · cash 6-max';
    case 'threebet':
    case 'fourbet':
    case 'blinds': {
      const stack = MODE_CONTEXT_LABEL[mode][format].split(' · ')[1].toLowerCase();
      const seats = mode === 'blinds' ? '' : ` · ${modeSeats(mode, format)}`;
      return `${MODE_ACTION[mode]}${seats} · ${stack}`;
    }
  }
}
