/**
 * PhoneCommitBar — the swap zone of the phone odds drill: the dial half of
 * "a flashcard and a dial" (PLAN-phone §5.1), and the answer reveal.
 *
 * Why this is not the desktop rail
 * ────────────────────────────────
 * The desktop rail fails on a phone for a measurable reason (§3.3):
 *
 *     full-bleed 390px / 100 points  = 3.90 px per point
 *     a 44px thumb contact patch     = ±5.6 points
 *     GREEN_BAND (lib/band.ts)       = 5 points
 *
 * The thumb is wider than the band you are graded against, so you cannot
 * express an answer as precise as the answer being scored. And the desktop rail
 * commits on `pointerdown`, so a stray tap burns the hand with no undo.
 *
 * The decided gesture: **absolute grab → relative refine → explicit commit.**
 *
 *   - The bar is full-bleed 0 → 100vw (no gutter: that buys back 32px, i.e. 8
 *     points of resolution), 72px tall, inside a 120px invisible drag field.
 *   - Touching down anywhere sets the value by **absolute position** — the fast
 *     gut answer, one gesture, exactly what the desktop rail is good at.
 *   - Any further movement is **relative, 1 point per 6px of travel**, and is
 *     not bounded by the bar's width: a 300px swipe covers 50 points, and you
 *     can lift and re-grab to keep going. This is what gets you to a single
 *     point.
 *   - The value is drawn in the 44px readout well above the bar, never under
 *     the thumb.
 *   - **Lift does not commit.** The full-width 56px button does, and until
 *     first touch the readout shows an em dash.
 *
 * After the commit the *same bar* becomes the error visualisation — accent fill
 * 0 → you, a 3px you-mark, a 3px actual-mark and a band-coloured gap between
 * them — and the button relabels to "Next hand →". One bar, two jobs, and the
 * cards above it never move.
 *
 * The reveal inverts the type hierarchy on purpose: ACTUAL takes 44px and YOU
 * takes 27px. The guess is already drawn on the bar; the true number is the
 * thing worth memorising.
 *
 * Behaviour lives in `hooks/useOddsDrill` (DECISIONS.md, "two trees, one
 * behaviour"). The pending, uncommitted dial position is the hook's `hover`
 * state — the same slot the desktop rail's ghost uses — passed in here as
 * `pending`. The only state this component owns is the in-flight gesture, which
 * is a ref, not a render.
 */

import { useCallback, useRef } from 'react';
import { BAND_COLOR, BAND_LABEL, type Band } from '../../../lib/band';
import styles from './PhoneCommitBar.module.css';

// ─── Gesture constants ────────────────────────────────────────────────────────

/**
 * Pixels of finger travel per percentage point once the grab has landed.
 * 6px/pt against the bar's own ~3.9px/pt means refinement is ~1.5× slower than
 * the bar is wide, which is the whole point: single-point precision, unbounded
 * by 390px of glass.
 */
const PX_PER_POINT = 6;

/** Keyboard step, and its Shift-held coarse variant. */
const KEY_STEP = 1;
const KEY_STEP_COARSE = 10;

/** Where the arrow keys start from when nothing has been set yet. */
const KEY_DEFAULT = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhoneCommitBarProps {
  /** Committed guess, or null while the hand is still open. */
  guess: number | null;
  /** Uncommitted dial position (the drill hook's `hover`), or null pre-touch. */
  pending: number | null;
  trueTotal: number;
  drawName: string;
  drawNote: string;
  band: Band | null;
  delta: number;
  onPendingChange: (pct: number | null) => void;
  onCommit: (pct: number) => void;
  onNext: () => void;
  onOpenExplain: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneCommitBar({
  guess,
  pending,
  trueTotal,
  drawName,
  drawNote,
  band,
  delta,
  onPendingChange,
  onCommit,
  onNext,
  onOpenExplain,
}: PhoneCommitBarProps) {
  const committed = guess !== null;
  const bandColor = band ? BAND_COLOR[band] : 'var(--band-green)';

  /** The live gesture: where it started, and the value it started from. */
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);

  // ── Absolute grab ─────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (committed) return;
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      const absolute = rect.width
        ? clampPct(((e.clientX - rect.left) / rect.width) * 100)
        : KEY_DEFAULT;

      dragRef.current = { startX: e.clientX, startValue: absolute };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      // preventDefault above suppresses the implicit focus, so ask for it — the
      // keyboard handler below is only reachable if the field can hold focus.
      e.currentTarget.focus?.();
      onPendingChange(absolute);
    },
    [committed, onPendingChange]
  );

  // ── Relative refine ───────────────────────────────────────────────────────

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || committed) return;
      const next = clampPct(drag.startValue + (e.clientX - drag.startX) / PX_PER_POINT);
      if (next !== pending) onPendingChange(next);
    },
    [committed, pending, onPendingChange]
  );

  // ── Lift — deliberately NOT a commit ──────────────────────────────────────

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  // Carried over from the desktop rail. There is no keyboard on a phone, so no
  // key-hint badge is rendered — but a Bluetooth keyboard or a switch device
  // costs nothing to support, and this is the whole of that cost.

  const handleCommitAction = useCallback(() => {
    if (committed) {
      onNext();
      return;
    }
    onCommit(pending ?? KEY_DEFAULT);
  }, [committed, pending, onCommit, onNext]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === '?') {
        e.preventDefault();
        onOpenExplain();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCommitAction();
        return;
      }
      if (committed) return;
      const step = e.shiftKey ? KEY_STEP_COARSE : KEY_STEP;
      const current = pending ?? KEY_DEFAULT;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onPendingChange(clampPct(current + step));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onPendingChange(clampPct(current - step));
      }
    },
    [committed, pending, onPendingChange, onOpenExplain, handleCommitAction]
  );

  // ── Derived reveal geometry ───────────────────────────────────────────────

  const gapLeft = committed ? Math.min(guess, trueTotal) : 0;
  const gapWidth = committed ? Math.abs(guess - trueTotal) : 0;

  const buttonLabel = committed
    ? 'Next hand →'
    : pending === null
      ? 'Commit'
      : `Commit ${pending}%`;

  return (
    <section className={styles.commitBar} data-testid="phone-commit-bar">
      {/* ── Label row — 20px asking, 108px answering ─────────────────────── */}
      <div className={committed ? styles.labelRowRevealed : styles.labelRow}>
        {committed ? (
          <>
            <div className={styles.drawHeading}>
              <h2 className={styles.drawName}>{drawName}</h2>
              <button
                type="button"
                className={styles.explainBtn}
                onClick={onOpenExplain}
                aria-label="How is this counted?"
              >
                ?
              </button>
            </div>
            <p className={styles.drawNote}>{drawNote}</p>
          </>
        ) : (
          <span className={styles.kicker}>Chance you improve by the river</span>
        )}
      </div>

      {/* ── Readout — the value, ~130px clear of the thumb ───────────────── */}
      <div
        className={committed ? styles.readoutRevealed : styles.readout}
        data-testid="phone-readout"
      >
        {committed && band ? (
          <>
            {/* ACTUAL is the big one: the number to memorise. */}
            <div className={styles.resultBlock}>
              <span className={styles.resultKickerNeutral}>Actual</span>
              <span className={styles.actualValue} data-testid="phone-actual">
                {trueTotal.toFixed(1)}%
              </span>
            </div>
            <div className={styles.resultBlock}>
              <span className={styles.resultKickerAccent}>You</span>
              <span className={styles.youValue} data-testid="phone-you">
                {guess}%
              </span>
            </div>
            <div className={styles.bandBlock}>
              <span
                className={styles.bandPill}
                style={{ color: bandColor, boxShadow: `inset 0 0 0 1px ${bandColor}` }}
              >
                {BAND_LABEL[band]}
              </span>
              <span className={styles.bandDelta}>off by {delta.toFixed(1)}</span>
            </div>
          </>
        ) : (
          <span className={styles.pendingValue} data-testid="phone-pending">
            {pending === null ? '—' : `${pending}%`}
          </span>
        )}
      </div>

      {/* ── The bar — full-bleed, and the error visualisation after commit ── */}
      <div className={styles.dial}>
        <div className={styles.track} data-testid="phone-track">
          <div className={styles.tick} style={{ left: '25%' }} />
          <div className={`${styles.tick} ${styles.tickMid}`} style={{ left: '50%' }} />
          <div className={styles.tick} style={{ left: '75%' }} />

          {!committed && pending !== null && (
            <>
              <div className={styles.pendingFill} style={{ width: `${pending}%` }} />
              <div
                className={styles.pendingMark}
                style={{ left: `${pending}%` }}
                data-testid="phone-pending-mark"
              />
            </>
          )}

          {committed && (
            <>
              <div className={styles.accentFill} style={{ width: `${guess}%` }} />
              <div
                className={styles.gapBar}
                style={{ left: `${gapLeft}%`, width: `${gapWidth}%`, background: bandColor }}
                data-testid="phone-gap-bar"
              />
              <div
                className={styles.youMark}
                style={{ left: `${guess}%` }}
                data-testid="phone-you-mark"
              />
              <div
                className={styles.actualMark}
                style={{ left: `${trueTotal}%` }}
                data-testid="phone-actual-mark"
              />
            </>
          )}
        </div>

        {/* The 120px invisible drag field: 24px of slop above and below the
            72px bar, so a thumb that lands short still grabs it. */}
        <div
          className={styles.field}
          data-testid="phone-drag-field"
          role="slider"
          tabIndex={0}
          aria-label="Chance you improve by the river"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={guess ?? pending ?? KEY_DEFAULT}
          aria-valuetext={pending === null && !committed ? 'not set' : undefined}
          aria-disabled={committed || undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* ── Ruler ───────────────────────────────────────────────────────── */}
      <div className={styles.ruler} aria-hidden="true">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>

      {/* ── The commit — the only thing that ends a hand ─────────────────── */}
      <button
        type="button"
        className={styles.primaryBtn}
        data-testid="phone-commit-button"
        disabled={!committed && pending === null}
        onClick={handleCommitAction}
      >
        {buttonLabel}
      </button>
    </section>
  );
}
