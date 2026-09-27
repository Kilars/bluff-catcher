/**
 * FacingTrainer — placeholder for the facing-open (3-bet) drill.
 *
 * Someone opens, it folds to hero on the button, and hero chooses
 * Fold / Call / 3-bet. See docs/PLAN-3bet.md for the full plan; this component
 * currently only stakes out the seam App.tsx routes to in facing mode. A later
 * phase (F0–F1 lib + dealer, F2 table/keys) replaces the body with the real
 * felt, deal loop and verdict — the props interface below is deliberately
 * small so that swap does not ripple back into App.
 *
 * Props:
 *   stats — the `usePreflopStats()` return value for this mode's own storage
 *     key (`bluff-catcher:facing:v1`, a second instance separate from RFI's).
 *     Facing stats are the same shape as preflop stats (hands / streak /
 *     accuracy), so the same hook is reused rather than a bespoke one.
 */

import type { usePreflopStats } from '../hooks/usePreflopStats';
import { FACING_CONTEXT_LABEL } from '../lib/facingMeta';

export interface FacingTrainerProps {
  /** This mode's own `usePreflopStats()` instance — see the file header. */
  stats: ReturnType<typeof usePreflopStats>;
}

export function FacingTrainer(_props: FacingTrainerProps) {
  return (
    <div data-testid="facing-trainer-placeholder">
      <p>Facing open — coming soon</p>
      <p>{FACING_CONTEXT_LABEL}</p>
    </div>
  );
}

export default FacingTrainer;
