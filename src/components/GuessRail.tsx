/**
 * GuessRail — the 0–100 tap-to-commit percentage rail.
 *
 * Before commit: pointer-move shows ghost line + live %; tap commits that %.
 * After commit: accent fill, guess/true marks, error gap, YOU/ACTUAL labels.
 * Tap after commit → next().
 *
 * Keyboard (focusable, tabIndex=0):
 *   ←/↓ −1, →/↑ +1 (Shift = 10) → move ghost (default start 50)
 *   Enter/Space → commit ghost (default 50) or next() if committed
 *   ? → openExplain
 */

import { useCallback } from 'react';
import styles from './GuessRail.module.css';

interface GuessRailProps {
  guess: number | null;
  hover: number | null;
  trueTotal: number;
  bandColor: string;
  onCommit: (pct: number) => void;
  onNext: () => void;
  onHoverChange: (pct: number | null) => void;
  onOpenExplain: () => void;
}

function pctFrom(e: React.PointerEvent<HTMLDivElement>): number {
  const rect = e.currentTarget.getBoundingClientRect();
  return Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
}

export default function GuessRail({
  guess,
  hover,
  trueTotal,
  bandColor,
  onCommit,
  onNext,
  onHoverChange,
  onOpenExplain,
}: GuessRailProps) {
  const committed = guess !== null;

  // ── Pointer handlers ──────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (committed) {
        onNext();
        return;
      }
      onCommit(pctFrom(e));
      e.currentTarget.focus();
    },
    [committed, onCommit, onNext]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (committed) return;
      onHoverChange(pctFrom(e));
    },
    [committed, onHoverChange]
  );

  const handlePointerLeave = useCallback(() => {
    if (hover !== null) onHoverChange(null);
  }, [hover, onHoverChange]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === '?') {
        e.preventDefault();
        onOpenExplain();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (committed) {
          onNext();
        } else {
          onCommit(hover === null ? 50 : hover);
        }
        return;
      }
      if (committed) return;
      const step = e.shiftKey ? 10 : 1;
      const cur = hover === null ? 50 : hover;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        onHoverChange(Math.min(100, cur + step));
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        onHoverChange(Math.max(0, cur - step));
      }
    },
    [committed, hover, onCommit, onNext, onHoverChange, onOpenExplain]
  );

  // ── Derived values (post-commit) ──────────────────────────────────────────

  const delta = committed ? Math.abs(guess! - trueTotal) : 0;

  // Label push-apart: when |guess - total| < 9, push both labels outward from
  // their midpoint so the 9-point gap is maintained.
  // guessLabel = min(guess, total) − (9 − delta) / 2   clamped 0–100
  // trueLabel  = max(guess, total) + (9 − delta) / 2   clamped 0–100
  let guessLabelLeft = committed ? guess! : 0;
  let trueLabelLeft = committed ? trueTotal : 0;
  if (committed && delta < 9) {
    const lo = Math.min(guess!, trueTotal);
    const hi = Math.max(guess!, trueTotal);
    const push = (9 - delta) / 2;
    guessLabelLeft = Math.max(0, lo - push);
    trueLabelLeft = Math.min(100, hi + push);
  }

  const gapLeft = committed ? Math.min(guess!, trueTotal) : 0;
  const gapWidth = committed ? delta : 0;

  const showHover = !committed && hover !== null;

  return (
    <div className={styles.wrapper}>
      {/* Label strip (26px) */}
      <div className={styles.labelStrip}>
        {committed && (
          <>
            <span
              className={styles.labelYou}
              style={{ left: `${guessLabelLeft}%` }}
            >
              You
            </span>
            <span
              className={styles.labelActual}
              style={{ left: `${trueLabelLeft}%` }}
            >
              Actual
            </span>
          </>
        )}
        {showHover && (
          <span
            className={styles.hoverPct}
            style={{ left: `${hover}%` }}
          >
            {hover}%
          </span>
        )}
      </div>

      {/* The rail itself */}
      <div
        className={styles.rail}
        tabIndex={0}
        role="slider"
        aria-valuenow={committed ? guess! : (hover ?? 50)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
      >
        {/* Tick marks */}
        <div className={styles.tick25} />
        <div className={styles.tick50} />
        <div className={styles.tick75} />

        {/* Accent fill (0 → guess) */}
        {committed && (
          <div
            className={styles.accentFill}
            style={{ width: `${guess}%` }}
          />
        )}

        {/* Hover ghost line */}
        {showHover && (
          <div
            className={styles.hoverLine}
            style={{ left: `${hover}%` }}
          />
        )}

        {/* Committed overlays */}
        {committed && (
          <>
            {/* Guess mark */}
            <div
              className={styles.guessMark}
              style={{ left: `${guess}%` }}
            />
            {/* True mark */}
            <div
              className={styles.trueMark}
              style={{ left: `${trueTotal}%` }}
            />
            {/* Error gap bar */}
            <div
              className={styles.gapBar}
              style={{
                left: `${gapLeft}%`,
                width: `${gapWidth}%`,
                background: bandColor,
              }}
            />
          </>
        )}
      </div>

      {/* Scale */}
      <div className={styles.scale}>
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
