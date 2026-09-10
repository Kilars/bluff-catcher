/**
 * PhoneMenuSheet — the phone replacement for the desktop hamburger dropdown.
 *
 * Same items, reachable posture (PLAN-phone §5.3): mode, stack depth, the RFI
 * range charts, and Reset stats. The desktop `Menu` shows the depth group only
 * in preflop mode; here it is always listed, because this sheet is also what
 * the top bar's context chip opens — the chip's whole promise is one tap to the
 * tier switch, so the tier has to be in the sheet whichever door was used.
 *
 * Both entry points render this same component; pass a `title` to say which
 * door it was ("Menu" from `⋯`, "Mode & depth" from the chip).
 *
 * Selecting anything closes the sheet, exactly as the desktop dropdown does —
 * the choice is the whole reason the sheet is open. Reset is the exception: it
 * is destructive, so it takes two taps, and the second one closes.
 *
 * Presentation only. Every handler is the parent's; this component owns one
 * piece of state, whether Reset is armed.
 */

import { useCallback, useState } from 'react';
import type { AppMode } from '../../hooks/useAppPrefs';
import { DEPTHS, DEPTH_META, type Depth } from '../../lib/preflop/ranges';
import PhoneSheet from './PhoneSheet';
import styles from './PhoneMenuSheet.module.css';

// ─── Copy ─────────────────────────────────────────────────────────────────────

const MODE_ITEMS: { mode: AppMode; label: string; note: string }[] = [
  { mode: 'odds', label: 'Odds trainer', note: 'Chance you improve by the river' },
  { mode: 'preflop', label: 'Preflop RFI', note: 'Open or fold, by seat and stack' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhoneMenuSheetProps {
  /** Sheet title. 'Menu' from the ⋯ button, 'Mode & depth' from the context chip. */
  title?: string;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  depth: Depth;
  onDepthChange: (depth: Depth) => void;
  /** Opens the standalone RFI range-chart browser. */
  onOpenRanges: () => void;
  /** Clears persisted stats for the current mode. Armed by one tap, fired by a second. */
  onResetStats: () => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneMenuSheet({
  title = 'Menu',
  mode,
  onModeChange,
  depth,
  onDepthChange,
  onOpenRanges,
  onResetStats,
  onClose,
}: PhoneMenuSheetProps) {
  const [armed, setArmed] = useState(false);

  const selectMode = useCallback(
    (next: AppMode) => {
      onModeChange(next);
      onClose();
    },
    [onModeChange, onClose]
  );

  const selectDepth = useCallback(
    (next: Depth) => {
      onDepthChange(next);
      onClose();
    },
    [onDepthChange, onClose]
  );

  const openRanges = useCallback(() => {
    onOpenRanges();
    onClose();
  }, [onOpenRanges, onClose]);

  // Two taps, because there is no undo and the row sits a thumb-width from
  // "40bb+". The armed state is local and dies with the sheet.
  const handleReset = useCallback(() => {
    if (!armed) {
      setArmed(true);
      return;
    }
    onResetStats();
    onClose();
  }, [armed, onResetStats, onClose]);

  return (
    <PhoneSheet
      title={title}
      onClose={onClose}
      footer={
        <button type="button" className={styles.footerButton} onClick={onClose}>
          Done
        </button>
      }
    >
      <div role="menu" aria-label={title}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>Mode</span>
          {MODE_ITEMS.map((item) => (
            <button
              key={item.mode}
              type="button"
              role="menuitemradio"
              aria-checked={item.mode === mode}
              className={`${styles.row} ${item.mode === mode ? styles.rowActive : ''}`}
              onClick={() => selectMode(item.mode)}
            >
              <span className={styles.rowMain}>
                {item.label}
                <span className={styles.rowNote}>{item.note}</span>
              </span>
              {item.mode === mode && <span className={styles.marker} aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Stack depth</span>
          {DEPTHS.map((d) => (
            <button
              key={d}
              type="button"
              role="menuitemradio"
              aria-checked={d === depth}
              className={`${styles.row} ${d === depth ? styles.rowActive : ''}`}
              onClick={() => selectDepth(d)}
            >
              <span className={styles.rowMain}>
                {DEPTH_META[d].label}
                <span className={styles.rowNote}>
                  {DEPTH_META[d].name} · {DEPTH_META[d].actionLabel.toLowerCase()} or fold
                </span>
              </span>
              {d === depth && <span className={styles.marker} aria-hidden="true" />}
            </button>
          ))}
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Tools</span>
          <button type="button" role="menuitem" className={styles.row} onClick={openRanges}>
            <span className={styles.rowMain}>
              RFI range charts
              <span className={styles.rowNote}>Browse every seat at the current tier</span>
            </span>
            <span className={styles.chevron} aria-hidden="true">
              →
            </span>
          </button>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Session</span>
          <button
            type="button"
            role="menuitem"
            className={`${styles.row} ${styles.rowDanger} ${armed ? styles.rowConfirming : ''}`}
            onClick={handleReset}
          >
            <span className={styles.rowMain}>
              {armed ? 'Tap again to reset' : 'Reset stats'}
              <span className={styles.rowNote}>
                {armed ? 'This cannot be undone' : 'Clears hands, streaks and the breakdown'}
              </span>
            </span>
          </button>
        </div>
      </div>
    </PhoneSheet>
  );
}
