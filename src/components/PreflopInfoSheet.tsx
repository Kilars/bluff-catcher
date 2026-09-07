/**
 * PreflopInfoSheet — sheet overlay explaining the drill: what the situation is,
 * what the decision is, and which keys do what.
 *
 * Reuses ExplainSheet's CSS module (backdrop, sheet, sheetInner, sheetHeader,
 * closeBtn, divider, step, footer, btnAccent) without forking the animation.
 *
 * Opens with the same riseSheet animation (220ms) defined in ExplainSheet.module.css.
 * Closes via backdrop click, × button, or Escape (Esc handled by parent).
 *
 * Props:
 *   onClose — called when the sheet should close.
 */

import styles from './ExplainSheet.module.css';

interface PreflopInfoSheetProps {
  onClose: () => void;
}

export default function PreflopInfoSheet({ onClose }: PreflopInfoSheetProps) {
  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <>
      {/* Backdrop — reuses ExplainSheet backdrop class for identical styling */}
      <div className={styles.backdrop} onClick={handleBackdropClick} />

      {/* Sheet — top:0 (full-screen) so the whole briefing fits without scrolling */}
      <div className={styles.sheet} style={{ top: '0px' }}>
        <div className={styles.sheetInner} style={{ borderRadius: '0px' }}>
          {/* Header */}
          <div className={styles.sheetHeader}>
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>The situation</span>
              <h1 className={styles.headerTitle}>Open or fold, first in</h1>
              <p className={styles.headerSubline}>
                9-handed tournament table · ~60bb effective
              </p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close situation info"
            >
              ×
            </button>
          </div>

          {/* Divider */}
          <div className={styles.divider} />

          {/* Body — numbered steps, same shape as ExplainSheet */}
          <div className={styles.body}>
            <div className={styles.leftCol}>
              <div className={styles.step}>
                <span className={styles.stepIndex}>01</span>
                <div className={styles.stepContent}>
                  <h2 className={styles.stepTitle}>The table</h2>
                  <p className={styles.stepBody}>
                    9-handed tournament, ~60 big blinds effective. You get a seat
                    and two cards.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <span className={styles.stepIndex}>02</span>
                <div className={styles.stepContent}>
                  <h2 className={styles.stepTitle}>The action</h2>
                  <p className={styles.stepBody}>
                    Everyone before you has folded — you are first in. Only the
                    blinds and the seats behind you are left.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <span className={styles.stepIndex}>03</span>
                <div className={styles.stepContent}>
                  <h2 className={styles.stepTitle}>Your decision</h2>
                  <p className={styles.stepBody}>
                    Open-raise to ~2.2–2.5bb, or fold. No limping — those are the
                    only two options.
                  </p>
                </div>
              </div>

              <div className={styles.step}>
                <span className={styles.stepIndex}>04</span>
                <div className={styles.stepContent}>
                  <h2 className={styles.stepTitle}>Why position matters</h2>
                  <p className={styles.stepBody}>
                    The earlier you sit, the more players act behind you, so the
                    tighter you open. UTG is the tightest; the button has only
                    the blinds left and opens widest.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: key hints */}
            <div className={styles.rightCol}>
              <div className={styles.memoriseCard}>
                <span className={styles.memoriseKicker}>Keys</span>
                <div className={styles.memoriseGrid}>
                  <div className={styles.memoriseRow}>
                    <span>F</span>
                    <span className={styles.memoriseValue}>Fold</span>
                  </div>
                  <div className={styles.memoriseRow}>
                    <span>J</span>
                    <span className={styles.memoriseValue}>Open</span>
                  </div>
                  <div className={styles.memoriseRow}>
                    <span>Space</span>
                    <span className={styles.memoriseValue}>Next hand</span>
                  </div>
                  <div className={styles.memoriseRow}>
                    <span>R</span>
                    <span className={styles.memoriseValue}>Range grid</span>
                  </div>
                  <div className={styles.memoriseRow}>
                    <span>I</span>
                    <span className={styles.memoriseValue}>This page</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button type="button" className={styles.btnAccent} onClick={onClose}>
              Start drilling
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
