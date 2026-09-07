/**
 * PreflopTable — the preflop felt.
 *
 * Shows:
 *  - Hero's two concrete cards (via the shared Card component)
 *  - A clear position label (UTG / UTG+1 / UTG+2 / LJ / HJ / CO / BTN)
 *  - The whole seat ring: seats that folded before hero, seats still to act
 *    behind hero (the BTN among them, emphasised), and the SB / BB blinds
 *  - A counter line: how many folded before hero, how many act behind
 *
 * No board — preflop only.
 * Reuses the felt look from Table.tsx (same tokens, same border-radius, same
 * hero-card overhang of 32px). Desktop-first; P5 handles phone.
 */

import Card from './Card';
import styles from './PreflopTable.module.css';
import type { Card as CardCode } from '../lib/odds';
import type { Position } from '../lib/preflop/ranges';

// ─── Position → display label ─────────────────────────────────────────────────

/**
 * Maps the Position enum values to short display strings.
 *
 * The canonical mapping (per the plan):
 *   UTG   → "UTG"
 *   UTG1  → "UTG+1"
 *   UTG2  → "UTG+2"
 *   LJ    → "LJ"      (same seat as UTG2 per spec, but shown as LJ)
 *   HJ    → "HJ"
 *   CO    → "CO"
 *   BTN   → "BTN"
 */
export const POSITION_LABEL: Record<Position, string> = {
  UTG: 'UTG',
  UTG1: 'UTG+1',
  UTG2: 'UTG+2',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
};

/**
 * Full position names for a secondary line (optional flavour text).
 */
const POSITION_LONG: Record<Position, string> = {
  UTG: 'Under the gun',
  UTG1: 'UTG + 1',
  UTG2: 'UTG + 2',
  LJ: 'Lojack',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
};

// ─── Seat layout ──────────────────────────────────────────────────────────────

/**
 * 9-max seat layout from hero's perspective — hero always sits at the bottom,
 * the other 8 seats run left-to-right across the top arc in action order.
 *
 * Seat indices (0-based): 0=UTG 1=UTG1 2=UTG2 3=LJ 4=HJ 5=CO 6=BTN, then SB, BB.
 * Hero occupies one of 0-6.  Seats with a lower index have folded to hero;
 * seats with a higher index are still to act behind hero (the BTN among them —
 * it is the reference seat and must always be on screen).  SB and BB are always
 * posted and shown as blind chips.
 */

const SEAT_POSITION_ORDER: Position[] = [
  'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN',
];

/**
 * A non-hero seat as displayed across the top of the felt.
 *
 *  folded — acted before hero and folded (dimmed card backs)
 *  toAct  — still to act behind hero (upright neutral card backs)
 *  sb/bb  — the posted blinds
 */
export interface SeatInfo {
  label: string;
  type: 'folded' | 'toAct' | 'sb' | 'bb';
  /** The button seat is the key reference point — emphasised visually. */
  isBtn?: boolean;
}

/** Display labels for the 7 non-blind seats, in action order. */
const SEAT_LABELS = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'];

/**
 * Builds all 8 non-hero seats in action order: the six/seven non-blind seats
 * other than hero's own, then SB and BB.
 *
 * Seats before hero have folded; seats after hero are still to act (the BTN
 * among them — it must never disappear, it is the reference seat).
 */
export function buildSeats(heroPos: Position): SeatInfo[] {
  const heroIdx = SEAT_POSITION_ORDER.indexOf(heroPos);
  const seats: SeatInfo[] = [];

  for (let i = 0; i < SEAT_LABELS.length; i++) {
    if (i === heroIdx) continue; // hero sits at the bottom, not in the row
    seats.push({
      label: SEAT_LABELS[i],
      type: i < heroIdx ? 'folded' : 'toAct',
      isBtn: i === SEAT_LABELS.length - 1,
    });
  }

  // SB and BB are always present (behind hero)
  seats.push({ label: 'SB', type: 'sb' });
  seats.push({ label: 'BB', type: 'bb' });

  return seats;
}

/**
 * The context line under the position label:
 *   "3 players folded before you · 3 players to act behind you (BTN last)"
 *
 * foldedBefore = hero's seat index; toActBehind = the non-blind seats between
 * hero and the button, button included.
 */
export function buildContextLine(heroPos: Position): string {
  const heroIdx = SEAT_POSITION_ORDER.indexOf(heroPos);
  const foldedBefore = heroIdx;
  const toActBehind = SEAT_LABELS.length - 1 - heroIdx;

  const foldedPart =
    foldedBefore === 0
      ? 'First in — nobody has acted'
      : `${foldedBefore} player${foldedBefore === 1 ? '' : 's'} folded before you`;

  const actPart =
    toActBehind === 0
      ? "0 to act behind you — you're on the button"
      : toActBehind === 1
        ? '1 player to act behind you (the BTN)'
        : `${toActBehind} players to act behind you (BTN last)`;

  return `${foldedPart} · ${actPart}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PreflopTableProps {
  hero: [CardCode, CardCode];
  position: Position;
}

export default function PreflopTable({ hero, position }: PreflopTableProps) {
  const seats = buildSeats(position);
  const posLabel = POSITION_LABEL[position];
  const posLong = POSITION_LONG[position];
  const contextLine = buildContextLine(position);

  return (
    <section className={styles.table}>
      <div className={styles.feltScaleWrap}>
        <div className={styles.felt}>
          {/* Inner accent ring */}
          <div className={styles.accentRing} />

          {/* Seats row — folded seats, seats still to act, SB/BB blinds */}
          <div className={styles.seatsRow}>
            {seats.map((seat) => (
              <div
                key={seat.label}
                className={`${styles.seat}${seat.isBtn ? ` ${styles.seatBtn}` : ''}`}
              >
                {seat.type === 'folded' ? (
                  <div className={styles.seatCards}>
                    <div className={`${styles.seatBack} ${styles.seatBackFolded}`} />
                    <div className={`${styles.seatBack} ${styles.seatBackFolded}`} />
                  </div>
                ) : seat.type === 'toAct' ? (
                  <div className={styles.seatCards}>
                    <div className={`${styles.seatBack} ${styles.seatBackLive}`} />
                    <div className={`${styles.seatBack} ${styles.seatBackLive}`} />
                  </div>
                ) : seat.type === 'sb' ? (
                  <div className={`${styles.blindChip} ${styles.sbChip}`}>SB</div>
                ) : (
                  <div className={`${styles.blindChip} ${styles.bbChip}`}>BB</div>
                )}
                <span
                  className={`${styles.seatLabel}${
                    seat.type === 'folded' ? ` ${styles.seatLabelFolded}` : ''
                  }${seat.isBtn ? ` ${styles.seatLabelBtn}` : ''}`}
                >
                  {seat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Position label + action context in the centre of the felt */}
          <div className={styles.positionLabel}>
            <span className={styles.positionName}>{posLabel}</span>
            <span className={styles.positionContext}>{posLong}</span>
            <span className={styles.actionContext}>{contextLine}</span>
          </div>

          {/* Hero cards — overhanging felt bottom */}
          <div className={styles.heroRow}>
            {hero.map((code) => (
              <Card key={code} code={code} variant="hero" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
