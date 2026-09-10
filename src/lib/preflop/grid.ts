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

import type { HandClass } from './hands';

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
