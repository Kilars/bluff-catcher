/**
 * PLAN-coach.md §4, layer 2: the decision math a weak model botches, done once
 * and deterministically so the model only ever *reads* the number.
 *
 * Every figure here is a ratio the pot and the bet already fix — no hole cards,
 * no ranges, no result. `sizing` is Hero's own bet as a fraction of the pot;
 * `facedSizing` is the bet Hero faced on the same scale (see decisions.ts), so
 * the two seats share one formula shape and a pot-sized bet is 1.0 either way.
 */

import type { BoardType } from './board.ts';
import type { LabelledDecision } from './labels.ts';

/** How committed the stack-to-pot ratio leaves Hero. Null when the pot was 0. */
export type SprCommitment = 'committed' | 'medium' | 'deep' | null;

export interface Enriched {
  /** For Hero's own bet of fraction f: the fold frequency it needs as a pure bluff, f/(1+f). */
  alpha: number | null;
  /** What a caller must defend against Hero's bet, 1/(1+f). */
  mdfOffered: number | null;
  /** Facing a bet of fraction g: the equity a call needs, g/(1+2g) — pot odds. */
  requiredEquity: number | null;
  /** Facing a bet: Hero's own minimum defence frequency, 1/(1+g). */
  mdf: number | null;
  sprCommitment: SprCommitment;
  /**
   * Whether the flop texture hands the range edge to the preflop raiser. Null on
   * paired and monotone boards, where the edge is nobody's by texture alone.
   */
  boardFavoursPfa: boolean | null;
}

const r2 = (x: number): number => Number(x.toFixed(2));

/** committed under 3, deep at 6 and up, medium between; null with no pot. */
function sprCommitment(spr: number | null): SprCommitment {
  if (spr === null) return null;
  if (spr < 3) return 'committed';
  if (spr >= 6) return 'deep';
  return 'medium';
}

/** Texture read from the PFR's seat — see board.ts on "mine" vs "theirs". */
function boardFavoursPfa(board: BoardType | null): boolean | null {
  switch (board) {
    case 'dry-high-mine':
    case 'wet-high-mine':
      return true;
    case 'middling-theirs':
      return false;
    default:
      return null; // paired, monotone, or no flop
  }
}

export function enrich(d: LabelledDecision): Enriched {
  const f = d.sizing;
  const g = d.facedSizing;
  return {
    alpha: f === null ? null : r2(f / (1 + f)),
    mdfOffered: f === null ? null : r2(1 / (1 + f)),
    requiredEquity: g === null ? null : r2(g / (1 + 2 * g)),
    mdf: g === null ? null : r2(1 / (1 + g)),
    sprCommitment: sprCommitment(d.spr),
    boardFavoursPfa: boardFavoursPfa(d.boardType),
  };
}
