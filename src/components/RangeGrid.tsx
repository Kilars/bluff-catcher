/**
 * RangeGrid — 13×13 matrix of the 169 hand classes in standard orientation.
 *
 * Orientation (universal poker grid convention):
 *   - Ranks A,K,Q,J,T,9,8,7,6,5,4,3,2 on both axes (descending, A top-left).
 *   - Diagonal cells: pocket pairs (AA top-left, 22 bottom-right).
 *   - Upper-right triangle: suited hands (row rank > col rank → hiRank=row, loRank=col, suffix 's').
 *   - Lower-left triangle: offsuit hands (row rank < col rank → hiRank=col, loRank=row, suffix 'o').
 *
 * Props:
 *   position  — the hero's seat; used to colour open vs fold cells via isOpen().
 *   highlight — optional HandClass to mark with a distinct outline (hero's current hand).
 */

import { isOpen, type Position } from '../lib/preflop/ranges';
import type { HandClass } from '../lib/preflop/hands';
import styles from './RangeGrid.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Rank labels in descending order (A = index 0, 2 = index 12). */
const RANK_LABELS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Given a row index (0=A, 12=2) and col index (0=A, 12=2),
 * return the canonical hand-class string.
 *
 * - row === col → pair (e.g. "AA", "KK")
 * - row < col  → row rank > col rank → suited upper-right (e.g. row=0,col=1 → "AKs")
 * - row > col  → row rank < col rank → offsuit lower-left (e.g. row=1,col=0 → "AKo")
 */
function cellClass(row: number, col: number): HandClass {
  const rowRank = RANK_LABELS[row];
  const colRank = RANK_LABELS[col];

  if (row === col) {
    // Diagonal — pair
    return rowRank + colRank;
  } else if (row < col) {
    // Upper-right triangle: rowRank is higher, colRank is lower → suited
    return rowRank + colRank + 's';
  } else {
    // Lower-left triangle: colRank is higher, rowRank is lower → offsuit
    return colRank + rowRank + 'o';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface RangeGridProps {
  position: Position;
  highlight?: HandClass;
}

export default function RangeGrid({ position, highlight }: RangeGridProps) {
  return (
    <div className={styles.gridWrapper}>
      {/* Corner spacer + column headers */}
      <div className={styles.colHeaders}>
        <div className={styles.cornerSpacer} />
        {RANK_LABELS.map((rank) => (
          <div key={rank} className={styles.headerCell}>
            {rank}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {RANK_LABELS.map((rowRank, rowIdx) => (
        <div key={rowRank} className={styles.row}>
          {/* Row header */}
          <div className={styles.headerCell}>{rowRank}</div>

          {/* Data cells */}
          {RANK_LABELS.map((_, colIdx) => {
            const hc = cellClass(rowIdx, colIdx);
            const open = isOpen(position, hc);
            const isHighlighted = highlight === hc;

            // Determine triangle region for semantic class
            let regionClass: string;
            if (rowIdx === colIdx) {
              regionClass = styles.pair;
            } else if (rowIdx < colIdx) {
              regionClass = styles.suited;
            } else {
              regionClass = styles.offsuit;
            }

            return (
              <div
                key={hc}
                className={[
                  styles.cell,
                  regionClass,
                  open ? styles.open : styles.fold,
                  isHighlighted ? styles.highlighted : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={hc}
                aria-label={`${hc}: ${open ? 'open' : 'fold'}${isHighlighted ? ' (your hand)' : ''}`}
              >
                <span className={styles.cellLabel}>{hc}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
