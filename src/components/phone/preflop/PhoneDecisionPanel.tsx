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
 *
 * ── Three-action variant (PLAN-3bet F2) ────────────────────────────────────
 * The facing-open drill has a third action (3-bet, alongside fold and call), so
 * the pre-commit row can no longer be a hardcoded Fold / {actionLabel} pair.
 * Pass `actions` — an ordered list of `{ action, label, hint?, tone? }` — to
 * render N buttons instead of two; omit it and this renders exactly as before.
 * `onCommit` is typed against the same action union as `actions`, defaulting to
 * `CommittedAction` (the RFI drill's `'fold' | 'open'`) so the two-button call
 * sites need no changes at all.
 */

import { useEffect, useState } from 'react';
import type { CommittedAction } from '../../../hooks/usePreflopDrill';
import styles from './PhoneDecisionPanel.module.css';

/** How long "Next hand" stays inert after a commit. */
export const NEXT_LOCK_MS = 300;

/** Visual treatment for a decision button. Defaults to 'primary'. */
export type DecisionButtonTone = 'fold' | 'primary' | 'call' | 'raise';

export interface DecisionButtonConfig<T extends string> {
  action: T;
  label: string;
  /** Optional key-hint badge, e.g. "F" — shown only when given. */
  hint?: string;
  tone?: DecisionButtonTone;
}

export interface PhoneDecisionPanelProps<T extends string = CommittedAction> {
  /** Has the player answered this spot yet? */
  isCommitted: boolean;
  /** True / false once committed, null before. */
  wasCorrect: boolean | null;
  /** "Correct — open" / "Wrong — this is a fold". From the drill hook. */
  verdictText: string | null;
  /** Pre-commit question, e.g. "Open or fold?" (tier-dependent). */
  prompt: string;
  /** Label of the aggressive action at this tier: "Open" or "Jam". Used only
   *  for the default two-button row (i.e. when `actions` is not given). */
  actionLabel: string;
  /** Post-commit boundary sentence, 15px, e.g. "HJ opens A2s+ suited". */
  boundaryText: string;
  onCommit: (action: T) => void;
  onNext: () => void;
  onOpenRange: () => void;
  /**
   * Overrides the pre-commit button row. Defaults to `[Fold, {actionLabel}]`
   * (the RFI two-button row) when omitted — existing callers are unaffected.
   * The facing-open drill passes three: Fold / Call / 3-bet with F / J / K hints.
   */
  actions?: DecisionButtonConfig<T>[];
}

function toneClass(tone: DecisionButtonTone | undefined): string {
  switch (tone) {
    case 'call':
      return styles.btnCall;
    case 'raise':
      return styles.btnRaise;
    case 'fold':
      return styles.btnFold;
    default:
      return styles.btnOpen;
  }
}

export default function PhoneDecisionPanel<T extends string = CommittedAction>({
  isCommitted,
  wasCorrect,
  verdictText,
  prompt,
  actionLabel,
  boundaryText,
  onCommit,
  onNext,
  onOpenRange,
  actions,
}: PhoneDecisionPanelProps<T>) {
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

  const buttons: DecisionButtonConfig<T>[] =
    actions ??
    ([
      { action: 'fold' as T, label: 'Fold', tone: 'fold' },
      { action: 'open' as T, label: actionLabel, tone: 'primary' },
    ] as DecisionButtonConfig<T>[]);

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
            {buttons.map((btn) => (
              <button
                key={btn.action}
                type="button"
                className={`${styles.thumbBtn} ${toneClass(btn.tone)}`}
                onClick={() => onCommit(btn.action)}
                data-testid={`decision-${btn.action}`}
              >
                {btn.hint && (
                  <span className={styles.keyHint} aria-hidden="true">
                    {btn.hint}
                  </span>
                )}
                {btn.label}
              </button>
            ))}
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
