/**
 * PhoneTopBar — the phone tree's top chrome. Presentation only.
 *
 * Four fixed slots on one 44px line (plus the notch inset), per
 * PLAN-phone §5.3:
 *
 *   [ RUNOUT ] [ 40bb+ ▾ ]  …………………  [ streak · band dots ] [ ⋯ ]
 *      brand      context chip            stats slot          menu
 *
 * What died from the desktop `Header`:
 *   - `brandSub` ("Odds trainer" / "Preflop RFI · 40bb+"). It was a label; here
 *     the same content becomes the **context chip**, a 44px target that opens
 *     the mode + depth sheet. One tap to change tier, instead of hamburger →
 *     scroll → pick.
 *   - The hamburger, replaced by `⋯` opening a bottom sheet. A 140px dropdown
 *     with 12px rows is not a phone control.
 *   - The inline stat pairs and the bare-text "Reset". The stats collapse into
 *     one pill (passed in as `stats`), and Reset moves inside the stats sheet,
 *     away from the band dots it used to sit 5.6px from.
 *
 * This component holds no state and knows nothing about drills: it renders
 * labels and calls the three handlers it is given. The stats slot is a
 * `ReactNode` rather than stat props so the bar does not have to know which
 * mode is running — the parent hands it a <PhoneStatsPill>.
 */

import type { ReactNode } from 'react';
import styles from './PhoneTopBar.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhoneTopBarProps {
  /**
   * Context chip copy — the mode in odds mode ('Odds'), the stack tier in
   * preflop mode ('40bb+'). Kept short: the chip must not push the stats slot
   * off a 360px screen.
   */
  contextLabel: string;
  /**
   * Spoken name for the chip, e.g. "Odds trainer, 40bb+ — change mode or stack
   * depth". Defaults to something serviceable built from `contextLabel`.
   */
  contextAriaLabel?: string;
  /** Opens the mode + depth sheet. */
  onOpenContext: () => void;
  /** Opens the menu sheet (`⋯`). */
  onOpenMenu: () => void;
  /** The stats slot — normally a <PhoneStatsPill>. Omit and the slot stays empty. */
  stats?: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneTopBar({
  contextLabel,
  contextAriaLabel,
  onOpenContext,
  onOpenMenu,
  stats,
}: PhoneTopBarProps) {
  return (
    <header className={styles.topBar} data-testid="phone-top-bar">
      <span className={styles.brand} data-slot="brand">
        RUNOUT
      </span>

      <button
        type="button"
        className={styles.chip}
        data-slot="context"
        aria-label={contextAriaLabel ?? `${contextLabel} — change mode or stack depth`}
        aria-haspopup="dialog"
        onClick={onOpenContext}
      >
        <span className={styles.chipLabel}>{contextLabel}</span>
        {/* Decorative: the accessible name already says the chip opens something. */}
        <span className={styles.caret} aria-hidden="true">
          ▾
        </span>
      </button>

      <div className={styles.stats} data-slot="stats">
        {stats}
      </div>

      <button
        type="button"
        className={styles.menuButton}
        data-slot="menu"
        aria-label="Menu"
        aria-haspopup="dialog"
        onClick={onOpenMenu}
      >
        <span aria-hidden="true">⋯</span>
      </button>
    </header>
  );
}
