/**
 * Dock — bottom 226px band.
 * Left column: the draw read + ? button.
 * Right column: question → result + buttons, plus the GuessRail.
 *
 * The left column has three states, not two. With `showDraw` on (the default)
 * the draw is **named before the guess**, in a muted preview, so you know which
 * outs you are being asked to price — the note and the [?] still wait for the
 * commit, because those are the answer. With `showDraw` off the old behaviour
 * is back: an em dash until you commit, and identifying the draw is part of the
 * task. See DECISIONS.md, "Naming the draw".
 */

import GuessRail from './GuessRail';
import { BAND_COLOR, BAND_LABEL, type Band } from '../lib/band';
import styles from './Dock.module.css';

interface DockProps {
  guess: number | null;
  /** Name the draw before the commit. Default behaviour; off is the hard mode. */
  showDraw: boolean;
  hover: number | null;
  trueTotal: number;
  drawName: string;
  drawNote: string;
  band: Band | null;
  delta: number;
  onCommit: (pct: number) => void;
  onNext: () => void;
  onHoverChange: (pct: number | null) => void;
  onOpenExplain: () => void;
}

export default function Dock({
  guess,
  showDraw,
  hover,
  trueTotal,
  drawName,
  drawNote,
  band,
  delta,
  onCommit,
  onNext,
  onHoverChange,
  onOpenExplain,
}: DockProps) {
  const committed = guess !== null;
  const bandColor = band ? BAND_COLOR[band] : 'var(--band-green)';

  return (
    <div className={styles.dock}>
      {/* ── Left column ── */}
      <div className={styles.left}>
        <span className={styles.kicker}>You&rsquo;re drawing to</span>

        {committed ? (
          <div className={styles.drawRevealed}>
            <div className={styles.drawNameRow}>
              <h2 className={styles.drawName}>{drawName}</h2>
              <button
                type="button"
                className={styles.questionBtn}
                onClick={onOpenExplain}
                title="How is this counted?"
              >
                ?
              </button>
            </div>
            <p className={styles.drawNote}>{drawNote}</p>
          </div>
        ) : showDraw ? (
          <div className={styles.drawPreview} data-testid="dock-draw-preview">
            <h2 className={styles.drawNamePreview}>{drawName}</h2>
            <p className={styles.drawPreviewHint}>
              Now price it — the outs are yours to count.
            </p>
          </div>
        ) : (
          <div className={styles.drawPlaceholder}>
            <span className={styles.dashPlaceholder}>—</span>
          </div>
        )}
      </div>

      {/* ── Right column ── */}
      <div className={styles.right}>
        <div className={styles.topRow}>
          {/* Before commit: question */}
          {!committed && (
            <div className={styles.questionLine}>
              <p className={styles.questionText}>
                What is the percentage chance you significantly improve by the river?
              </p>
              <span className={styles.questionHint}>(ignore backdoors)</span>
            </div>
          )}

          {/* After commit: result blocks */}
          {committed && band && (
            <div className={styles.resultRow}>
              <div className={styles.resultBlock}>
                <span className={`${styles.resultKicker} ${styles.resultKickerAccent}`}>
                  You said
                </span>
                <div className={styles.resultValueRow}>
                  <span className={styles.resultValueAccent}>{guess}</span>
                  <span className={styles.resultPct}>%</span>
                </div>
              </div>

              <div className={styles.resultBlock}>
                <span className={`${styles.resultKicker} ${styles.resultKickerNeutral}`}>
                  Actual
                </span>
                <div className={styles.resultValueRow}>
                  <span className={styles.resultValueNeutral}>
                    {trueTotal.toFixed(1)}
                  </span>
                  <span className={styles.resultPct}>%</span>
                </div>
              </div>

              <div className={styles.bandBlock}>
                <span
                  className={styles.bandPill}
                  style={{ color: bandColor, boxShadow: `inset 0 0 0 1px ${bandColor}` }}
                >
                  {BAND_LABEL[band]}
                </span>
                <span className={styles.bandDelta}>
                  off by {delta.toFixed(1)} points
                </span>
              </div>
            </div>
          )}

          {/* Buttons (only after commit) */}
          {committed && (
            <div className={styles.buttons}>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={onOpenExplain}
              >
                How it&apos;s counted
              </button>
              <button
                type="button"
                className={styles.btnAccent}
                onClick={onNext}
              >
                Next hand →
              </button>
            </div>
          )}
        </div>

        {/* Guess rail — wrapped so the phone media query can pin it via
             margin-top:auto on .railWrapper, pushing it to the thumb zone */}
        <div className={styles.railWrapper}>
          <GuessRail
            guess={guess}
            hover={hover}
            trueTotal={trueTotal}
            bandColor={bandColor}
            onCommit={onCommit}
            onNext={onNext}
            onHoverChange={onHoverChange}
            onOpenExplain={onOpenExplain}
          />
        </div>
      </div>
    </div>
  );
}
