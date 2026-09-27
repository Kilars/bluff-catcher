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
import {
  CHART_META,
  DEFAULT_DEPTH,
  SEAT_META,
  formatOf,
  type ChartKey,
  type Format,
  type Seat,
} from '../lib/preflop/ranges';

// ─── Seat → display label ─────────────────────────────────────────────────────

/** Short seat labels ("UTG+1", "SB"), from the one shared `SEAT_META`. */
export const POSITION_LABEL: Record<Seat, string> = Object.fromEntries(
  Object.entries(SEAT_META).map(([seat, meta]) => [seat, meta.short])
) as Record<Seat, string>;

// ─── Seat layout ──────────────────────────────────────────────────────────────

/**
 * Seat layout from hero's perspective — hero always sits at the bottom seat,
 * the others run clockwise around the oval, which is the order the action
 * moves in (hero → the seat on hero's left → … → back round to hero).
 *
 * Each format has its own ring, in action order, blinds last:
 *   tournament (9-max): UTG UTG+1 UTG+2 LJ HJ CO BTN SB BB
 *   cash (6-max):       LJ HJ CO BTN SB BB
 * Seats earlier in the ring than hero have already acted (folded, or opened);
 * later ones are still to act. The blinds are always posted — hero on the SB
 * (cash only) is the one case where a blind is hero's own seat.
 */
const RING: Record<Format, readonly string[]> = {
  mtt: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  cash: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

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

const MTT_SLOTS: SeatSlot[] = [
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

/**
 * The 6-max ring on the same ellipse: hero at the bottom and five seats at
 * roughly 60° steps, the top one centred. Chips sit a fifth of the way toward
 * the middle of the felt, like the 9-max ones.
 */
const CASH_SLOTS: SeatSlot[] = [
  MTT_SLOTS[0],
  { x: 103, y: 272, cx: 164, cy: 256 }, // 1 — bottom left
  { x: 103, y: 108, cx: 164, cy: 124 }, // 2 — top left
  { x: 410, y: 36, cx: 410, cy: 89 },   // 3 — top centre
  { x: 717, y: 108, cx: 656, cy: 124 }, // 4 — top right
  { x: 717, y: 272, cx: 656, cy: 256 }, // 5 — bottom right
];

const SEAT_SLOTS: Record<Format, SeatSlot[]> = { mtt: MTT_SLOTS, cash: CASH_SLOTS };

/** Hero's own plaque sits just above hero's cards, at the bottom of the felt. */
const HERO_PLAQUE = { x: 410, y: 209 };

/** Default open size for the opener seat (PLAN-3bet: 2.5bb). */
export const DEFAULT_OPENER_RAISE_BB = 2.5;

/**
 * Builds every non-hero seat in action order: the non-blind seats other than
 * hero's own, then SB and BB (minus hero, when hero is the SB).
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
  heroPos: Seat,
  opener?: Seat,
  raiseBb: number = DEFAULT_OPENER_RAISE_BB,
  format: Format = 'mtt'
): SeatInfo[] {
  const ring = RING[format];
  const heroIdx = ring.indexOf(POSITION_LABEL[heroPos]);
  const openerLabel = opener === undefined ? undefined : POSITION_LABEL[opener];
  const seats: SeatInfo[] = [];

  ring.forEach((label, i) => {
    if (i === heroIdx) return; // hero sits at the bottom, not in the ring loop
    if (label === 'SB' || label === 'BB') {
      seats.push({ label, type: label === 'SB' ? 'sb' : 'bb' });
      return;
    }
    const isOpener = i < heroIdx && label === openerLabel;
    seats.push({
      label,
      type: isOpener ? 'opener' : i < heroIdx ? 'folded' : 'toAct',
      isBtn: label === 'BTN',
      raiseBb: isOpener ? raiseBb : undefined,
    });
  });

  return seats;
}

/**
 * Ring slot for a seat label, given where hero sits: 0 = hero, then clockwise.
 * Hero's own seat is slot 0, so the BTN slot is 0 exactly when hero has the
 * button — that is the case where the dealer button belongs next to hero.
 */
export function seatSlotIndex(heroPos: Seat, seatLabel: string, format: Format = 'mtt'): number {
  const ring = RING[format];
  const heroIdx = ring.indexOf(POSITION_LABEL[heroPos]);
  const seatIdx = ring.indexOf(seatLabel);
  return (seatIdx - heroIdx + ring.length) % ring.length;
}

/**
 * The context line under the position label:
 *   "3 players folded before you · 3 players to act behind you (BTN last)"
 *
 * foldedBefore = hero's index in the ring; toActBehind = the non-blind seats
 * between hero and the button, button included. Hero on the SB has only the
 * BB left.
 */
export function buildContextLine(heroPos: Seat, format: Format = 'mtt'): string {
  const ring = RING[format];
  const heroIdx = ring.indexOf(POSITION_LABEL[heroPos]);
  const foldedBefore = heroIdx;
  const toActBehind = ring.indexOf('BTN') - heroIdx;

  const foldedPart =
    foldedBefore === 0
      ? 'First in — nobody has acted'
      : `${foldedBefore} player${foldedBefore === 1 ? '' : 's'} folded before you`;

  const actPart =
    toActBehind < 0
      ? 'only the BB behind you'
      : toActBehind === 0
        ? "0 to act behind you — you're on the button"
        : toActBehind === 1
          ? '1 player to act behind you (the BTN)'
          : `${toActBehind} players to act behind you (BTN last)`;

  return `${foldedPart} · ${actPart}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PreflopTableProps {
  hero: [CardCode, CardCode];
  position: Seat;
  /** Chart key — drives the figure written on every plaque, and the ring (9-max or 6-max). */
  depth?: ChartKey;
  /** Table size override; defaults to the chart key's format. The facing drill passes it. */
  format?: Format;
  /**
   * The facing-open drill's raiser (PLAN-3bet F2): a seat before hero that
   * opened instead of folding. Omit it and the table renders exactly as the
   * RFI drill always has — every seat before hero folded, no raise chip.
   */
  opener?: Seat;
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
  format: formatProp,
  opener,
  raiseBb = DEFAULT_OPENER_RAISE_BB,
  openerTag,
  stackLabel: stackLabelOverride,
  centreTitle,
  centreLine,
}: PreflopTableProps) {
  // Everyone at the table is on the same effective stack — that is the whole
  // premise of a single-depth chart, so one label covers every plaque.
  const format = formatProp ?? formatOf(depth);
  const slots = SEAT_SLOTS[format];
  const stackLabel = stackLabelOverride ?? CHART_META[depth].stackLabel;
  const seats = buildSeats(position, opener, raiseBb, format);
  const posLabel = POSITION_LABEL[position];
  const posLong = centreTitle ?? SEAT_META[position].long;
  const contextLine = centreLine ?? buildContextLine(position, format);

  // The dealer button rides with the BTN seat — slot 0 means hero has it.
  const btnSlot = slots[seatSlotIndex(position, 'BTN', format)];
  // Hero on the SB posts too: the chip goes where the button would sit beside
  // hero's cards. The two never collide — hero cannot be both SB and BTN.
  const heroBlind = position === 'SB';

  return (
    <section className={styles.table}>
      <div className={styles.feltScaleWrap}>
        <div className={styles.felt}>
          {/* Inner accent ring */}
          <div className={styles.accentRing} />

          {/* The non-hero seats, placed around the oval in clockwise order */}
          {seats.map((seat) => {
            const slot = slots[seatSlotIndex(position, seat.label, format)];
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

          {heroBlind && (
            <div
              className={styles.chipSpot}
              style={{ left: `${slots[0].cx}px`, top: `${slots[0].cy}px` }}
              data-testid="hero-blind-chip"
            >
              <div className={styles.chip} />
              <span className={styles.chipAmount}>0.5</span>
            </div>
          )}

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
