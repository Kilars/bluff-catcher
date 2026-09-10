/**
 * ladderSlots — the nine-slot model behind PhoneSeatLadder.
 *
 * Split out of the component so the file that renders the row exports only a
 * component (and so this is importable without pulling in a stylesheet).
 * Presentation-side derivation only: the seat *data* comes from `buildSeats()`
 * in `components/PreflopTable.tsx`, which is the one place that knows who
 * folded and who is behind. See PhoneSeatLadder.tsx for why "behind" counts the
 * blinds here and not on desktop.
 */

import { buildSeats, POSITION_LABEL } from '../../PreflopTable';
import type { Position } from '../../../lib/preflop/ranges';

export type SlotState = 'folded' | 'hero' | 'behind';

export interface LadderSlot {
  /** Seat label as shown: UTG, UTG+1, …, BTN, SB, BB. */
  label: string;
  state: SlotState;
  /** The button seat — hero's own slot when hero has the button. */
  isButton: boolean;
  /** Posted blind, if any. */
  blind?: 'sb' | 'bb';
}

/**
 * The nine slots in action order, hero included.
 *
 * `buildSeats` returns the eight seats that are not hero, already in action
 * order: the folded ones first, then the seats behind, then SB and BB. Hero
 * therefore belongs at exactly the fold boundary.
 */
export function buildLadderSlots(position: Position): LadderSlot[] {
  const seats = buildSeats(position);
  const foldedCount = seats.filter((s) => s.type === 'folded').length;

  const before: LadderSlot[] = seats.slice(0, foldedCount).map((s) => ({
    label: s.label,
    state: 'folded' as const,
    isButton: s.isBtn === true,
  }));

  const hero: LadderSlot = {
    label: POSITION_LABEL[position],
    state: 'hero',
    // When hero has the button no other seat carries it — the button must
    // never vanish from the row (it has done, once, and it is the seat every
    // other seat is read relative to).
    isButton: position === 'BTN',
  };

  const after: LadderSlot[] = seats.slice(foldedCount).map((s) => ({
    label: s.label,
    state: 'behind' as const,
    isButton: s.isBtn === true,
    blind: s.type === 'sb' ? ('sb' as const) : s.type === 'bb' ? ('bb' as const) : undefined,
  }));

  return [...before, hero, ...after];
}

/** `3 folded · 5 behind` — counted off the slots the row actually draws. */
export function ladderContextLine(slots: LadderSlot[]): string {
  const folded = slots.filter((s) => s.state === 'folded').length;
  const behind = slots.filter((s) => s.state === 'behind').length;
  return `${folded} folded · ${behind} behind`;
}

