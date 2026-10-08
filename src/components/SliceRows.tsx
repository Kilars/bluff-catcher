/**
 * SliceRows — one stroke through a stack of tab rows picks a tab in each row
 * it crosses (docs/PLAN-slice-menu.md, phases 2 and 3). A mouse drag and a
 * finger are the same pointer events, so both slice.
 *
 * The rows are the children: each a `[data-row]` element of `[data-id]` tabs.
 * Nothing about them is assumed; every move measures them afresh, so rows
 * that appear mid-stroke (leaving Drill) are sliceable at once.
 *
 *   - A press that stays within 8px is a tap: the tab's own click handles it.
 *   - Past 8px it's a slice. A row picks the tab where the stroke crosses its
 *     centre line, not every tab it touches: a diagonal from CO down-left to
 *     vs HJ passes over You HJ on its way out of the row, and must not pick
 *     it. The press point picks too, and so does a mostly sideways move
 *     inside a row, so you can drift along a row to correct.
 *   - Each pick goes to `onPick`, which ignores tabs that don't apply.
 *   - The path between two moves is checked as a segment, so a fast flick
 *     can't skip a 36px row.
 *   - The click that ends a slice is swallowed, so lifting over a tab doesn't
 *     re-pick it.
 *
 * The trail is a canvas over the rows, a tapered stroke that fades out behind
 * the pointer; a pick flashes its tab and, on a phone that can, buzzes. Both
 * are skipped under `prefers-reduced-motion`.
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import styles from './SliceRows.module.css';

/** Movement, in px, past which a press is a slice and not a tap. */
const SLICE_START_PX = 8;
/** How long, in ms, after a slice its closing click is swallowed. */
const SWALLOW_MS = 350;
/** A move this much more sideways than down is a drift along a row, and picks. */
const DRIFT_RATIO = 2;
/** How long, in ms, a point of the trail lives. */
const TRAIL_MS = 220;
/** The trail's width at its head, in CSS px. */
const TRAIL_WIDTH = 8;
/** How far the trail's canvas reaches past the rows, in CSS px (`.trail`'s inset). */
const BLEED = 16;

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  pointerId: number;
  pointerType: string;
  start: Point;
  last: Point;
  slicing: boolean;
  /** The last row/tab offered, so a pause over a tab doesn't re-offer it. */
  lastHit: string;
}

export interface SliceRowsProps {
  children: ReactNode;
  /** The stroke is over a tab: pick it, and say whether anything changed. */
  onPick: (row: string, id: string) => boolean;
  className?: string;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The tab under a point: the row it's in, then the tab it's over. */
function hitTest(root: HTMLElement, { x, y }: Point): HTMLElement | null {
  for (const row of root.querySelectorAll<HTMLElement>('[data-row]')) {
    const r = row.getBoundingClientRect();
    if (y < r.top || y >= r.bottom) continue;
    for (const tab of row.querySelectorAll<HTMLElement>('[data-id]')) {
      const t = tab.getBoundingClientRect();
      if (x >= t.left && x < t.right) return tab;
    }
    return null;
  }
  return null;
}

export default function SliceRows({ children, onPick, className }: SliceRowsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stroke = useRef<Stroke | null>(null);
  const swallowClick = useRef(false);

  // ── Trail ─────────────────────────────────────────────────────────────────

  const trail = useRef<{ x: number; y: number; t: number }[]>([]);
  const frame = useRef(0);

  /** Fit the canvas to the rows (plus the bleed) at the screen's density. */
  const sizeCanvas = useCallback(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const r = root.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round((r.width + 2 * BLEED) * dpr);
    const h = Math.round((r.height + 2 * BLEED) * dpr);
    // Setting a size clears the bitmap, so only when it changed.
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }, []);

  const draw = useCallback(function frameTrail() {
    frame.current = 0;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // Rows can mount mid-stroke (leaving Drill): keep the bitmap the box's size.
    sizeCanvas();
    const now = performance.now();
    const pts = (trail.current = trail.current.filter((p) => now - p.t < TRAIL_MS));
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pts.length > 1) {
      const accent = getComputedStyle(canvas).getPropertyValue('--color-accent').trim() || '#8b7cf6';
      ctx.lineCap = 'round';
      // The blade, then a pale core: each segment narrows and fades with age.
      for (const [colour, scale] of [
        [accent, 1],
        ['rgba(255,255,255,0.85)', 0.4],
      ] as const) {
        ctx.strokeStyle = colour;
        for (let i = 1; i < pts.length; i++) {
          const life = 1 - (now - pts[i].t) / TRAIL_MS;
          ctx.globalAlpha = Math.max(0, life);
          ctx.lineWidth = Math.max(0.5, TRAIL_WIDTH * scale * life * (i / pts.length));
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    if (pts.length > 0) frame.current = requestAnimationFrame(frameTrail);
  }, [sizeCanvas]);

  const addTrail = useCallback(
    (p: Point) => {
      const root = rootRef.current;
      if (!root || reducedMotion()) return;
      const r = root.getBoundingClientRect();
      trail.current.push({ x: p.x - r.left + BLEED, y: p.y - r.top + BLEED, t: performance.now() });
      if (!frame.current && typeof requestAnimationFrame === 'function') frame.current = requestAnimationFrame(draw);
    },
    [draw]
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);


  // ── Picking ───────────────────────────────────────────────────────────────

  const offer = useCallback(
    (p: Point) => {
      const root = rootRef.current;
      const s = stroke.current;
      if (!root || !s) return;
      const tab = hitTest(root, p);
      const row = tab?.closest<HTMLElement>('[data-row]')?.dataset.row;
      const id = tab?.dataset.id;
      if (!tab || !row || !id) return;
      const hit = `${row}:${id}`;
      if (hit === s.lastHit) return;
      s.lastHit = hit;
      if (!onPick(row, id) || reducedMotion()) return;
      tab.animate?.(
        [
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.1)', filter: 'brightness(1.7)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 180, easing: 'ease-out' }
      );
      if (s.pointerType === 'touch') navigator.vibrate?.(8);
    },
    [onPick]
  );

  /** Offer where a segment crosses each row's centre line, in stroke order. */
  const sweep = useCallback(
    (from: Point, to: Point) => {
      const root = rootRef.current;
      if (!root) return;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const crossings: Point[] = [];
      for (const row of root.querySelectorAll<HTMLElement>('[data-row]')) {
        const r = row.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        // Reached the line on this move, from either side.
        if ((from.y < mid && to.y >= mid) || (from.y > mid && to.y <= mid)) {
          crossings.push({ x: from.x + (dx * (mid - from.y)) / dy, y: mid });
        }
      }
      // A fast shallow flick still crosses rows; only a move that crosses none
      // is a drift along the row it's in.
      if (crossings.length === 0) {
        if (Math.abs(dx) > DRIFT_RATIO * Math.abs(dy)) offer(to);
        return;
      }
      crossings.sort((a, b) => (dy > 0 ? a.y - b.y : b.y - a.y)).forEach(offer);
    },
    [offer]
  );

  // ── Pointer handling ──────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // One stroke at a time: a second finger doesn't take over the first's.
    if (stroke.current && stroke.current.pointerId !== e.pointerId) return;
    swallowClick.current = false;
    const p = { x: e.clientX, y: e.clientY };
    stroke.current = { pointerId: e.pointerId, pointerType: e.pointerType ?? 'mouse', start: p, last: p, slicing: false, lastHit: '' };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || e.pointerId !== s.pointerId) return;
    // Released outside the rows before the stroke was held: no button, no slice.
    if (s.pointerType === 'mouse' && e.buttons === 0) {
      stroke.current = null;
      return;
    }
    const p = { x: e.clientX, y: e.clientY };
    if (!s.slicing) {
      if (Math.hypot(p.x - s.start.x, p.y - s.start.y) < SLICE_START_PX) return;
      s.slicing = true;
      // Held from here, so the stroke keeps going when it leaves the rows.
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* capture is an enhancement */
      }
      sizeCanvas();
      addTrail(s.start);
      offer(s.start);
    }
    sweep(s.last, p);
    addTrail(p);
    s.last = p;
  };

  const endStroke = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || e.pointerId !== s.pointerId) return;
    stroke.current = null;
    if (s.slicing) {
      swallowClick.current = true;
      // A click follows when the press began and ended on one tab, and a phone
      // can send it late (its tap slop is wider than ours). The next press
      // clears it too.
      setTimeout(() => (swallowClick.current = false), SWALLOW_MS);
    }
  };

  const handleClickCapture = (e: React.MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  // The phone view pages seats on a horizontal swipe; a slice is not one.
  const stopTouch = (e: React.TouchEvent) => e.stopPropagation();

  return (
    <div
      ref={rootRef}
      className={`${styles.slice} ${className ?? ''}`}
      data-testid="slice-rows"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      onClickCapture={handleClickCapture}
      onTouchStart={stopTouch}
      onTouchEnd={stopTouch}
    >
      {children}
      <canvas ref={canvasRef} className={styles.trail} aria-hidden="true" />
    </div>
  );
}
