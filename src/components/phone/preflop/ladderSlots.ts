/**
 * ladderSlots — the slot model behind PhoneSeatLadder (9-max or 6-max).
 *
 * Split out of the component so the file that renders the row exports only a
 * component (and so this is importable without pulling in a stylesheet).
 * Presentation-side derivation only: the seat *data* comes from `buildSeats()`
 * in `components/PreflopTable.tsx`, which is the one place that knows who
 * folded and who is behind. See PhoneSeatLadder.tsx for why "behind" counts the
 * blinds here and not on desktop.
 */

import {
  buildSeats,
  DEFAULT_OPENER_RAISE_BB,
  seatsBeforeHero,
  tableSeatLabel,
  type TableSeat,
} from '../../PreflopTable';
import type { Format } from '../../../lib/preflop/ranges';

export type SlotState = 'folded' | 'hero' | 'behind' | 'opener';

export interface LadderSlot {
  /** Seat label as shown: UTG, UTG+1, …, BTN, SB, BB. */
  label: string;
  state: SlotState;
  /** The button seat — hero's own slot when hero has the button. */
  isButton: boolean;
  /** Posted blind, if any. */
  blind?: 'sb' | 'bb';
  /**
   * The raise size, in bb: the opener's (`state === 'opener'`), or hero's own
   * open in BTN vs 3-bet (`state === 'hero'`).
   */
  raiseBb?: number;
}

/**
 * Every slot in action order, hero included (nine at 9-max, six at 6-max).
 *
 * `buildSeats` returns the seats that are not hero, already in action
 * order: the folded/opener ones first, then the seats behind, then SB and BB.
 * Hero therefore belongs at exactly the fold boundary.
 *
 * `opener` / `raiseBb` (PLAN-3bet F2, optional): forwarded to `buildSeats` — see
 * there for the constraint that the opener must be a seat before hero.
 *
 * `heroOpenBb` (BTN vs 3-bet, optional): hero has opened for this much and the
 * action came back round — the 3-bettor (`opener`) and the folded blind sit
 * after hero, and hero's slot carries the raise.
 */
export function buildLadderSlots(
  position: TableSeat,
  opener?: TableSeat,
  raiseBb: number = DEFAULT_OPENER_RAISE_BB,
  format: Format = 'mtt',
  heroOpenBb?: number
): LadderSlot[] {
  const heroOpened = heroOpenBb !== undefined;
  const seats = buildSeats(position, opener, raiseBb, format, heroOpened);
  const beforeCount = seatsBeforeHero(position, format);

  const before: LadderSlot[] = seats.slice(0, beforeCount).map((s) => ({
    label: s.label,
    state: s.type === 'opener' ? ('opener' as const) : ('folded' as const),
    isButton: s.isBtn === true,
    raiseBb: s.type === 'opener' ? s.raiseBb : undefined,
    blind: s.posted,
  }));

  const hero: LadderSlot = {
    label: tableSeatLabel(position),
    state: 'hero',
    // When hero has the button no other seat carries it — the button must
    // never vanish from the row (it has done, once, and it is the seat every
    // other seat is read relative to). If hero has opened, the slot's mark
    // shows the raise instead of the D, as a BTN opener's does; the slot
    // still carries data-button and says "dealer button" to screen readers.
    isButton: position === 'BTN',
    // Hero in a blind has posted, so the slot carries it.
    blind: position === 'SB' ? 'sb' : position === 'BB' ? 'bb' : undefined,
    raiseBb: heroOpenBb,
  };

  // Behind hero: still to act — or, once hero has opened, the 3-bettor and a
  // folded blind.
  const after: LadderSlot[] = seats.slice(beforeCount).map((s) => ({
    label: s.label,
    state: s.type === 'opener' ? ('opener' as const) : s.type === 'folded' ? ('folded' as const) : ('behind' as const),
    isButton: s.isBtn === true,
    raiseBb: s.type === 'opener' ? s.raiseBb : undefined,
    blind: s.type === 'sb' ? ('sb' as const) : s.type === 'bb' ? ('bb' as const) : s.posted,
  }));

  return [...before, hero, ...after];
}

/** `3 folded · 5 behind` — counted off the slots the row actually draws. */
export function ladderContextLine(slots: LadderSlot[]): string {
  const folded = slots.filter((s) => s.state === 'folded').length;
  const behind = slots.filter((s) => s.state === 'behind').length;
  return `${folded} folded · ${behind} behind`;
}

