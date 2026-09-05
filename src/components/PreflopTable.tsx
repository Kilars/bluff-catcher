/**
 * PreflopTable — the preflop felt.
 *
 * Shows:
 *  - Hero's two concrete cards (via the shared Card component)
 *  - A clear position label (UTG / UTG+1 / UTG+2 / LJ / HJ / CO / BTN)
 *  - Folded seat indicators in front of hero (opponents)
 *  - Blind posts (SB / BB) behind hero
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
 * 9-max table seat layout from hero's perspective (hero is always at the
 * bottom/south).  The 8 remaining seats are displayed left-to-right across
 * the top arc.  We name them by their function at a 9-max table where hero
 * occupies each position in turn.
 *
 * For clarity we always show all 8 non-hero seats with their position-relative
 * labels.  Seats in front of hero have folded; SB and BB show blind chips.
 *
 * The order from left-to-right across the felt (seat display order):
 *   index 0 = leftmost (UTG relative to BTN, etc.)
 *
 * We derive the displayed seats dynamically based on hero's position so that
 * the labels always reflect who folds before hero.
 *
 * For a 9-max 60bb RFI scenario:
 *   - Hero is one of: UTG, UTG1, UTG2, LJ, HJ, CO, BTN
 *   - All seats before hero in the action order have folded to hero
 *   - SB and BB are always "live" (posted), shown as blind chips
 *
 * The 9 seats (in VPIP/position order, seat 0 = UTG):
 *   [0] UTG, [1] UTG+1, [2] UTG+2 / LJ, [3] LJ / HJ, [4] HJ, [5] CO, [6] BTN, [7] SB, [8] BB
 *
 * Since UTG2 = LJ in the plan we deduplicate to 7 playable positions:
 *   UTG, UTG1, UTG2(=LJ), HJ, CO, BTN  → that is 6 unique non-blind seats
 * Actually the spec says 7: UTG, UTG1, UTG2, LJ, HJ, CO, BTN.
 * In a real 9-max, UTG2 and LJ are two different seats; the plan treats them
 * the same range-wise but they ARE different seats.
 *
 * Seat indices (0-based, UTG = 0):
 *   0=UTG 1=UTG1 2=UTG2 3=LJ 4=HJ 5=CO 6=BTN 7=SB 8=BB
 * Hero occupies one of 0-6.  All seats with index < hero's index have folded.
 * SB (7) and BB (8) are always posted.
 */

const SEAT_POSITION_ORDER: Position[] = [
  'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN',
];

/**
 * Short display labels for the non-hero seats as shown across the top.
 * We show: seats before hero (folded), SB, BB.
 */
interface SeatInfo {
  label: string;
  type: 'folded' | 'sb' | 'bb';
}

function buildSeats(heroPos: Position): SeatInfo[] {
  const heroIdx = SEAT_POSITION_ORDER.indexOf(heroPos);
  const seats: SeatInfo[] = [];

  // All positions before hero in order (they fold to hero)
  for (let i = 0; i < heroIdx; i++) {
    const posLabels = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'];
    seats.push({ label: posLabels[i], type: 'folded' });
  }

  // SB and BB are always present (behind hero)
  seats.push({ label: 'SB', type: 'sb' });
  seats.push({ label: 'BB', type: 'bb' });

  return seats;
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

  return (
    <section className={styles.table}>
      <div className={styles.feltScaleWrap}>
        <div className={styles.felt}>
          {/* Inner accent ring */}
          <div className={styles.accentRing} />

          {/* Seats row — folded opponents + SB/BB blinds */}
          <div className={styles.seatsRow}>
            {seats.map((seat, i) => (
              <div key={i} className={styles.seat}>
                {seat.type === 'folded' ? (
                  <div className={styles.seatCards}>
                    <div className={styles.seatBack} />
                    <div className={styles.seatBack} />
                  </div>
                ) : seat.type === 'sb' ? (
                  <div className={`${styles.blindChip} ${styles.sbChip}`}>SB</div>
                ) : (
                  <div className={`${styles.blindChip} ${styles.bbChip}`}>BB</div>
                )}
                <span className={styles.seatLabel}>{seat.label}</span>
              </div>
            ))}
          </div>

          {/* Position label in the centre of the felt */}
          <div className={styles.positionLabel}>
            <span className={styles.positionName}>{posLabel}</span>
            <span className={styles.positionContext}>{posLong}</span>
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
