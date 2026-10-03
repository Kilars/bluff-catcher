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
import { DEFAULT_OPENER_RAISE_BB, type TableSeat } from '../../PreflopTable';
import type { Format } from '../../../lib/preflop/ranges';
import styles from './PhoneSeatLadder.module.css';

/** Screen-reader description for one slot: never just a bare position label. */
/** `threeBet`: hero opened, so the raiser hero faces made a 3-bet. */
function slotDescription(slot: LadderSlot, threeBet = false): string {
  const parts: string[] = [slot.label];
  if (slot.state === 'folded') parts.push('folded');
  else if (slot.state === 'hero')
    parts.push(
      slot.raiseBb !== undefined
        ? `you, raised ${slot.raiseBb}bb`
        : slot.blind === 'sb'
          ? 'you, small blind'
          : slot.blind === 'bb'
            ? 'you, big blind'
            : 'you'
    );
  else if (slot.state === 'opener')
    parts.push(`${threeBet ? '3-bets to' : 'raises'} ${slot.raiseBb ?? DEFAULT_OPENER_RAISE_BB}bb`);
  else parts.push('to act');
  if (slot.isButton) parts.push('dealer button');
  return parts.join(', ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PhoneSeatLadderProps {
  /** Hero's seat. Everything else on the row is derived from it. */
  position: TableSeat;
  /**
   * The facing-open drill's raiser (PLAN-3bet F2): a seat before hero that
   * opened instead of folding. Omit it and the row renders exactly as the RFI
   * drill always has.
   */
  opener?: TableSeat;
  /** The opener's raise size, in bb. Defaults to 2.5bb. Ignored without `opener`. */
  raiseBb?: number;
  /** Hero's own open, in bb (BTN / open vs 3-bet): `opener` is then a 3-bettor behind hero. */
  heroOpenBb?: number;
  /** Overrides the line under the row (default: "3 folded · 5 behind"). */
  contextLine?: string;
  /** Tournament (9 seats, default) or cash (6 seats). */
  format?: Format;
}

export default function PhoneSeatLadder({
  position,
  opener,
  raiseBb,
  heroOpenBb,
  contextLine,
  format,
}: PhoneSeatLadderProps) {
  const slots = buildLadderSlots(position, opener, raiseBb, format, heroOpenBb);

  return (
    <div className={styles.ladderBlock}>
      <div
        className={styles.row}
        role="list"
        aria-label="Seats in action order"
        style={{ '--ladder-seats': slots.length } as React.CSSProperties}
      >
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
            aria-label={slotDescription(slot, heroOpenBb !== undefined)}
          >
            <span className={styles.mark} aria-hidden="true">
              {/* A raise outranks the D: when the BTN opens, the size is what matters. */}
              {slot.state === 'opener'
                ? (slot.raiseBb ?? DEFAULT_OPENER_RAISE_BB)
                : slot.raiseBb !== undefined
                  ? slot.raiseBb
                  : slot.isButton
                    ? 'D'
                    : ''}
            </span>
            <span className={styles.label}>{slot.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.context} data-testid="ladder-context">
        {contextLine ?? ladderContextLine(slots)}
      </p>
    </div>
  );
}
