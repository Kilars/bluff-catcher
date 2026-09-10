/**
 * PhoneSheet — the shared full-screen sheet frame for every phone overlay.
 *
 * PLAN-phone §5.3 settles the shape once so the menu sheet, the stats sheet,
 * the explanation and the range view are all the same object:
 *
 *   ┌──────────────────────────┐
 *   │          ▬▬▬▬            │  28 × 4 drag handle
 *   │  Title             ×     │  sticky 44px header
 *   │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
 *   │  scrolling body          │  overscroll-behavior: contain
 *   │                          │
 *   │  [ primary button ]      │  sticky footer — the exit path
 *   └──────────────────────────┘
 *
 * Full screen always (`inset: 0`, `height: 100dvh`, no radius), because a
 * partial sheet on a 390px screen is a 200px reading area with a 44px header.
 *
 * Drag-to-dismiss lives here rather than in each overlay: press anywhere on the
 * handle or the header and drag down. Past **96px of travel** or **0.5px/ms of
 * velocity** the sheet dismisses; below both it springs back over 180ms. A
 * flick and a slow deliberate pull therefore both work, which is the whole
 * point of having two thresholds instead of one.
 *
 * Presentation only: no drill state, no persistence, no viewport reads. The
 * one piece of state is how far the finger has moved.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import styles from './PhoneSheet.module.css';

// ─── Gesture constants ────────────────────────────────────────────────────────

/** Downward travel, in px, past which lifting the finger dismisses. */
const DISMISS_TRAVEL = 96;

/** Downward speed, in px/ms, past which lifting the finger dismisses at any travel. */
const DISMISS_VELOCITY = 0.5;

/** How long the sheet takes to slide home when the drag fell short. */
const SPRING_MS = 180;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Event time in ms. `e.timeStamp` is what a browser gives us and is monotonic;
 * the fallback is for environments that leave it unset. Written as an explicit
 * finite check rather than `e.timeStamp || Date.now()`, because the first event
 * of a gesture can legitimately carry 0 and that `||` would then mix a
 * monotonic clock with a wall clock and compute a nonsense velocity.
 */
function stampOf(e: { timeStamp: number }): number {
  return Number.isFinite(e.timeStamp) ? e.timeStamp : Date.now();
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhoneSheetProps {
  /** Header title. Also the dialog's accessible name. */
  title: string;
  /** Optional 11px uppercase line under the title (a tier, a position, a count). */
  subtitle?: string;
  /** Called by the × button, the Esc key, and a completed dismiss drag. */
  onClose: () => void;
  /** Sticky footer content — normally the primary button. Omitted → no footer. */
  footer?: ReactNode;
  /** Extra class on the scrolling body, for overlays that want their own padding. */
  bodyClassName?: string;
  children: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneSheet({
  title,
  subtitle,
  onClose,
  footer,
  bodyClassName,
  children,
}: PhoneSheetProps) {
  const titleId = useId();

  // How far down the finger has dragged the sheet, and whether we are playing
  // the spring-back. Both are pure presentation.
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  // Gesture bookkeeping. A ref, not state: a drag samples on every frame and
  // none of it should cause a render beyond the offset itself.
  const drag = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    velocity: number;
  } | null>(null);

  const springTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (springTimer.current !== null) clearTimeout(springTimer.current);
    },
    []
  );

  // ── Esc closes ────────────────────────────────────────────────────────────
  // Phones have no Esc key, but this sheet is also what a Bluetooth keyboard,
  // an iPad in Stage Manager at 599px, and every test harness reaches for.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Drag ──────────────────────────────────────────────────────────────────

  const endDrag = useCallback(
    (dismiss: boolean) => {
      drag.current = null;
      if (dismiss) {
        onClose();
        return;
      }
      // Spring home. The transition class is removed once it has played, so the
      // next drag starts unanimated and tracks the finger exactly.
      setSettling(true);
      setOffset(0);
      if (springTimer.current !== null) clearTimeout(springTimer.current);
      springTimer.current = setTimeout(() => setSettling(false), SPRING_MS);
    },
    [onClose]
  );

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Ignore secondary buttons; a right-click is not a dismiss gesture.
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const now = stampOf(e);
    drag.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: now,
      velocity: 0,
    };
    setSettling(false);
    // jsdom has no pointer capture; production needs it so the drag survives
    // the finger leaving the handle.
    if (typeof e.currentTarget.setPointerCapture === 'function') {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Capture is an optimisation, never a requirement.
      }
    }
  }, []);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const now = stampOf(e);
    const dt = now - d.lastT;
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = now;
    // Downward only. An upward drag on a sheet that is already at the top of
    // the screen has nowhere to go, and rubber-banding it just invites the
    // user to keep pulling.
    setOffset(Math.max(0, e.clientY - d.startY));
  }, []);

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const travel = Math.max(0, e.clientY - d.startY);
      // Either threshold is enough: a long slow pull commits, and so does a
      // short flick.
      endDrag(travel > DISMISS_TRAVEL || d.velocity > DISMISS_VELOCITY);
    },
    [endDrag]
  );

  const handlePointerCancel = useCallback(() => {
    if (drag.current) endDrag(false);
  }, [endDrag]);

  // ── Render ────────────────────────────────────────────────────────────────

  const dragHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  };

  return (
    <>
      <div className={styles.scrim} aria-hidden="true" />
      <div
        className={`${styles.sheet} ${settling ? styles.settling : ''}`}
        style={offset > 0 ? { transform: `translateY(${offset}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="phone-sheet"
      >
        <div className={styles.grab} {...dragHandlers}>
          <div className={styles.handleRow}>
            {/* Purely an affordance; × is the accessible control. */}
            <div className={styles.handle} aria-hidden="true" />
          </div>

          <div className={styles.header}>
            <div className={styles.titles}>
              <h2 className={styles.title} id={titleId}>
                {title}
              </h2>
              {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            </div>
            <button
              type="button"
              className={styles.close}
              aria-label={`Close ${title}`}
              onClick={onClose}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <div className={`${styles.body} ${bodyClassName ?? ''}`} data-testid="phone-sheet-body">
          {children}
        </div>

        {footer && (
          <div className={styles.footer} data-testid="phone-sheet-footer">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
