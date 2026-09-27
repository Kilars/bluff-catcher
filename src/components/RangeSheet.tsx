/**
 * RangeSheet — sheet overlay that displays the full 13×13 range grid, with
 * navigation across every seat's chart and every stack depth.
 *
 * Reuses ExplainSheet's CSS module (backdrop, sheet, sheetInner, sheetHeader,
 * closeBtn, divider, footer, btnAccent) without forking the animation; the
 * navigator chrome lives in RangeSheet.module.css.
 *
 * Navigation — four ways to move between positions:
 *   1. ‹ / › arrow buttons beside the title
 *   2. the position tab strip (UTG … BTN)
 *   3. ArrowLeft / ArrowRight keys
 *   4. horizontal wheel/trackpad scroll or touch swipe over the grid
 * Movement is clamped at both ends (no wraparound) so the seat order stays
 * legible as "earliest → latest position".
 *
 * A second strip above the seats switches stack depth (60bb+ / 20bb / 10bb, and Cash, which swaps in the 6-max seats),
 * so the same seat can be compared across tiers without closing the sheet.
 * Depth is sheet-local: browsing to 10bb here does not change the tier the
 * trainer is drilling.
 *
 * The sheet is used from two places:
 *   - PreflopTrainer, after a commit: opens on the hero's seat, hand highlighted.
 *   - The header menu: opens standalone as a chart browser (no hand).
 *
 * Props:
 *   position    — the seat to open on (initial only; the sheet owns it after).
 *   depth       — the tier to open on (initial only; the sheet owns it after).
 *   highlight   — hero's current hand class; marked only on the hero's own chart.
 *   heroPosition— seat of the hand being drilled, dotted in the tab strip.
 *   cellAction  — optional 4-colour mode, forwarded to RangeGrid as-is (PLAN-3bet F3).
 *   legend      — forwarded to RangeGrid; only meaningful with `cellAction`.
 *   footnote    — optional one-line note forwarded to RangeGrid, rendered under the chart.
 *   fixedChart  — optional: show one fixed chart under this header instead of the
 *                 seat/depth navigator (the facing drill's bucket chart). The
 *                 tabs, arrows and swipe paging go away; `highlight` is always marked.
 *   onClose     — called when the sheet should close.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import RangeGrid, { type CellAction } from './RangeGrid';
import {
  CHART_KEYS,
  CHART_META,
  DEFAULT_DEPTH,
  SEAT_META,
  rangeComboCount,
  seatOnChart,
  type ChartKey,
  type Seat,
} from '../lib/preflop/ranges';
import type { HandClass } from '../lib/preflop/hands';
import styles from './ExplainSheet.module.css';
import nav from './RangeSheet.module.css';

/** Total preflop combos (52 choose 2) — denominator for the range percentage. */
const TOTAL_COMBOS = 1326;

// ─── Gesture tuning ───────────────────────────────────────────────────────────

/** Horizontal px that must accumulate before a wheel gesture steps a position. */
const WHEEL_STEP_PX = 60;
/** Minimum horizontal px of a touch drag that counts as a swipe. */
const SWIPE_MIN_PX = 50;

// ─── Component ────────────────────────────────────────────────────────────────

interface RangeSheetProps {
  position: Seat;
  depth?: ChartKey;
  highlight?: HandClass;
  heroPosition?: Seat;
  cellAction?: (hc: HandClass) => CellAction;
  legend?: boolean;
  footnote?: string;
  fixedChart?: FixedChart;
  onClose: () => void;
}

/** Header for a single, non-navigable chart. */
export interface FixedChart {
  kicker: string;
  title: string;
  subline?: string;
}

export default function RangeSheet({
  position,
  depth = DEFAULT_DEPTH,
  highlight,
  heroPosition,
  cellAction,
  legend,
  footnote,
  fixedChart,
  onClose,
}: RangeSheetProps) {
  const navigable = fixedChart === undefined;
  // The chart currently on screen. Seeded from `position`, then owned here so
  // the user can browse away from the seat the sheet opened on. The sheet is
  // mounted only while open, so the seed is re-read on every open; callers that
  // keep it mounted across spots should pass a `key` to force a remount.
  const [pickedPos, setViewPos] = useState<Seat>(position);

  // Same story for the tier: seeded from the caller, then owned here so the
  // player can flip 60bb+ → 20bb → 10bb on one seat and watch the chart move.
  // Cash is a fourth tab here: it swaps in the 6-max seats, and the same seat
  // can then be compared across formats.
  const [viewDepth, setViewDepth] = useState<ChartKey>(depth);
  const meta = CHART_META[viewDepth];
  const seats = meta.seats;
  // The picked seat survives a trip to a chart that lacks it (see seatOnChart).
  const viewPos = seatOnChart(pickedPos, viewDepth);

  const idx = seats.indexOf(viewPos);
  const canPrev = idx > 0;
  const canNext = idx < seats.length - 1;

  const step = useCallback((delta: number) => {
    if (!navigable) return;
    setViewPos((cur) => {
      const onChart = CHART_META[viewDepth].seats;
      const next = onChart.indexOf(seatOnChart(cur, viewDepth)) + delta;
      if (next < 0 || next >= onChart.length) return cur;
      return onChart[next];
    });
  }, [navigable, viewDepth]);

  // ── Keyboard: ← / → step, Esc closes ─────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, onClose]);

  // ── Wheel: horizontal trackpad scroll steps a position ───────────────────
  // Only deltaX is consumed, so vertical scrolling of a tall grid still works.
  const wheelAccum = useRef(0);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      wheelAccum.current += e.deltaX;
      if (wheelAccum.current >= WHEEL_STEP_PX) {
        wheelAccum.current = 0;
        step(1);
      } else if (wheelAccum.current <= -WHEEL_STEP_PX) {
        wheelAccum.current = 0;
        step(-1);
      }
    },
    [step]
  );

  // ── Touch: horizontal swipe steps a position ─────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Ignore mostly-vertical drags — those are scrolls, not swipes.
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return;
      step(dx < 0 ? 1 : -1);
    },
    [step]
  );

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  // Only mark the hand on the chart it was actually dealt in.
  const heroSeat = heroPosition ?? (highlight ? position : undefined);
  const gridHighlight = !navigable || viewPos === heroSeat ? highlight : undefined;

  const combos = rangeComboCount(viewPos, viewDepth);
  const pct = ((combos / TOTAL_COMBOS) * 100).toFixed(1);

  return (
    <>
      {/* Backdrop — reuses ExplainSheet backdrop class for identical styling */}
      <div className={styles.backdrop} onClick={handleBackdropClick} />

      {/* Sheet — top:0 (full-screen) so the wide grid has room */}
      <div className={styles.sheet} style={{ top: '0px' }}>
        <div
          className={styles.sheetInner}
          /* Narrower measure than the explain sheet: the chart is square and
             height-bound, so it never gets wide.  A measure that hugs it keeps
             the header, the tabs and the grid reading as one centred column
             instead of a heading stranded away from its chart.
             See ExplainSheet.module.css → .sheetInner > *. */
          style={{ borderRadius: '0px', '--sheet-measure': '760px' } as React.CSSProperties}
        >
          {/* Header */}
          <div className={styles.sheetHeader}>
            {fixedChart ? (
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>{fixedChart.kicker}</span>
              <h1 className={styles.headerTitle}>{fixedChart.title}</h1>
              <p className={styles.headerSubline}>
                {fixedChart.subline}
                {fixedChart.subline && gridHighlight ? ' · ' : ''}
                {gridHighlight ? `Your hand: ${gridHighlight}` : ''}
              </p>
            </div>
            ) : (
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>
                {meta.rangeKicker} · {meta.label}
              </span>
              <div className={nav.titleRow}>
                <button
                  type="button"
                  className={nav.arrow}
                  onClick={() => step(-1)}
                  disabled={!canPrev}
                  aria-label="Previous position"
                >
                  ‹
                </button>
                <h1 className={styles.headerTitle}>{SEAT_META[viewPos].title}</h1>
                <button
                  type="button"
                  className={nav.arrow}
                  onClick={() => step(1)}
                  disabled={!canNext}
                  aria-label="Next position"
                >
                  ›
                </button>
              </div>
              <p className={styles.headerSubline}>
                {combos} combos · {pct}% · green = {meta.action}, dark = fold
                {gridHighlight ? ` · Your hand: ${gridHighlight}` : ''}
              </p>
            </div>
            )}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close range grid"
            >
              ×
            </button>
          </div>

          {/* Stack-depth strip — the same seat, three tiers */}
          {navigable && (
          <div className={nav.depths} role="tablist" aria-label="Chart">
            {CHART_KEYS.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === viewDepth}
                className={`${nav.depthTab} ${d === viewDepth ? nav.depthTabActive : ''}`}
                onClick={() => setViewDepth(d)}
              >
                <span className={nav.depthLabel}>{CHART_META[d].label}</span>
                <span className={nav.depthName}>{CHART_META[d].name}</span>
              </button>
            ))}
          </div>
          )}

          {/* Position tab strip */}
          {navigable && (
          <div className={nav.tabs} role="tablist" aria-label="Position">
            {seats.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === viewPos}
                className={`${nav.tab} ${p === viewPos ? nav.tabActive : ''}`}
                onClick={() => setViewPos(p)}
              >
                {SEAT_META[p].short}
                {p === heroSeat && (
                  <span className={nav.heroDot} aria-label="(your seat)" />
                )}
              </button>
            ))}
          </div>
          )}

          {/* Divider */}
          <div className={styles.divider} />

          {/* Grid body — swipe / horizontal-scroll target */}
          <div
            className={nav.body}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <RangeGrid
              position={viewPos}
              depth={viewDepth}
              highlight={gridHighlight}
              cellAction={cellAction}
              legend={legend}
              footnote={footnote}
            />
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnAccent}
              onClick={onClose}
            >
              Close
            </button>
            {navigable && (
              <span className={nav.navHint}>
                ← / → arrows, tabs or swipe to change position · {meta.tagline}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
