/**
 * RangeGrid — 13×13 matrix of the 169 hand classes in standard orientation.
 *
 * The orientation convention itself (RANK_LABELS + cellClass) lives in
 * `lib/preflop/grid` so that a second grid renderer cannot disagree about
 * which triangle is suited.
 *
 * Props:
 *   position  — the hero's seat; used to colour play vs fold cells via isOpen().
 *   depth     — the stack tier whose chart to draw (default: the 40bb+ chart).
 *   highlight — optional HandClass to mark with a distinct outline (hero's current hand).
 */

import { DEFAULT_DEPTH, DEPTH_META, isOpen, type Depth, type Position } from '../lib/preflop/ranges';
import { RANK_LABELS, cellClass } from '../lib/preflop/grid';
import type { HandClass } from '../lib/preflop/hands';
import styles from './RangeGrid.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

interface RangeGridProps {
  position: Position;
  highlight?: HandClass;
  depth?: Depth;
}

export default function RangeGrid({
  position,
  highlight,
  depth = DEFAULT_DEPTH,
}: RangeGridProps) {
  // "open" at 40bb+/20bb, "jam" at 10bb — the cell colour means the same
  // thing either way, only the word for it changes.
  const actionWord = DEPTH_META[depth].action;

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
            const open = isOpen(position, hc, depth);
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
                aria-label={`${hc}: ${open ? actionWord : 'fold'}${isHighlighted ? ' (your hand)' : ''}`}
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
