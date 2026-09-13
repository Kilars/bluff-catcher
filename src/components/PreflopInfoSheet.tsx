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
 * The copy is depth-aware: the 60bb+ and 20bb tiers brief an open-or-fold
 * decision, the 10bb tier briefs a jam-or-fold one. The per-tier wording lives
 * in DEPTH_BRIEF below, next to the layout that renders it, rather than in the
 * range data — it is presentation, not poker.
 *
 * Props:
 *   depth   — the tier being drilled.
 *   onClose — called when the sheet should close.
 */

import { DEFAULT_DEPTH, DEPTH_META, type Depth } from '../lib/preflop/ranges';
import styles from './ExplainSheet.module.css';
import { useLayoutMode } from '../hooks/useLayoutMode';

// ─── Per-tier briefing copy ───────────────────────────────────────────────────

interface DepthBrief {
  /** Sheet title. */
  title: string;
  /** Step 01 — the table. */
  table: string;
  /** Step 03 — the decision. */
  decision: string;
  /** Step 04 — the thing this tier specifically teaches. */
  lessonTitle: string;
  lesson: string;
}

const DEPTH_BRIEF: Record<Depth, DepthBrief> = {
  deep: {
    title: 'Open or fold, first in',
    table:
      '9-handed tournament, 60 big blinds. Hand selection barely moves between 40bb and 100bb, so this one chart covers all of it.',
    decision:
      'Open-raise to ~2.2–2.5bb, or fold. No limping — those are the only two options.',
    lessonTitle: 'Why position matters',
    lesson:
      'The earlier you sit, the more players act behind you, so the tighter you open. UTG is the tightest; the button has only the blinds left and opens widest.',
  },
  mid: {
    title: 'Open or fold, first in',
    table:
      '9-handed tournament, 20 big blinds. Deep enough to raise and fold, too shallow to win a big pot after the flop.',
    decision:
      'Open-raise to ~2bb, or fold. You can still fold to a re-raise — that changes at 10bb.',
    lessonTitle: 'What changes at 20bb',
    lesson:
      'Implied odds are gone: 65s has no stack left to win, so hands like that come out and suited kings and offsuit broadways go in. The surprise is where the range shrinks. UTG barely moves — it was never opening for implied odds. The button drops seven points, because its widest hands were only ever profitable for the position it had after the flop, and there is no meaningful after-the-flop left.',
  },
  short: {
    title: 'Jam or fold, first in',
    table:
      '9-handed tournament, 10 big blinds. A normal raise would commit a third of your stack, so raising and folding is no longer a real option.',
    decision:
      'Shove all-in, or fold. Nothing in between — if the hand is worth playing, it is worth all 10bb.',
    lessonTitle: 'What changes at 10bb',
    lesson:
      'You win two ways: everyone folds, or you get called and win a showdown. So every pocket pair and every suited ace jams from every seat, while small suited connectors stay out until late position — they are the worst hands to be called by. Note the ranges are about as wide as the 60bb+ ones, not wider: fold equity buys the bottom of the range, and being unable to fold to a re-raise sells the top back. Different hands, similar count.',
  },
};

interface PreflopInfoSheetProps {
  depth?: Depth;
  onClose: () => void;
}

export default function PreflopInfoSheet({
  depth = DEFAULT_DEPTH,
  onClose,
}: PreflopInfoSheetProps) {
  const meta = DEPTH_META[depth];
  const brief = DEPTH_BRIEF[depth];
  const layout = useLayoutMode();

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <>
      {/* Backdrop — reuses ExplainSheet backdrop class for identical styling */}
      <div className={styles.backdrop} onClick={handleBackdropClick} />

      {/* Sheet — a centred dialog on desktop (the briefing is short, and a
          full-height panel left the bottom half of the screen empty); the
          phone media query turns it back into the usual full-height sheet. */}
      <div className={`${styles.sheet} ${styles.sheetCentered}`}>
        <div className={styles.sheetInner}>
          {/* Header */}
          <div className={styles.sheetHeader}>
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>The situation</span>
              <h1 className={styles.headerTitle}>{brief.title}</h1>
              <p className={styles.headerSubline}>
                9-handed tournament table · {meta.label} effective
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
                  <p className={styles.stepBody}>{brief.table}</p>
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
                  <p className={styles.stepBody}>{brief.decision}</p>
                </div>
              </div>

              <div className={styles.step}>
                <span className={styles.stepIndex}>04</span>
                <div className={styles.stepContent}>
                  <h2 className={styles.stepTitle}>{brief.lessonTitle}</h2>
                  <p className={styles.stepBody}>{brief.lesson}</p>
                </div>
              </div>
            </div>

            {/* Right: key hints — desktop only. A phone has no keyboard, so
                listing F/J/Space/R/I there is instructions for hardware the
                reader does not have. */}
            {layout !== 'phone' && (
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
                    <span className={styles.memoriseValue}>{meta.actionLabel}</span>
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
            )}
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
