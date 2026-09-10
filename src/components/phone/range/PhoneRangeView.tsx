/**
 * PhoneRangeView — the 169-cell range chart, phone-native (PLAN-phone §3.1).
 *
 * The decision this implements, and its arithmetic on a 390px screen:
 *
 *     sheet inner width                        362px
 *     row-header track 18 + 13 gaps x 2px    =  44px overhead
 *     (362 - 44) / 13                        =  24.5  ->  24px cells
 *     grid                                       356 x 356, one screen, no scroll
 *
 * 24px is a cap rather than a fixed size: 356 does not fit the 332px measure of
 * a 360px phone, so below that the cells scale down together (22.2px at 360)
 * and the hit-test measures the pitch it actually got. The chart is still one
 * screen with no scroll at every width the phone tree serves.
 *
 * A 24px cell can hold a 10px label, but 169 of them at 10px is noise and the
 * 6px the old phone CSS used is below the legibility floor. **So the labels go.**
 * What the grid is for on a phone is the *shape* of the range — the whole lesson
 * of the 20bb tier, where BTN narrows sharply while UTG barely moves — and shape
 * survives label loss completely. A 40px pinch-zoom grid (586x586, ~2.6 screens)
 * destroys it; a grouped list (7,436px of scroll) never had it.
 *
 * Reading *one* cell is handled by two mitigations, both here:
 *
 *   1. **The drag-scrub readout.** Press anywhere on the grid and a fixed 44px
 *      bar above it names the cell under the finger: `K9s · open · HJ`.
 *   2. **The boundary sentence** (`lib/preflop/boundary.ts`), which says in words
 *      where the range stops: `HJ opens A2s+ suited, 33+ pairs, A8o+ offsuit`.
 *
 * Presentation and local view state only, per DECISIONS.md: which seat and which
 * tier are being *viewed*, and where the finger is. No drill logic, no deal, no
 * commit, no persistence — a parent mounts this and owns all of that.
 */

import { useCallback, useRef, useState } from 'react';
import {
  DEFAULT_DEPTH,
  DEPTHS,
  DEPTH_META,
  POSITIONS,
  isOpen,
  rangeComboCount,
  type Depth,
  type Position,
} from '../../../lib/preflop/ranges';
import { RANK_LABELS, cellClass } from '../../../lib/preflop/grid';
import { boundarySentence, positionLabel } from '../../../lib/preflop/boundary';
import type { HandClass } from '../../../lib/preflop/hands';
import styles from './PhoneRangeView.module.css';

// ─── Geometry ─────────────────────────────────────────────────────────────────
//
// The CSS consumes these as custom properties. The hit-test deliberately does
// NOT: it measures the grid it was handed and derives the pitch from that, so
// there is nothing to keep in step. A hit-test that disagrees with the layout
// by one gap names the wrong hand, and the surest way to disagree is to hold a
// second copy of a number the layout is free to change.

/**
 * Cell edge in px — the design *cap*, not a fixed size. It fits a 390px screen
 * exactly and a 360px one not at all, so the stylesheet treats it as a
 * `max-width` on the whole grid and lets the cells shrink below it when the
 * sheet is narrower. See `.grid` in the stylesheet.
 */
const CELL_PX = 24;
/** Gap between cells (and between the header track and the first cell). */
const GAP_PX = 2;
/** The rank-header track, on both axes. */
const HEADER_PX = 18;

/** Total preflop combos (52 choose 2) — denominator for the range percentage. */
const TOTAL_COMBOS = 1326;

/** Minimum horizontal px of a touch drag that counts as a seat-paging swipe. */
const SWIPE_MIN_PX = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhoneRangeViewProps {
  /** Seat to open on. Seeds the view; the strip owns it afterwards. */
  position: Position;
  /** Tier to open on. Seeds the view; default is the 40bb+ chart. */
  depth?: Depth;
  /** Hero's hand class, outlined on the hero's own chart only. */
  highlight?: HandClass;
  /** Hero's seat. Defaults to `position` when a `highlight` is given. */
  heroPosition?: Position;
  /**
   * Whether the tier can be switched from inside this view.
   *
   * `false` (default) renders the active tier as a static chip. That is the
   * trainer's sheet: a sheet-local depth that silently does not change what the
   * drill is testing is a phone trap. `true` renders the 3-way strip, and is
   * for the standalone chart browser opened from the menu.
   */
  depthSwitchable?: boolean;
}

interface Scrub {
  row: number;
  col: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampIndex(n: number): number {
  if (n < 0) return 0;
  if (n > 12) return 12;
  return n;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneRangeView({
  position,
  depth = DEFAULT_DEPTH,
  highlight,
  heroPosition,
  depthSwitchable = false,
}: PhoneRangeViewProps) {
  const [viewPos, setViewPos] = useState<Position>(position);
  const [viewDepth, setViewDepth] = useState<Depth>(depth);
  // Survives the lift on purpose: you scrub to a cell, take your finger off the
  // screen, and *then* read the bar the finger was covering.
  const [scrub, setScrub] = useState<Scrub | null>(null);

  const meta = DEPTH_META[viewDepth];
  const heroSeat = heroPosition ?? (highlight ? position : undefined);
  const heroHand = viewPos === heroSeat ? highlight : undefined;

  const combos = rangeComboCount(viewPos, viewDepth);
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1);

  // ── Scrubbing ─────────────────────────────────────────────────────────────
  //
  // Pointer events live on the *container*, not on 169 cells. Two reasons, and
  // the first is the load-bearing one for the whole design:
  //
  //   - A 24px cell is 55% of the 44px touch minimum, so the cells must not be
  //     discrete tap targets — a tap that must land inside 24px is a Fitts-law
  //     tax the phone spec (§1.4) rightly forbids. A continuous scrub has no
  //     such cost: you land anywhere and slide, and the bar tracks you. That
  //     exemption is exactly what makes 24px safe, and it only holds while the
  //     cells stay non-interactive. Do not add per-cell handlers.
  //   - One handler and one hit-test beats 169 listeners and 169 closures.

  const cellsRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const readPointer = useCallback((clientX: number, clientY: number) => {
    const el = cellsRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Pitch is *measured*, never assumed. 13 columns and 12 gaps fill whatever
    // width the grid got, so `(width + gap) / 13` is the true leading-edge-to-
    // leading-edge distance — 26px on a 390px screen, 24.15px on a 360px one.
    // A hardcoded 26 was right only at the one width the chart was designed
    // against, and a hit-test that disagrees with the layout by one gap names
    // the wrong hand.
    const pitchX = (rect.width + GAP_PX) / 13;
    const pitchY = (rect.height + GAP_PX) / 13;
    // Clamped, not discarded: a finger that drifts off the edge mid-drag keeps
    // reading the nearest cell instead of blanking the bar.
    const col = clampIndex(pitchX > 0 ? Math.floor((clientX - rect.left) / pitchX) : 0);
    const row = clampIndex(pitchY > 0 ? Math.floor((clientY - rect.top) / pitchY) : 0);
    setScrub((prev) => (prev && prev.row === row && prev.col === col ? prev : { row, col }));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      scrubbing.current = true;
      // Capture keeps the drag alive when the finger leaves the grid. jsdom and
      // older Safari can both throw here, and neither is worth a broken scrub.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* capture is an enhancement, not a requirement */
      }
      readPointer(e.clientX, e.clientY);
    },
    [readPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbing.current) return;
      readPointer(e.clientX, e.clientY);
    },
    [readPointer]
  );

  const endScrub = useCallback(() => {
    scrubbing.current = false;
  }, []);

  // ── Seat paging by swipe ──────────────────────────────────────────────────
  //
  // Kept from the desktop sheet, with one change it cannot do without: a swipe
  // that *starts on the grid* is a scrub, not a page turn. Without that test
  // the two gestures occupy the same 356px and fight each other.

  const touchStart = useRef<{ x: number; y: number; onGrid: boolean } | null>(null);

  const step = useCallback((delta: number) => {
    setViewPos((cur) => {
      const next = POSITIONS.indexOf(cur) + delta;
      if (next < 0 || next >= POSITIONS.length) return cur;
      return POSITIONS[next];
    });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = {
      x: t.clientX,
      y: t.clientY,
      onGrid: cellsRef.current?.contains(e.target as Node) ?? false,
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || start.onGrid) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Mostly-vertical drags are the sheet's dismiss gesture, not ours.
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
      step(dx < 0 ? 1 : -1);
    },
    [step]
  );

  // ── Readout copy ──────────────────────────────────────────────────────────

  const scrubHand = scrub ? cellClass(scrub.row, scrub.col) : null;
  const scrubOpen = scrubHand ? isOpen(viewPos, scrubHand, viewDepth) : false;

  const geometry = {
    '--phone-range-cell': `${CELL_PX}px`,
    '--phone-range-gap': `${GAP_PX}px`,
    '--phone-range-header': `${HEADER_PX}px`,
  } as React.CSSProperties;

  return (
    <div
      className={styles.view}
      style={geometry}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Tier — a strip only where switching tiers means something */}
      {depthSwitchable ? (
        <div className={styles.depths} role="tablist" aria-label="Stack depth">
          {DEPTHS.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === viewDepth}
              className={styles.depthTab}
              data-active={d === viewDepth}
              onClick={() => setViewDepth(d)}
            >
              <span className={styles.depthLabel}>{DEPTH_META[d].label}</span>
              <span className={styles.depthName}>{DEPTH_META[d].name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.depthChip} data-testid="depth-chip">
          <span className={styles.depthLabel}>{meta.label}</span>
          <span className={styles.depthName}>{meta.rangeKicker}</span>
        </p>
      )}

      {/* Seats — 7 x 44px + 6 x 4px gaps = 332px, inside the 366px measure */}
      <div className={styles.seats} role="tablist" aria-label="Position">
        {POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === viewPos}
            className={styles.seatTab}
            data-active={p === viewPos}
            onClick={() => setViewPos(p)}
          >
            {positionLabel(p)}
            {p === heroSeat && <span className={styles.heroDot} aria-label="(your seat)" />}
          </button>
        ))}
      </div>

      {/* The readout — fixed 44px, never collapses, so nothing below it moves */}
      <div className={styles.readout} data-testid="scrub-readout" aria-live="polite">
        {scrubHand ? (
          <>
            <span className={styles.readoutHand}>{scrubHand}</span>
            <span className={styles.readoutMeta}>
              {/* No leading space: it would be collapsed (see .readout's gap). */}
              {'· '}
              {scrubOpen ? meta.action : 'fold'}
              {' · '}
              {positionLabel(viewPos)}
            </span>
          </>
        ) : (
          <span className={styles.readoutHint}>Drag across the grid to read a hand</span>
        )}
      </div>

      {/* The words the 169 labels used to carry */}
      <p className={styles.boundary} data-testid="boundary-sentence">
        {boundarySentence(viewPos, viewDepth)}
      </p>

      <div className={styles.grid}>
        {/* Column rank headers, 11px — the legibility floor, and now affordable */}
        <div className={styles.colHeaders} aria-hidden="true">
          <div className={styles.corner} />
          {RANK_LABELS.map((rank) => (
            <div key={rank} className={styles.headerCell}>
              {rank}
            </div>
          ))}
        </div>

        <div className={styles.gridBody}>
          <div className={styles.rowHeaders} aria-hidden="true">
            {RANK_LABELS.map((rank) => (
              <div key={rank} className={styles.headerCell}>
                {rank}
              </div>
            ))}
          </div>

          <div
            ref={cellsRef}
            className={styles.cells}
            data-testid="grid-cells"
            aria-label={`${positionLabel(viewPos)} ${meta.rangeKicker.toLowerCase()} at ${meta.label}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endScrub}
            onPointerCancel={endScrub}
            onLostPointerCapture={endScrub}
          >
            {RANK_LABELS.map((_, rowIdx) =>
              RANK_LABELS.map((__, colIdx) => {
                const hc = cellClass(rowIdx, colIdx);
                const open = isOpen(viewPos, hc, viewDepth);
                const hero = heroHand === hc;
                const scrubbed = scrub?.row === rowIdx && scrub?.col === colIdx;

                // No text child, by design. The aria-label is the only name the
                // cell carries — sighted readers get the shape plus the scrub
                // readout, screen readers get the same sentence the desktop
                // grid gives them.
                return (
                  <div
                    key={hc}
                    className={styles.cell}
                    data-open={open}
                    data-region={rowIdx === colIdx ? 'pair' : rowIdx < colIdx ? 'suited' : 'offsuit'}
                    data-hero={hero || undefined}
                    data-scrubbed={scrubbed || undefined}
                    aria-label={`${hc}: ${open ? meta.action : 'fold'}${hero ? ' (your hand)' : ''}`}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      <p className={styles.summary}>
        {combos} combos · {pct}% · green = {meta.action}
      </p>
    </div>
  );
}
