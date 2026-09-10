/**
 * band — the one definition of what "green" means.
 *
 * A guess is scored by its absolute error in percentage points against the
 * true equity. That error falls into one of three bands, and the band is what
 * the stats hook tallies, what the dock colours the reveal with, and what the
 * header's band dots count. Every one of those has to agree, so the thresholds,
 * the colour tokens and the copy live here rather than beside any one consumer.
 *
 * Previously duplicated: the thresholds and `bandOf` in `modes/OddsTrainer.tsx`,
 * the colour and label maps in `components/Dock.tsx`. Two presentation trees
 * (desktop and phone) render the same band, so a second copy is a drift bug
 * waiting to happen.
 *
 * Boundaries are inclusive at the top: a delta of exactly 5 is green, exactly
 * 10 is amber. This is the existing behaviour and is load-bearing for the
 * stats fixtures.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Band = 'green' | 'amber' | 'red';

// ─── Scoring constants ────────────────────────────────────────────────────────

/** Absolute error (percentage points) at or under which a guess is green. */
export const GREEN_BAND = 5;

/** Absolute error (percentage points) at or under which a guess is amber. */
export const AMBER_BAND = 10;

// ─── Presentation maps ────────────────────────────────────────────────────────

/** CSS custom property per band — the reveal colour. */
export const BAND_COLOR: Record<Band, string> = {
  green: 'var(--band-green)',
  amber: 'var(--band-amber)',
  red: 'var(--band-red)',
};

/** Human copy per band — shown beside the delta after a commit. */
export const BAND_LABEL: Record<Band, string> = {
  green: 'On the money',
  amber: 'Close',
  red: 'Off',
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

/** Classify an absolute error in percentage points into its band. */
export function bandOf(delta: number): Band {
  if (delta <= GREEN_BAND) return 'green';
  if (delta <= AMBER_BAND) return 'amber';
  return 'red';
}
