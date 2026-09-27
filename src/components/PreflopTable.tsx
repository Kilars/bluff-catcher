/**
 * PreflopTable — the preflop felt, laid out like a real 9-max poker table.
 *
 * Shows:
 *  - Hero at the bottom seat, with two concrete cards (shared Card component)
 *    and a seat plaque naming hero's position
 *  - The other 8 seats spread around the oval in clockwise (action) order:
 *    seats that folded before hero (empty — no cards, dimmed plaque) and seats
 *    still to act behind hero (card backs face down), plus SB / BB
 *  - A real dealer button (cream "D" disc) parked in front of the BTN seat
 *  - Blind chips out in front of SB (0.5 bb) and BB (1 bb)
 *  - A counter line in the middle: how many folded before hero, how many act
 *    behind
 *
 * No board — preflop only.
 * Reuses the felt look from Table.tsx (same tokens, same border-radius, same
 * hero-card overhang of 32px). Desktop-first; P5 handles phone.
 */

import { Fragment } from 'react';
import Card from './Card';
import styles from './PreflopTable.module.css';
import type { Card as CardCode } from '../lib/odds';
import { DEFAULT_DEPTH, DEPTH_META, type Depth, type Position } from '../lib/preflop/ranges';

// ─── Position → display label ─────────────────────────────────────────────────

/**
 * Maps the Position enum values to short display strings.
 *
 * The canonical mapping (per the plan):
 *   UTG   → "UTG"
 *   UTG1  → "UTG+1"
 *   UTG2  → "UTG+2"
 *   LJ    → "LJ"      (its own seat, one later than UTG+2)
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
 * 9-max seat layout from hero's perspective — hero always sits at the bottom
 * seat, the other 8 run clockwise around the oval, which is the order the
 * action moves in (hero → the seat on hero's left → … → back round to hero).
 *
 * Action order (also clockwise seat order): UTG UTG+1 UTG+2 LJ HJ CO BTN SB BB.
 * Hero occupies one of the seven non-blind seats. Seats earlier in that cycle
 * have already folded to hero; seats later are still to act behind hero. SB and
 * BB are always posted.
 */

const SEAT_POSITION_ORDER: Position[] = [
  'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN',
];

/**
 * A non-hero seat as displayed around the felt.
 *
 *  folded — acted before hero and folded (no cards, dimmed plaque)
 *  toAct  — still to act behind hero (face-down card backs)
 *  sb/bb  — the posted blinds (cards + a chip out in front)
 *  opener — acted before hero and raised (cards + a raise chip out in front).
 *           Used by the facing-open drill (PLAN-3bet F2); a seat here never
 *           also has `type: 'folded'` — the opener is the one seat before hero
 *           that has not mucked.
 */
export interface SeatInfo {
  label: string;
  type: 'folded' | 'toAct' | 'sb' | 'bb' | 'opener';
  /** The button seat — it gets the dealer button, not a colour treatment. */
  isBtn?: boolean;
  /** The open size, in bb — only set when `type === 'opener'`. */
  raiseBb?: number;
}

/** Display labels for the 7 non-blind seats, in action order. */
const SEAT_LABELS = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'];

/** All 9 seats clockwise around the table, blinds included. */
const RING_ORDER = [...SEAT_LABELS, 'SB', 'BB'];

/**
 * Where each ring slot sits on the 820×380 felt, and where that seat's chips
 * (or the dealer button) go — a short step in toward the middle of the table.
 *
 * Slot 0 is hero at the bottom; slots 1…8 run clockwise from hero's left, i.e.
 * up the left rail, across the top, and back down the right rail. Points come
 * from an ellipse (centre 410,190 / radii 355,165) sampled at 50° 90° 130° 165°
 * 195° 230° 270° 310°, with the bottom arc left clear for hero's cards.
 */
interface SeatSlot {
  /** Seat centre on the felt, in felt px. */
  x: number;
  y: number;
  /** Chip / dealer-button spot, one step toward the middle. */
  cx: number;
  cy: number;
}

const SEAT_SLOTS: SeatSlot[] = [
  { x: 410, y: 322, cx: 545, cy: 300 }, // 0 — hero (bottom); button parks beside hero's cards
  { x: 138, y: 296, cx: 196, cy: 273 }, // 1 — bottom left
  { x: 55, y: 190, cx: 117, cy: 190 },  // 2 — left
  { x: 138, y: 84, cx: 196, cy: 107 },  // 3 — top left
  { x: 318, y: 36, cx: 350, cy: 89 },   // 4 — top, left of centre
  { x: 502, y: 36, cx: 470, cy: 89 },   // 5 — top, right of centre
  { x: 682, y: 84, cx: 624, cy: 107 },  // 6 — top right
  { x: 765, y: 190, cx: 703, cy: 190 }, // 7 — right
  { x: 682, y: 296, cx: 624, cy: 273 }, // 8 — bottom right
];

/** Hero's own plaque sits just above hero's cards, at the bottom of the felt. */
const HERO_PLAQUE = { x: 410, y: 209 };

/** Default open size for the opener seat (PLAN-3bet: 2.5bb). */
export const DEFAULT_OPENER_RAISE_BB = 2.5;

/**
 * Builds all 8 non-hero seats in action order: the six/seven non-blind seats
 * other than hero's own, then SB and BB.
 *
 * Seats before hero have folded; seats after hero are still to act (the BTN
 * among them — it must never disappear, it is the reference seat).
 *
 * `opener` (PLAN-3bet F2, optional): one of the seats before hero raised
 * instead of folding. It must be a seat that acts before hero — the facing-
 * open drill always seats hero on the BTN, so every opener seat qualifies.
 * A seat after hero is never turned into an opener; that spot is reserved for
 * the RFI drill's `toAct` seats and isn't a legal facing-open deal anyway.
 */
export function buildSeats(
  heroPos: Position,
  opener?: Position,
  raiseBb: number = DEFAULT_OPENER_RAISE_BB
): SeatInfo[] {
  const heroIdx = SEAT_POSITION_ORDER.indexOf(heroPos);
  const seats: SeatInfo[] = [];

  for (let i = 0; i < SEAT_LABELS.length; i++) {
    if (i === heroIdx) continue; // hero sits at the bottom, not in the ring loop
    const isOpener = i < heroIdx && opener !== undefined && SEAT_POSITION_ORDER[i] === opener;
    seats.push({
      label: SEAT_LABELS[i],
      type: isOpener ? 'opener' : i < heroIdx ? 'folded' : 'toAct',
      isBtn: i === SEAT_LABELS.length - 1,
      raiseBb: isOpener ? raiseBb : undefined,
    });
  }

  // SB and BB are always present (behind hero)
  seats.push({ label: 'SB', type: 'sb' });
  seats.push({ label: 'BB', type: 'bb' });

  return seats;
}

/**
 * Ring slot for a seat label, given where hero sits: 0 = hero, 1…8 clockwise.
 * Hero's own seat is slot 0, so the BTN slot is 0 exactly when hero has the
 * button — that is the case where the dealer button belongs next to hero.
 */
export function seatSlotIndex(heroPos: Position, seatLabel: string): number {
  const heroIdx = RING_ORDER.indexOf(POSITION_LABEL[heroPos]);
  const seatIdx = RING_ORDER.indexOf(seatLabel);
  return (seatIdx - heroIdx + RING_ORDER.length) % RING_ORDER.length;
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
  /** Stack tier — drives the figure written on every plaque. */
  depth?: Depth;
  /**
   * The facing-open drill's raiser (PLAN-3bet F2): a seat before hero that
   * opened instead of folding. Omit it and the table renders exactly as the
   * RFI drill always has — every seat before hero folded, no raise chip.
   */
  opener?: Position;
  /** The opener's raise size, in bb. Defaults to 2.5bb. Ignored without `opener`. */
  raiseBb?: number;
  /**
   * A short tag written as a third line on the opener's plaque — the facing
   * drill puts the chart bucket there ("vs Late") so the seat and the chart it
   * is graded against read together. Ignored without `opener`.
   */
  openerTag?: string;
  /** Overrides the stack figure on every plaque (default: the depth's label). */
  stackLabel?: string;
  /** Overrides the small heading in the middle of the felt (default: hero's seat name). */
  centreTitle?: string;
  /** Overrides the counter line in the middle of the felt (default: folded / to act). */
  centreLine?: string;
}

/** Face-down pair shown at seats still holding cards. */
function SeatCards() {
  return (
    <div className={styles.seatCards}>
      <div className={styles.seatBack} />
      <div className={styles.seatBack} />
    </div>
  );
}

export default function PreflopTable({
  hero,
  position,
  depth = DEFAULT_DEPTH,
  opener,
  raiseBb = DEFAULT_OPENER_RAISE_BB,
  openerTag,
  stackLabel: stackLabelOverride,
  centreTitle,
  centreLine,
}: PreflopTableProps) {
  // Everyone at the table is on the same effective stack — that is the whole
  // premise of a single-depth chart, so one label covers every plaque.
  const stackLabel = stackLabelOverride ?? DEPTH_META[depth].stackLabel;
  const seats = buildSeats(position, opener, raiseBb);
  const posLabel = POSITION_LABEL[position];
  const posLong = centreTitle ?? POSITION_LONG[position];
  const contextLine = centreLine ?? buildContextLine(position);

  // The dealer button rides with the BTN seat — slot 0 means hero has it.
  const btnSlot = SEAT_SLOTS[seatSlotIndex(position, 'BTN')];

  return (
    <section className={styles.table}>
      <div className={styles.feltScaleWrap}>
        <div className={styles.felt}>
          {/* Inner accent ring */}
          <div className={styles.accentRing} />

          {/* The 8 non-hero seats, placed around the oval in clockwise order */}
          {seats.map((seat) => {
            const slot = SEAT_SLOTS[seatSlotIndex(position, seat.label)];
            const isFolded = seat.type === 'folded';
            const isBlind = seat.type === 'sb' || seat.type === 'bb';
            const isOpener = seat.type === 'opener';

            return (
              <Fragment key={seat.label}>
                <div
                  className={`${styles.seat}${isFolded ? ` ${styles.seatFolded}` : ''}`}
                  style={{ left: `${slot.x}px`, top: `${slot.y}px` }}
                >
                  {/* Folded players have mucked — no cards at the seat.
                      The opener is still in the hand, so it keeps its cards. */}
                  {!isFolded && <SeatCards />}
                  <div className={styles.plaque}>
                    <span className={styles.plaqueName}>{seat.label}</span>
                    <span className={styles.plaqueStack}>
                      {isFolded ? 'folded' : isOpener ? `raises ${seat.raiseBb}bb` : stackLabel}
                    </span>
                    {isOpener && openerTag && (
                      <span className={styles.plaqueTag} data-testid="opener-tag">
                        {openerTag}
                      </span>
                    )}
                  </div>
                </div>

                {/* Posted blind, or the opener's raise — a chip out in front of the seat.
                    Same styling for both: a raise reads the same way a blind does. */}
                {(isBlind || isOpener) && (
                  <div
                    className={styles.chipSpot}
                    style={{ left: `${slot.cx}px`, top: `${slot.cy}px` }}
                    data-testid={isOpener ? 'raise-chip' : undefined}
                  >
                    <div className={styles.chip} />
                    <span className={styles.chipAmount}>
                      {isOpener ? seat.raiseBb : seat.type === 'sb' ? '0.5' : '1'}
                    </span>
                  </div>
                )}
              </Fragment>
            );
          })}

          {/* Dealer button — a plain cream disc, wherever the BTN seat is */}
          <div
            className={styles.dealerButton}
            style={{ left: `${btnSlot.cx}px`, top: `${btnSlot.cy}px` }}
            aria-label="Dealer button"
          >
            D
          </div>

          {/* Action context in the middle of the felt */}
          <div className={styles.centre}>
            <span className={styles.centreName}>{posLong}</span>
            <span className={styles.actionContext}>{contextLine}</span>
          </div>

          {/* Hero's plaque — beside the cards, so it never covers them */}
          <div
            className={`${styles.seat} ${styles.heroSeat}`}
            style={{ left: `${HERO_PLAQUE.x}px`, top: `${HERO_PLAQUE.y}px` }}
          >
            <div className={styles.plaque}>
              <span className={styles.plaqueName}>{posLabel}</span>
              <span className={styles.plaqueStack}>you · {stackLabel}</span>
            </div>
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
