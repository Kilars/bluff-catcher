/**
 * PhoneStatsPill — the collapsed stats readout in the phone top bar.
 *
 * PLAN-phone §5.3: two glanceable numbers, both of which change on commit,
 * because that is the whole in-drill job of the stats. Everything else — hands,
 * best streak, avg error, the per-category breakdown, Reset — lives in the
 * sheet this pill opens.
 *
 *   odds     streak, then the three-dot band tally (green / amber / red)
 *   preflop  streak, then accuracy
 *
 * The pill is a 44px tap target built out of padding, so the numbers stay small
 * enough for a 44px bar to hold them beside the brand and the context chip.
 *
 * Presentation only: it renders the numbers it is handed.
 */

import type { Bands } from '../../hooks/useStats';
import styles from './PhoneStatsPill.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommonProps {
  /** Opens the stats sheet. */
  onPress: () => void;
}

export type PhoneStatsPillProps = CommonProps &
  (
    | {
        mode: 'odds';
        streak: number;
        /** Session tally by band — the three dots. */
        bands: Bands;
      }
    | {
        mode: 'preflop';
        streak: number;
        /** 0–100. Rendered as "—" until the first hand. */
        accuracy: number;
        /** Hands committed; only used to decide whether accuracy means anything yet. */
        hands: number;
      }
  );

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneStatsPill(props: PhoneStatsPillProps) {
  const { streak, onPress } = props;

  const accuracyText =
    props.mode === 'preflop'
      ? props.hands === 0
        ? '—'
        : `${props.accuracy.toFixed(0)}%`
      : null;

  // Spoken in full: on screen these are three coloured dots and a bare number,
  // which is exactly the sort of thing a screen reader cannot infer.
  const ariaLabel =
    props.mode === 'odds'
      ? `Session stats. Streak ${streak}. ${props.bands.green} on the money, ` +
        `${props.bands.amber} close, ${props.bands.red} off. Opens details.`
      : `Session stats. Streak ${streak}. Accuracy ${accuracyText}. Opens details.`;

  return (
    <button
      type="button"
      className={styles.pill}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      onClick={onPress}
      data-testid="phone-stats-pill"
    >
      <span className={styles.streak}>
        <span className={styles.streakLabel}>Streak</span>
        {streak}
      </span>

      {props.mode === 'odds' ? (
        <span className={styles.bands} aria-hidden="true">
          <span className={styles.band}>
            <span className={styles.dot} style={{ background: 'var(--band-green)' }} />
            {props.bands.green}
          </span>
          <span className={styles.band}>
            <span className={styles.dot} style={{ background: 'var(--band-amber)' }} />
            {props.bands.amber}
          </span>
          <span className={styles.band}>
            <span className={styles.dot} style={{ background: 'var(--band-red)' }} />
            {props.bands.red}
          </span>
        </span>
      ) : (
        <span className={styles.accuracy} aria-hidden="true">
          {accuracyText}
        </span>
      )}
    </button>
  );
}
