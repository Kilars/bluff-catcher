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
 *   depth       — the tier to open on. The sheet owns it after, but a new
 *                 `depth` from the caller redraws on it.
 *   depthExternal — the caller switches tiers (the chart browser's format and
 *                 stack strips), so the sheet's own depth strip is hidden.
 *   highlight   — hero's current hand class; marked only on the hero's own chart.
 *   heroPosition— seat of the hand being drilled, dotted in the tab strip.
 *   cellAction  — optional 4-colour mode, forwarded to RangeGrid as-is (PLAN-3bet F3).
 *   legend      — forwarded to RangeGrid; only meaningful with `cellAction`.
 *   footnote    — optional one-line note forwarded to RangeGrid, rendered under the chart.
 *   pages       — optional: page through these charts instead of the RFI
 *                 seats (the facing modes: every chart the mode deals). Same
 *                 arrows, tabs, keys and swipe; no depth strip. Pages with a
 *                 `group` (hero's seat) spanning several seats get a seat
 *                 strip above the tabs, which then show that seat's charts.
 *                 Each page brings its own colouring and copy.
 *   startPage   — the page to open on (hero's chart); `highlight` is marked
 *                 there only. Default 0. A new `pages` list reopens on it.
 *   menuExternal — the caller shows the chart on screen and its own strips
 *                 for it (the chart browser's seat and versus rows): `position`
 *                 or `page` is read on every render, the sheet's seat, chart
 *                 and position strips are hidden, and arrows, keys, wheel and
 *                 swipe call `onStep` instead.
 *   page        — with `menuExternal`, the page on screen.
 *   onStep      — with `menuExternal`, a step of ±1 asked for.
 *   strip       — optional strip rendered above the sheet's own strips (the
 *                 chart browser's format, spot and stack).
 *   onClose     — called when the sheet should close.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import RangeGrid, { type CellAction } from './RangeGrid';
import {
  CHART_KEYS,
  CHART_META,
  DEFAULT_DEPTH,
  SEAT_META,
  rangeComboCount,
  seatOnChart,
  stepSeat,
  type ChartKey,
  type Seat,
} from '../lib/preflop/ranges';
import type { HandClass } from '../lib/preflop/hands';
import { pageGroups, type ChartPage } from '../lib/preflop/grid';
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
  pages?: readonly ChartPage[];
  startPage?: number;
  depthExternal?: boolean;
  menuExternal?: boolean;
  page?: number;
  onStep?: (delta: number) => void;
  strip?: ReactNode;
  onClose: () => void;
}

export default function RangeSheet({
  position,
  depth = DEFAULT_DEPTH,
  highlight,
  heroPosition,
  cellAction,
  legend,
  footnote,
  pages,
  startPage = 0,
  depthExternal = false,
  menuExternal = false,
  page: controlledPage,
  onStep,
  strip,
  onClose,
}: RangeSheetProps) {
  // The chart currently on screen. Seeded from `position`, then owned here so
  // the user can browse away from the seat the sheet opened on. The sheet is
  // mounted only while open, so the seed is re-read on every open; callers that
  // keep it mounted across spots should pass a `key` to force a remount.
  const [pickedPos, setPickedPos] = useState<Seat>(position);

  // Same story for the tier: seeded from the caller, then owned here so the
  // player can flip 60bb+ → 20bb → 10bb on one seat and watch the chart move.
  // Cash is a fourth tab here: it swaps in the 6-max seats, and the same seat
  // can then be compared across formats.
  const [viewDepth, setViewDepth] = useState<ChartKey>(depth);
  // A new tier from the caller (the browser's stack strip) redraws on it, the
  // way a new `pages` list does below; the picked seat carries over.
  const [depthShown, setDepthShown] = useState(depth);
  if (depth !== depthShown) {
    setDepthShown(depth);
    setViewDepth(depth);
  }
  const meta = CHART_META[viewDepth];
  const seats = meta.seats;
  // The picked seat survives a trip to a chart that lacks it (see seatOnChart).
  const viewPos = menuExternal ? position : seatOnChart(pickedPos, viewDepth);

  // Paged mode (facing drills): the same navigator over a list of charts.
  const [ownPageIdx, setPageIdx] = useState(startPage);
  const pageIdx = menuExternal ? (controlledPage ?? 0) : ownPageIdx;
  // A new chart list (the browser switched decision or source) reopens on its
  // start page; adjusted during render so no frame shows a stale index.
  const [pagesShown, setPagesShown] = useState(pages);
  if (pages !== pagesShown) {
    setPagesShown(pages);
    setPageIdx(startPage);
  }
  const page = pages?.[pageIdx];
  const groups = useMemo(() => (menuExternal ? [] : pageGroups(pages)), [pages, menuExternal]);

  const idx = pages ? pageIdx : seats.indexOf(viewPos);
  const count = pages ? pages.length : seats.length;
  const canPrev = idx > 0;
  const canNext = idx < count - 1;

  const pageCount = pages?.length ?? 0;
  const step = useCallback(
    (delta: number) => {
      if (menuExternal) onStep?.(delta);
      else if (pageCount > 0) setPageIdx((cur) => Math.min(pageCount - 1, Math.max(0, cur + delta)));
      else setPickedPos((cur) => stepSeat(cur, viewDepth, delta));
    },
    [menuExternal, onStep, pageCount, viewDepth, setPageIdx]
  );

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
  const onHeroChart = pages ? pageIdx === startPage : viewPos === heroSeat;
  const gridHighlight = onHeroChart ? highlight : undefined;
  const noun = pages ? 'chart' : 'position';

  const arrows = (title: string) => (
    <div className={nav.titleRow}>
      <button
        type="button"
        className={nav.arrow}
        onClick={() => step(-1)}
        disabled={!canPrev}
        aria-label={`Previous ${noun}`}
      >
        ‹
      </button>
      <h1 className={styles.headerTitle}>{title}</h1>
      <button
        type="button"
        className={nav.arrow}
        onClick={() => step(1)}
        disabled={!canNext}
        aria-label={`Next ${noun}`}
      >
        ›
      </button>
    </div>
  );

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
            {page ? (
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>{page.kicker}</span>
              {arrows(page.title)}
              <p className={styles.headerSubline}>
                {page.subline}
                {page.subline && gridHighlight ? ' · ' : ''}
                {gridHighlight ? `Your hand: ${gridHighlight}` : ''}
              </p>
            </div>
            ) : (
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>
                {meta.rangeKicker} · {meta.label}
              </span>
              {arrows(SEAT_META[viewPos].title)}
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

          {strip}

          {/* Stack-depth strip — the same seat, three tiers */}
          {!pages && !depthExternal && !menuExternal && (
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

          {/* Hero-seat strip (paged mode, a mode spanning seats) — styled as
              the tier strip: it is the level above the chart tabs. */}
          {groups.length > 0 && (
          <div className={nav.depths} role="tablist" aria-label="Your seat">
            {groups.map((g) => (
              <button
                key={g.group}
                type="button"
                role="tab"
                aria-selected={g.group === page?.group}
                className={`${nav.depthTab} ${g.group === page?.group ? nav.depthTabActive : ''}`}
                onClick={() => setPageIdx(g.indices.includes(startPage) ? startPage : g.indices[0])}
              >
                <span className={nav.depthLabel}>
                  {g.group}
                  {highlight && g.indices.includes(startPage) && <span className={nav.heroDot} aria-label="(your seat)" />}
                </span>
                <span className={nav.depthName}>
                  {g.indices.length} chart{g.indices.length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </div>
          )}

          {/* Chart tab strip (paged mode): this seat's charts when grouped */}
          {pages && !menuExternal && (
          <div className={nav.tabs} role="tablist" aria-label={groups.length > 0 ? `${page?.group} vs` : 'Chart'}>
            {pages.map((p, i) => (groups.length > 0 && p.group !== page?.group ? null :
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === pageIdx}
                className={`${nav.tab} ${i === pageIdx ? nav.tabActive : ''}`}
                onClick={() => setPageIdx(i)}
              >
                {groups.length > 0 ? `vs ${p.tab}` : p.tab}
                {highlight && i === startPage && <span className={nav.heroDot} aria-label="(your chart)" />}
              </button>
            ))}
          </div>
          )}

          {/* Position tab strip */}
          {!pages && !menuExternal && (
          <div className={nav.tabs} role="tablist" aria-label="Position">
            {seats.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={p === viewPos}
                className={`${nav.tab} ${p === viewPos ? nav.tabActive : ''}`}
                onClick={() => setPickedPos(p)}
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
              cellAction={page?.cellAction ?? cellAction}
              legend={legend}
              footnote={page ? page.footnote : footnote}
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
            <span className={nav.navHint}>
              {pages
                ? '← / → arrows, tabs or swipe to change chart'
                : `← / → arrows, tabs or swipe to change position · ${meta.tagline}`}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
