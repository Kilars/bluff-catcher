/**
 * RangeSheet — sheet overlay that displays the full 13×13 opening range grid.
 *
 * Reuses ExplainSheet's CSS module (backdrop, sheet, sheetInner, sheetHeader,
 * closeBtn, divider, footer, btnAccent, btnGhost) without forking the animation.
 *
 * Opens with the same riseSheet animation (220ms) defined in ExplainSheet.module.css.
 * Closes via backdrop click, × button, or Escape (Esc handled by parent).
 *
 * Props:
 *   position    — hero's seat (used to render the range grid + position label).
 *   highlight   — hero's current hand class (highlighted cell in the grid).
 *   onClose     — called when the sheet should close.
 */

import RangeGrid from './RangeGrid';
import type { Position } from '../lib/preflop/ranges';
import type { HandClass } from '../lib/preflop/hands';
import styles from './ExplainSheet.module.css';

// ─── Position display labels ──────────────────────────────────────────────────

const POSITION_LABELS: Record<Position, string> = {
  UTG: 'Under the Gun (UTG)',
  UTG1: 'UTG+1',
  UTG2: 'UTG+2',
  LJ: 'Lojack (LJ)',
  HJ: 'Hijack (HJ)',
  CO: 'Cutoff (CO)',
  BTN: 'Button (BTN)',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface RangeSheetProps {
  position: Position;
  highlight?: HandClass;
  onClose: () => void;
}

export default function RangeSheet({ position, highlight, onClose }: RangeSheetProps) {
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <>
      {/* Backdrop — reuses ExplainSheet backdrop class for identical styling */}
      <div className={styles.backdrop} onClick={handleBackdropClick} />

      {/* Sheet — top:0 (full-screen) so the wide grid has room */}
      <div className={styles.sheet} style={{ top: '0px' }}>
        <div
          className={styles.sheetInner}
          style={{ borderRadius: '0px' }}
        >
          {/* Header */}
          <div className={styles.sheetHeader}>
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>Opening range</span>
              <h1 className={styles.headerTitle}>
                {POSITION_LABELS[position]}
              </h1>
              <p className={styles.headerSubline}>
                Green = open · Dark = fold
                {highlight ? ` · Your hand: ${highlight}` : ''}
              </p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close range grid"
            >
              ×
            </button>
          </div>

          {/* Divider */}
          <div className={styles.divider} />

          {/* Grid body */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <RangeGrid position={position} highlight={highlight} />
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnAccent}
              onClick={onClose}
            >
              Back to the table
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
