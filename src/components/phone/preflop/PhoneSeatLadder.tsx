/**
 * PhoneSeatLadder — nine seats on one 44px line, in action order.
 *
 * This replaces the nine-seat felt on phone (PLAN-phone §5.2). The felt spent
 * 188px of height and ~69,000px² to deliver five facts — position, who folded
 * before hero, who acts behind, where the button is, where the blinds are — at
 * 6.9 effective px after the 0.4566 transform. Position is *ordinal*, not
 * spatial: "how many act behind me" is a count on a line, not an ellipse. So
 * the ellipse becomes a row and every fact gets full-size type.
 *
 *   x  x  x  [HJ]  o  o(D)  sb  bb        ← 44px
 *   3 folded · 5 behind                   ← 20px, 15px type, never wraps
 *
 * Presentation only. The seat *data* is not re-derived here: `buildSeats()`
 * from `components/PreflopTable.tsx` is the one place that knows who folded and
 * who is behind, and this component only re-presents its output (hero spliced
 * back in at the fold boundary, since buildSeats returns the eight non-hero
 * seats). Per DECISIONS.md, "two trees, one behaviour".
 *
 * One deliberate difference from the desktop context line: desktop's
 * `buildContextLine()` counts only the non-blind seats behind hero ("3 players
 * to act behind you (BTN last)"). The ladder *draws* SB and BB as slots to
 * hero's right, so a line reading "0 behind" beside two visible seats behind
 * hero would contradict the picture next to it. Here "behind" means every seat
 * still to act, blinds included — the same seats the row shows, counted off the
 * same array. Both numbers come from one pass over `slots`.
 */

import { buildLadderSlots, ladderContextLine, type LadderSlot } from './ladderSlots';
import type { Position } from '../../../lib/preflop/ranges';
import styles from './PhoneSeatLadder.module.css';

/** Screen-reader description for one slot: never just a bare position label. */
function slotDescription(slot: LadderSlot): string {
  const parts: string[] = [slot.label];
  if (slot.state === 'folded') parts.push('folded');
  else if (slot.state === 'hero') parts.push('you');
  else parts.push('to act');
  if (slot.isButton) parts.push('dealer button');
  return parts.join(', ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PhoneSeatLadderProps {
  /** Hero's seat. Everything else on the row is derived from it. */
  position: Position;
}

export default function PhoneSeatLadder({ position }: PhoneSeatLadderProps) {
  const slots = buildLadderSlots(position);

  return (
    <div className={styles.ladderBlock}>
      <div className={styles.row} role="list" aria-label="Seats in action order">
        {slots.map((slot) => (
          <div
            key={slot.label}
            role="listitem"
            className={styles.slot}
            data-testid="seat-slot"
            data-state={slot.state}
            data-label={slot.label}
            data-button={slot.isButton ? 'true' : undefined}
            data-blind={slot.blind}
            aria-label={slotDescription(slot)}
          >
            <span className={styles.mark} aria-hidden="true">
              {slot.isButton ? 'D' : ''}
            </span>
            <span className={styles.label}>{slot.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.context} data-testid="ladder-context">
        {ladderContextLine(slots)}
      </p>
    </div>
  );
}
