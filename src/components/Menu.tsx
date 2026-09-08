/**
 * Menu — hamburger button + mode-selection dropdown.
 *
 * Placed at the top-left of the Header. Opens a small dropdown listing
 * the available modes; the active one is marked. Selecting a mode switches
 * it and closes the menu.
 *
 * Below the modes sits a "Stack depth" group — the three tournament tiers the
 * preflop trainer drills (40bb+, 20bb, 10bb jam) — and then a "Tools" group
 * with the RFI range charts, so the charts are reachable without playing a
 * hand first. The depth group is shown only in preflop mode, since it means
 * nothing to the odds trainer.
 *
 * Accessibility:
 *   - button has aria-label and aria-expanded
 *   - menu closes on Esc and on outside-click
 *   - focus returns to hamburger button on close
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppMode } from '../App';
import { DEPTHS, DEPTH_META, type Depth } from '../lib/preflop/ranges';
import styles from './Menu.module.css';

interface MenuItem {
  mode: AppMode;
  label: string;
}

const MENU_ITEMS: MenuItem[] = [
  { mode: 'odds', label: 'Odds trainer' },
  { mode: 'preflop', label: 'Preflop RFI' },
];

interface MenuProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  /** Stack tier the preflop trainer is drilling. */
  currentDepth: Depth;
  onDepthChange: (depth: Depth) => void;
  /** Opens the standalone RFI range-chart browser. */
  onOpenRanges: () => void;
}

export default function Menu({
  currentMode,
  onModeChange,
  currentDepth,
  onDepthChange,
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

          {currentMode === 'preflop' && (
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
