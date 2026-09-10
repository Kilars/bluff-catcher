/**
 * PhoneStatsSheet — the expanded session stats, opened from the stats pill.
 *
 * PLAN-phone §5.3. The pill shows the two numbers that move on every commit;
 * this sheet shows everything else, including the per-category breakdown
 * `useStats` has been persisting since day one with nothing rendering it, and
 * **Reset** — a destructive control that on desktop is an 11px text run
 * 16.8px from the band dots. Here it is a 44px row of its own, at the bottom
 * of a sheet, behind a second tap.
 *
 * Presentation only: every figure is a prop, and the derived ones (mean error,
 * band share, per-category mean) are arithmetic on those props, not drill
 * state. Nothing here reads or writes storage.
 */

import { useCallback, useState } from 'react';
import { BAND_COLOR, BAND_LABEL, type Band } from '../../lib/band';
import type { Bands, CategoryStat } from '../../hooks/useStats';
import type { Category } from '../../lib/classify';
import PhoneSheet from './PhoneSheet';
import styles from './PhoneStatsSheet.module.css';

// ─── Copy ─────────────────────────────────────────────────────────────────────

/**
 * Display names for the draw taxonomy. `perCategory` is keyed by
 * `DrawRead.primaryCategory`; `classify()` composes a per-hand name from the
 * hand's components, which is too specific to bucket by, so the short form
 * lives here. An unknown key falls back to the key itself rather than
 * disappearing — a new category should look odd, not be invisible.
 */
const CATEGORY_LABELS: Record<Category, string> = {
  flushDraw: 'Flush draw',
  openEnder: 'Open-ender',
  gutshot: 'Gutshot',
  doubleGutshot: 'Double gutshot',
  combo: 'Flush + straight',
  pairImproving: 'Pair improving',
  overcards: 'Two overcards',
  setDraw: 'Set draw',
  backdoor: 'Backdoor flush',
};

const BANDS: Band[] = ['green', 'amber', 'red'];

// ─── Derivations ──────────────────────────────────────────────────────────────

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function formatError(values: number[]): string {
  const m = mean(values);
  return m === null ? '—' : `±${m.toFixed(1)}`;
}

function share(count: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((count / total) * 100)}%`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommonProps {
  onClose: () => void;
  /** Clears persisted stats for this mode. Armed by one tap, fired by a second. */
  onReset: () => void;
}

export type PhoneStatsSheetProps = CommonProps &
  (
    | {
        mode: 'odds';
        hands: number;
        streak: number;
        bestStreak: number;
        /** Absolute errors, in percentage points, one per committed hand. */
        errors: number[];
        bands: Bands;
        /** Straight from useStats — keyed by DrawRead.primaryCategory. */
        perCategory: Record<string, CategoryStat>;
      }
    | {
        mode: 'preflop';
        hands: number;
        correct: number;
        streak: number;
        bestStreak: number;
        /** 0–100. */
        accuracy: number;
      }
  );

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneStatsSheet(props: PhoneStatsSheetProps) {
  const { onClose, onReset, hands, streak, bestStreak } = props;
  const [armed, setArmed] = useState(false);

  const handleReset = useCallback(() => {
    if (!armed) {
      setArmed(true);
      return;
    }
    onReset();
    setArmed(false);
    onClose();
  }, [armed, onReset, onClose]);

  const subtitle = props.mode === 'odds' ? 'Odds trainer' : 'Preflop RFI';

  return (
    <PhoneSheet
      title="Session stats"
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <button type="button" className={styles.footerButton} onClick={onClose}>
          Done
        </button>
      }
    >
      {/* ── Headline figures ─────────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.tiles}>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Hands</span>
            <span className={styles.tileValue}>{hands}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Streak</span>
            <span className={`${styles.tileValue} ${styles.tileValueAccent}`}>{streak}</span>
          </div>
          <div className={styles.tile}>
            <span className={styles.tileLabel}>Best streak</span>
            <span className={styles.tileValue}>{bestStreak}</span>
          </div>
          {props.mode === 'odds' ? (
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Avg error</span>
              <span className={styles.tileValue}>{formatError(props.errors)}</span>
            </div>
          ) : (
            <div className={styles.tile}>
              <span className={styles.tileLabel}>Accuracy</span>
              <span className={styles.tileValue}>
                {props.hands === 0 ? '—' : `${props.accuracy.toFixed(0)}%`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Band tally (odds) / correct count (preflop) ───────────────────── */}
      {props.mode === 'odds' ? (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Band tally</span>
          {BANDS.map((band) => (
            <div key={band} className={styles.bandRow}>
              <span className={styles.dot} style={{ background: BAND_COLOR[band] }} />
              <span className={styles.bandLabel}>{BAND_LABEL[band]}</span>
              <span className={styles.bandCount}>{props.bands[band]}</span>
              <span className={styles.bandShare}>{share(props.bands[band], hands)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Calls</span>
          <div className={styles.bandRow}>
            <span className={styles.dot} style={{ background: BAND_COLOR.green }} />
            <span className={styles.bandLabel}>Correct</span>
            <span className={styles.bandCount}>{props.correct}</span>
            <span className={styles.bandShare}>{share(props.correct, hands)}</span>
          </div>
          <div className={styles.bandRow}>
            <span className={styles.dot} style={{ background: BAND_COLOR.red }} />
            <span className={styles.bandLabel}>Wrong</span>
            <span className={styles.bandCount}>{hands - props.correct}</span>
            <span className={styles.bandShare}>{share(hands - props.correct, hands)}</span>
          </div>
        </div>
      )}

      {/* ── Per-category breakdown (odds only) ────────────────────────────── */}
      {props.mode === 'odds' && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>By draw</span>
          {Object.keys(props.perCategory).length === 0 ? (
            <span className={styles.empty}>Nothing yet — commit a hand.</span>
          ) : (
            Object.entries(props.perCategory)
              // Most-drilled first: the top of this list is what the session
              // actually was, not what the taxonomy happens to enumerate first.
              .sort(([, a], [, b]) => b.n - a.n)
              .map(([key, stat]) => (
                <div key={key} className={styles.catRow}>
                  <span className={styles.catName}>
                    {CATEGORY_LABELS[key as Category] ?? key}
                  </span>
                  <span className={styles.catFigure}>{stat.n}</span>
                  <span className={styles.catFigure}>{formatError(stat.errors)}</span>
                </div>
              ))
          )}
        </div>
      )}

      {/* ── Reset ─────────────────────────────────────────────────────────── */}
      <div className={styles.section}>
        <span className={styles.sectionLabel}>Session</span>
        <button
          type="button"
          className={`${styles.reset} ${armed ? styles.resetArmed : ''}`}
          onClick={handleReset}
        >
          {armed ? 'Tap again to reset' : 'Reset stats'}
          <span className={styles.resetNote}>
            {armed ? 'This cannot be undone' : 'Clears hands, streaks and the breakdown'}
          </span>
        </button>
      </div>
    </PhoneSheet>
  );
}
