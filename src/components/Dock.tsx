/**
 * Dock — bottom 226px band.
 * Left column: draw read (hidden until commit) + ? button.
 * Right column: question → result + buttons, plus the GuessRail.
 */

import GuessRail from './GuessRail';
import styles from './Dock.module.css';

type Band = 'green' | 'amber' | 'red';

const BAND_COLOR: Record<Band, string> = {
  green: 'var(--band-green)',
  amber: 'var(--band-amber)',
  red: 'var(--band-red)',
};

const BAND_LABEL: Record<Band, string> = {
  green: 'On the money',
  amber: 'Close',
  red: 'Off',
};

interface DockProps {
  guess: number | null;
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
                What is the percentage chance you improve by the river?
              </p>
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

        {/* Guess rail */}
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
  );
}
