/**
 * RangeGrid — 13×13 matrix of the 169 hand classes in standard orientation.
 *
 * The orientation convention itself (RANK_LABELS + cellClass) lives in
 * `lib/preflop/grid` so that a second grid renderer cannot disagree about
 * which triangle is suited.
 *
 * Props:
 *   position   — the hero's seat; used to colour play vs fold cells via isOpen().
 *   depth      — the stack tier whose chart to draw (default: the 60bb+ chart).
 *   highlight  — optional HandClass to mark with a distinct outline (hero's current hand).
 *   cellAction — optional 4-colour mode (PLAN-3bet F3). When given, it replaces the
 *                boolean isOpen() read: each cell is coloured value / bluff / call / fold
 *                per `cellAction(hc)` instead of open / fold. Omit it and this component
 *                renders exactly as before — the RFI usage is untouched.
 *   legend     — show the value/bluff/call/fold legend under the grid. Only meaningful
 *                with `cellAction`; defaults to true whenever `cellAction` is given.
 *   footnote   — optional one-line note rendered under the grid (and legend, if shown).
 */

import { useMemo } from 'react';
import {
  DEFAULT_DEPTH,
  CHART_META,
  isOpen,
  type ChartKey,
  type Seat,
} from '../lib/preflop/ranges';
import {
  CELL_ACTION_LABELS,
  legendFor,
  RANK_LABELS,
  cellClass,
  type CellAction,
} from '../lib/preflop/grid';
import type { HandClass } from '../lib/preflop/hands';
import styles from './RangeGrid.module.css';

export type { CellAction };

// ─── Component ────────────────────────────────────────────────────────────────

interface RangeGridProps {
  position: Seat;
  highlight?: HandClass;
  depth?: ChartKey;
  cellAction?: (hc: HandClass) => CellAction;
  legend?: boolean;
  footnote?: string;
}

export default function RangeGrid({
  position,
  highlight,
  depth = DEFAULT_DEPTH,
  cellAction,
  legend = true,
  footnote,
}: RangeGridProps) {
  // Built once per chart rather than per render: it walks all 169 cells.
  const legendItems = useMemo(() => (cellAction ? legendFor(cellAction) : []), [cellAction]);
  // "open" at 60bb+/20bb, "jam" at 10bb — the cell colour means the same
  // thing either way, only the word for it changes.
  const actionWord = CHART_META[depth].action;

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
            const action = cellAction?.(hc);
            const open = action ? action !== 'fold' : isOpen(position, hc, depth);
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

            const colourClass = action
              ? styles[action]
              : open
                ? styles.open
                : styles.fold;

            const label = action
              ? CELL_ACTION_LABELS[action]
              : open
                ? actionWord
                : 'fold';

            return (
              <div
                key={hc}
                className={[
                  styles.cell,
                  regionClass,
                  colourClass,
                  isHighlighted ? styles.highlighted : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={hc}
                aria-label={`${hc}: ${label}${isHighlighted ? ' (your hand)' : ''}`}
              >
                <span className={styles.cellLabel}>{hc}</span>
              </div>
            );
          })}
        </div>
      ))}

      {cellAction && legend && (
        <div className={styles.legend} data-testid="range-legend">
          {legendItems.map((item) => (
            <span key={item.action} className={styles.legendItem}>
              <span className={`${styles.legendSwatch} ${styles[item.action]}`} />
              {item.label}
            </span>
          ))}
        </div>
      )}

      {footnote && (
        <p className={styles.footnote} data-testid="range-footnote">
          {footnote}
        </p>
      )}
    </div>
  );
}
