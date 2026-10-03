/**
 * Menu — hamburger button + mode-selection dropdown.
 *
 * Placed at the top-left of the Header. Opens a small dropdown listing
 * the available modes; the active one is marked. Selecting a mode switches
 * it and closes the menu.
 *
 * Below the modes sits a "Format" group — tournament or cash, for both preflop
 * drills — then a "Stack depth" group — the three tournament tiers the preflop
 * trainer drills (60bb+, 20bb, 10bb jam) — and then a "Tools" group with the
 * RFI range charts, so the charts are reachable without playing a hand first.
 * The format group is shown in the two preflop modes; the depth group only in
 * preflop mode with the tournament format, since cash has one depth and the
 * odds trainer has none; the "Drill" group, holding the one odds
 * preference (name the draw before you guess), is shown only in odds mode for
 * the same reason.
 *
 * That one is a checkbox, not a choice of one-from-many, so it does NOT close
 * the menu: you flip it to see it flip, and closing on the tap hides the state
 * you just asked about.
 *
 * Accessibility:
 *   - button has aria-label and aria-expanded
 *   - menu closes on Esc and on outside-click
 *   - focus returns to hamburger button on close
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MODES, MODE_LABEL, hasFormatChoice, type AppMode } from '../hooks/useAppPrefs';
import { DEPTHS, DEPTH_META, FORMATS, FORMAT_META, type Depth, type Format } from '../lib/preflop/ranges';
import styles from './Menu.module.css';

interface MenuItem {
  mode: AppMode;
  label: string;
}

const MENU_ITEMS: MenuItem[] = MODES.map((mode) => ({ mode, label: MODE_LABEL[mode] }));

interface MenuProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  /** Stack tier the preflop trainer is drilling. */
  currentDepth: Depth;
  onDepthChange: (depth: Depth) => void;
  /** Tournament or cash, for both preflop drills. */
  currentFormat: Format;
  onFormatChange: (format: Format) => void;
  /** Odds drill: name the draw before the commit. Default on. */
  showDraw: boolean;
  onShowDrawChange: (next: boolean) => void;
  /** Opens the standalone RFI range-chart browser. */
  onOpenRanges: () => void;
}

export default function Menu({
  currentMode,
  onModeChange,
  currentDepth,
  onDepthChange,
  currentFormat,
  onFormatChange,
  showDraw,
  onShowDrawChange,
  onOpenRanges,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Close on Esc; return focus to button
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const handleSelect = useCallback(
    (mode: AppMode) => {
      onModeChange(mode);
      close();
      buttonRef.current?.focus();
    },
    [onModeChange, close]
  );

  const handleSelectDepth = useCallback(
    (depth: Depth) => {
      onDepthChange(depth);
      close();
      buttonRef.current?.focus();
    },
    [onDepthChange, close]
  );

  const handleSelectFormat = useCallback(
    (format: Format) => {
      onFormatChange(format);
      close();
      buttonRef.current?.focus();
    },
    [onFormatChange, close]
  );

  // Deliberately does not close: see the header note.
  const handleToggleShowDraw = useCallback(() => {
    onShowDrawChange(!showDraw);
  }, [onShowDrawChange, showDraw]);

  const handleOpenRanges = useCallback(() => {
    onOpenRanges();
    close();
  }, [onOpenRanges, close]);

  return (
    <div className={styles.wrapper}>
      <button
        ref={buttonRef}
        className={styles.hamburger}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggle}
      >
        {/* Three-line hamburger icon */}
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className={styles.dropdown}
          role="menu"
          aria-label="Mode selection"
        >
          {MENU_ITEMS.map(({ mode, label }) => (
            <button
              key={mode}
              className={`${styles.item} ${mode === currentMode ? styles.itemActive : ''}`}
              role="menuitem"
              onClick={() => handleSelect(mode)}
            >
              {label}
              {mode === currentMode && (
                <span className={styles.activeMarker} aria-label="(active)" />
              )}
            </button>
          ))}

          {hasFormatChoice(currentMode) && (
            <>
              <div className={styles.separator} />
              <span className={styles.groupLabel}>Format</span>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  className={`${styles.item} ${f === currentFormat ? styles.itemActive : ''}`}
                  role="menuitemradio"
                  aria-checked={f === currentFormat}
                  onClick={() => handleSelectFormat(f)}
                >
                  <span className={styles.itemMain}>
                    {FORMAT_META[f].label}
                    <span className={styles.itemNote}>{FORMAT_META[f].note}</span>
                  </span>
                  {f === currentFormat && (
                    <span className={styles.activeMarker} aria-label="(active)" />
                  )}
                </button>
              ))}
            </>
          )}

          {currentMode === 'preflop' && currentFormat === 'mtt' && (
            <>
              <div className={styles.separator} />
              <span className={styles.groupLabel}>Stack depth</span>
              {DEPTHS.map((d) => (
                <button
                  key={d}
                  className={`${styles.item} ${d === currentDepth ? styles.itemActive : ''}`}
                  role="menuitem"
                  onClick={() => handleSelectDepth(d)}
                >
                  <span className={styles.itemMain}>
                    {DEPTH_META[d].label}
                    <span className={styles.itemNote}>
                      {DEPTH_META[d].name} · {DEPTH_META[d].actionLabel.toLowerCase()} or fold
                    </span>
                  </span>
                  {d === currentDepth && (
                    <span className={styles.activeMarker} aria-label="(active)" />
                  )}
                </button>
              ))}
            </>
          )}

          {currentMode === 'odds' && (
            <>
              <div className={styles.separator} />
              <span className={styles.groupLabel}>Drill</span>
              <button
                className={`${styles.item} ${showDraw ? styles.itemActive : ''}`}
                role="menuitemcheckbox"
                aria-checked={showDraw}
                onClick={handleToggleShowDraw}
              >
                <span className={styles.itemMain}>
                  Show the draw
                  <span className={styles.itemNote}>
                    {showDraw
                      ? 'Named before you guess · tap to hide'
                      : 'Hidden until you commit · tap to show'}
                  </span>
                </span>
                {showDraw && (
                  <span className={styles.activeMarker} aria-label="(on)" />
                )}
              </button>
            </>
          )}

          <div className={styles.separator} />
          <span className={styles.groupLabel}>Tools</span>
          <button
            className={styles.item}
            role="menuitem"
            onClick={handleOpenRanges}
          >
            RFI range charts
          </button>
        </div>
      )}
    </div>
  );
}
