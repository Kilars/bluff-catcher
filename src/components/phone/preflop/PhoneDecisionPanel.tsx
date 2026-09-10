/**
 * PhoneDecisionPanel — the feedback slot and the thumb row. PLAN-phone §5.2.
 *
 *   feedback slot   140px   FIXED in both states
 *                             asking:   the prompt, 19px
 *                             answered: verdict 22px + boundary 15px + [See range]
 *   flex spacer      ~209px  the budget's slack, so the thumb row sits low
 *   thumb row         64px   [ Fold ] [ Open ]  gap 12  |  post: [ Next hand → ]
 *
 * Two things here are safety, not decoration:
 *
 * 1. **The slot is height-fixed in both states.** Asking and answering put very
 *    different amounts of text in it; if the box grew, everything below it —
 *    including the buttons under the player's thumb — would move between the
 *    tap and the read.
 *
 * 2. **The 300ms input lock.** Post-commit, "Next hand" lands under the finger
 *    that just pressed "Open". A double tap, or the second half of a
 *    fat-fingered one, would burn a fresh spot the player never saw. The lock
 *    is set *during the render that first shows the button* (not in an effect
 *    after paint), so there is no frame in which the button is live. The button
 *    also takes the **full width**, so it is a different shape and not just a
 *    different label under the same finger.
 *
 * Presentation only: the commit itself, its double-record guard and the verdict
 * copy all live in `usePreflopDrill`. This component decides when a tap is
 * *plausible*, never what it means.
 */

import { useEffect, useState } from 'react';
import type { CommittedAction } from '../../../hooks/usePreflopDrill';
import styles from './PhoneDecisionPanel.module.css';

/** How long "Next hand" stays inert after a commit. */
export const NEXT_LOCK_MS = 300;

export interface PhoneDecisionPanelProps {
  /** Has the player answered this spot yet? */
  isCommitted: boolean;
  /** True / false once committed, null before. */
  wasCorrect: boolean | null;
  /** "Correct — open" / "Wrong — this is a fold". From the drill hook. */
  verdictText: string | null;
  /** Pre-commit question, e.g. "Open or fold?" (tier-dependent). */
  prompt: string;
  /** Label of the aggressive action at this tier: "Open" or "Jam". */
  actionLabel: string;
  /** Post-commit boundary sentence, 15px, e.g. "HJ opens A2s+ suited". */
  boundaryText: string;
  onCommit: (action: CommittedAction) => void;
  onNext: () => void;
  onOpenRange: () => void;
}

export default function PhoneDecisionPanel({
  isCommitted,
  wasCorrect,
  verdictText,
  prompt,
  actionLabel,
  boundaryText,
  onCommit,
  onNext,
  onOpenRange,
}: PhoneDecisionPanelProps) {
  // ── The input lock ───────────────────────────────────────────────────────
  // Derived during render on the commit edge: the first render that shows
  // "Next hand" already has it disabled. An effect would set the flag after
  // paint, which is exactly the window a double tap lives in.
  const [lockedFor, setLockedFor] = useState<boolean | null>(null);
  const [wasAnswered, setWasAnswered] = useState(isCommitted);

  if (wasAnswered !== isCommitted) {
    setWasAnswered(isCommitted);
    setLockedFor(isCommitted ? true : null);
  }

  const locked = lockedFor === true;

  useEffect(() => {
    if (!locked) return;
    const timer = setTimeout(() => setLockedFor(false), NEXT_LOCK_MS);
    return () => clearTimeout(timer);
  }, [locked]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.panel}>
      <div
        className={styles.feedback}
        data-testid="feedback-slot"
        data-state={isCommitted ? 'answered' : 'asking'}
        aria-live="polite"
      >
        {!isCommitted ? (
          <p className={styles.prompt}>{prompt}</p>
        ) : (
          <>
            <p
              className={styles.verdict}
              data-correct={wasCorrect ? 'true' : 'false'}
              data-testid="verdict"
            >
              {verdictText}
            </p>
            <p className={styles.boundary} data-testid="boundary">
              {boundaryText}
            </p>
            <button
              type="button"
              className={styles.rangeChip}
              onClick={onOpenRange}
            >
              <span className={styles.rangeChipFace}>See range</span>
            </button>
          </>
        )}
      </div>

      <div className={styles.spacer} />

      <div className={styles.thumbRow} data-testid="thumb-row">
        {!isCommitted ? (
          <>
            <button
              type="button"
              className={`${styles.thumbBtn} ${styles.btnFold}`}
              onClick={() => onCommit('fold')}
            >
              Fold
            </button>
            <button
              type="button"
              className={`${styles.thumbBtn} ${styles.btnOpen}`}
              onClick={() => onCommit('open')}
            >
              {actionLabel}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${styles.thumbBtn} ${styles.btnNext}`}
            onClick={onNext}
            disabled={locked}
            data-locked={locked ? 'true' : 'false'}
            data-testid="next-hand"
          >
            Next hand →
          </button>
        )}
      </div>
    </div>
  );
}
