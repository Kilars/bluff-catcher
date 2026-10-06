/**
 * PhoneMenuSheet — the phone replacement for the desktop hamburger dropdown.
 *
 * Same items, reachable posture (PLAN-phone §5.3): mode, stack depth, the RFI
 * range charts, and Reset stats. The desktop `Menu` shows the depth group only
 * in preflop mode; here it is listed in both odds and preflop mode, because
 * this sheet is also what the top bar's context chip opens — the chip's whole
 * promise is one tap to the tier switch, so the tier has to be in the sheet
 * whichever door was used. The facing modes are the exception: they have no
 * depth picker at all (one source depth per format, not a tier to switch —
 * see docs/PLAN-3bet.md), so the group is left out entirely there.
 *
 * Modes are listed in the menu's sections, Postflop then Preflop
 * (docs/PLAN-menu.md), with the note `modeNote` writes for the format.
 *
 * Both entry points render this same component; pass a `title` to say which
 * door it was ("Menu" from `⋯`, "Mode & format" from the chip).
 *
 * Selecting anything closes the sheet, exactly as the desktop dropdown does —
 * the choice is the whole reason the sheet is open. Two rows are exceptions.
 * Reset is destructive, so it takes two taps and the second one closes. "Show
 * the draw" is a checkbox rather than a choice of one-from-many, so it flips in
 * place and leaves the sheet up: closing on the tap would hide the state you
 * tapped to see.
 *
 * Presentation only. Every handler is the parent's; this component owns one
 * piece of state, whether Reset is armed.
 */

import { useCallback, useState } from 'react';
import { MODE_LABEL, MODE_SECTIONS, hasFormatChoice, hasOpponentsChoice, isFacingMode, type AppMode } from '../../hooks/useAppPrefs';
import { modeNote } from '../../lib/modeMeta';
import { OPPONENTS, OPPONENTS_META, type Opponents } from '../../lib/preflop/lowStakes';
import {
  DEPTHS,
  DEPTH_META,
  FORMATS,
  FORMAT_META,
  type Depth,
  type Format,
} from '../../lib/preflop/ranges';
import PhoneSheet from './PhoneSheet';
import styles from './PhoneMenuSheet.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhoneMenuSheetProps {
  /** Sheet title. 'Menu' from the ⋯ button, 'Mode & format' from the context chip. */
  title?: string;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  depth: Depth;
  onDepthChange: (depth: Depth) => void;
  /** Tournament or cash, for both preflop drills. */
  format: Format;
  onFormatChange: (format: Format) => void;
  /** Cash 4-bet drills: who is across the table. */
  opponents: Opponents;
  onOpponentsChange: (opponents: Opponents) => void;
  /** Odds drill: name the draw before the commit. Default on. */
  showDraw: boolean;
  onShowDrawChange: (next: boolean) => void;
  /** Opens the standalone range-chart browser. */
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
  format,
  onFormatChange,
  opponents,
  onOpponentsChange,
  showDraw,
  onShowDrawChange,
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

  const selectFormat = useCallback(
    (next: Format) => {
      onFormatChange(next);
      onClose();
    },
    [onFormatChange, onClose]
  );

  // No onClose: see the header note.
  const selectOpponents = useCallback(
    (next: Opponents) => {
      onOpponentsChange(next);
      onClose();
    },
    [onOpponentsChange, onClose]
  );

  const toggleShowDraw = useCallback(() => {
    onShowDrawChange(!showDraw);
  }, [onShowDrawChange, showDraw]);

  const openRanges = useCallback(() => {
    onOpenRanges();
    onClose();
  }, [onOpenRanges, onClose]);

  // Two taps, because there is no undo and the row sits a thumb-width from
  // "60bb+". The armed state is local and dies with the sheet.
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
        {MODE_SECTIONS.map((section) => (
          <div key={section.label} className={styles.group}>
            <span className={styles.groupLabel}>{section.label}</span>
            {section.modes.map((m) => (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={m === mode}
                className={`${styles.row} ${m === mode ? styles.rowActive : ''}`}
                onClick={() => selectMode(m)}
              >
                <span className={styles.rowMain}>
                  {MODE_LABEL[m]}
                  <span className={styles.rowNote}>{modeNote(m, format)}</span>
                </span>
                {m === mode && <span className={styles.marker} aria-hidden="true" />}
              </button>
            ))}
          </div>
        ))}

        {hasFormatChoice(mode) && (
          <div className={styles.group}>
            <span className={styles.groupLabel}>Format</span>
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                role="menuitemradio"
                aria-checked={f === format}
                className={`${styles.row} ${f === format ? styles.rowActive : ''}`}
                onClick={() => selectFormat(f)}
              >
                <span className={styles.rowMain}>
                  {FORMAT_META[f].label}
                  <span className={styles.rowNote}>{FORMAT_META[f].note}</span>
                </span>
                {f === format && <span className={styles.marker} aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}

        {hasOpponentsChoice(mode, format) && (
          <div className={styles.group}>
            <span className={styles.groupLabel}>Opponents</span>
            {OPPONENTS.map((o) => (
              <button
                key={o}
                type="button"
                role="menuitemradio"
                aria-checked={o === opponents}
                className={`${styles.row} ${o === opponents ? styles.rowActive : ''}`}
                onClick={() => selectOpponents(o)}
              >
                <span className={styles.rowMain}>
                  {OPPONENTS_META[o].label}
                  <span className={styles.rowNote}>{OPPONENTS_META[o].note}</span>
                </span>
                {o === opponents && <span className={styles.marker} aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}

        {/* The facing modes have no depth picker — one source depth per
            format, not a tier to switch between (docs/PLAN-3bet.md) — and
            cash has one depth, 100bb (docs/PLAN-cash.md). */}
        {!isFacingMode(mode) && format === 'mtt' && (
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
        )}

        <div className={styles.group}>
          <span className={styles.groupLabel}>Odds drill</span>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showDraw}
            className={`${styles.row} ${showDraw ? styles.rowActive : ''}`}
            onClick={toggleShowDraw}
          >
            <span className={styles.rowMain}>
              Show the draw
              <span className={styles.rowNote}>
                {showDraw
                  ? 'Named before you guess · tap to hide'
                  : 'Hidden until you commit · tap to show'}
              </span>
            </span>
            {showDraw && <span className={styles.marker} aria-hidden="true" />}
          </button>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>Tools</span>
          <button type="button" role="menuitem" className={styles.row} onClick={openRanges}>
            <span className={styles.rowMain}>
              Range charts
              <span className={styles.rowNote}>Every open, and every seat pair facing a raise</span>
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
