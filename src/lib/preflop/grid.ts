/**
 * grid — the 13×13 hand matrix's orientation convention.
 *
 * The rank order and the row/col → hand-class mapping are the entire contract
 * of the range grid: get the triangles the wrong way round and every suited
 * hand silently renders as its offsuit twin. Two grid renderers (the desktop
 * `RangeGrid` and, later, the phone range view) draw the same 169 cells, so the
 * convention lives here and neither of them owns a copy of it.
 *
 * Orientation (universal poker grid convention):
 *   - Ranks A,K,Q,J,T,9,8,7,6,5,4,3,2 on both axes (descending, A top-left).
 *   - Diagonal cells: pocket pairs (AA top-left, 22 bottom-right).
 *   - Upper-right triangle: suited hands (row rank > col rank → hiRank=row, loRank=col, suffix 's').
 *   - Lower-left triangle: offsuit hands (row rank < col rank → hiRank=col, loRank=row, suffix 'o').
 */

import type { HandClass } from './hands.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Rank labels in descending order (A = index 0, 2 = index 12). */
export const RANK_LABELS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Given a row index (0=A, 12=2) and col index (0=A, 12=2),
 * return the canonical hand-class string.
 *
 * - row === col → pair (e.g. "AA", "KK")
 * - row < col  → row rank > col rank → suited upper-right (e.g. row=0,col=1 → "AKs")
 * - row > col  → row rank < col rank → offsuit lower-left (e.g. row=1,col=0 → "AKo")
 */
// ─── 4-colour cell action (PLAN-3bet F3) ───────────────────────────────────────
//
// A second grid mode used by the facing-open drill: instead of a boolean
// open/fold, each cell carries one of four actions. Lives here, alongside the
// orientation convention, so `RangeGrid` and `PhoneRangeView` cannot disagree
// on what a colour means or what to call it in an aria-label.

export type CellAction = 'value' | 'bluff' | 'threeBet' | 'call' | 'fold';

/**
 * One page of a paged chart sheet (the facing drills' range view): a chart
 * that is not an RFI seat, so it carries its own colouring and copy. The
 * sheet steps through a list of these the way the RFI sheet steps seats.
 */
export interface ChartPage {
  /** Stable id, e.g. the bucket. */
  id: string;
  /** Short strip label: "vs Early", or a seat ("UTG+1"). */
  tab: string;
  /** Header lines (desktop). */
  kicker: string;
  title: string;
  subline?: string;
  /** The chart's name in the phone readout and grid label, e.g. "vs Late". */
  name: string;
  cellAction: (hc: HandClass) => CellAction;
  /** One-line note under the grid. */
  footnote?: string;
}

/** Verdict-style label for a cell action, used in aria-labels and readouts. */
export const CELL_ACTION_LABELS: Record<CellAction, string> = {
  value: '3-bet (value)',
  bluff: '3-bet (bluff)',
  // A chart that does not split 3-bets by kind (cash) — no value/bluff claim.
  threeBet: '3-bet',
  call: 'call',
  fold: 'fold',
};

/**
 * Legend entries in a fixed, sensible reading order. A grid shows only the
 * entries its chart uses (`legendFor`), so a cash chart gets 3-bet / call /
 * fold and a tournament one the value / bluff split.
 */
export const CELL_ACTION_LEGEND: ReadonlyArray<{ action: CellAction; label: string }> = [
  { action: 'value', label: '3-bet — value (V)' },
  { action: 'bluff', label: '3-bet — bluff (B)' },
  { action: 'threeBet', label: '3-bet (3)' },
  { action: 'call', label: 'call' },
  { action: 'fold', label: 'fold' },
];

/** The legend entries a chart actually uses, in legend order. */
export function legendFor(
  cellAction: (hc: HandClass) => CellAction
): ReadonlyArray<{ action: CellAction; label: string }> {
  const used = new Set<CellAction>();
  for (let row = 0; row < RANK_LABELS.length; row++) {
    for (let col = 0; col < RANK_LABELS.length; col++) used.add(cellAction(cellClass(row, col)));
  }
  // Fold stays even on a chart with no folds, so the key always reads the same.
  return CELL_ACTION_LEGEND.filter((item) => used.has(item.action) || item.action === 'fold');
}

export function cellClass(row: number, col: number): HandClass {
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
