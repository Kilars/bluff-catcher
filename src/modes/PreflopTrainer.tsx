/**
 * PreflopTrainer — Preflop RFI trainer mode.
 *
 * Owns spot state:
 *  - Calls dealPreflopSpot() on mount and on "next" to get a new spot.
 *  - Tracks committed state: null (awaiting input) | 'open' | 'fold'.
 *  - Commit locks buttons + keys until the user advances to the next spot.
 *
 * Keyboard bindings:
 *  - F = Fold (when uncommitted)
 *  - J = Open (when uncommitted)
 *  - Space / Enter = Next hand (when committed)
 *  - R = Range grid (when committed)
 *  - I = Situation info sheet (always)
 *  - Escape = close whichever sheet is open
 *
 * The situation info sheet opens on every mount so the player always knows the
 * scenario they are being drilled on. While a sheet is open the game keys are
 * inert.
 *
 * Props:
 *  - onRecord(wasCorrect): called exactly once per commit to record the result
 *    in the preflop stats hook lifted to App root. The double-record guard is
 *    the committedRef check in handleCommit (already committed → early return).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { dealPreflopSpot, type PreflopSpot } from '../lib/preflop/deal';
import PreflopTable from '../components/PreflopTable';
import RangeSheet from '../components/RangeSheet';
import PreflopInfoSheet from '../components/PreflopInfoSheet';
import styles from './PreflopTrainer.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type CommittedAction = 'open' | 'fold';

interface PreflopTrainerProps {
  /** Called once per committed hand with true = correct, false = wrong. */
  onRecord: (wasCorrect: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PreflopTrainer({ onRecord }: PreflopTrainerProps) {
  // Current spot — initialised on mount via lazy initialiser
  const [spot, setSpot] = useState<PreflopSpot>(() => dealPreflopSpot());

  // null = waiting for input; 'open'|'fold' = committed
  const [committed, setCommitted] = useState<CommittedAction | null>(null);

  // Range sheet open/close state — only available after commit
  const [rangeOpen, setRangeOpen] = useState(false);

  // Situation info sheet — open on mount, every mount (no persistence).
  const [infoOpen, setInfoOpen] = useState(true);

  // Ref so keyboard handler always sees up-to-date committed value
  const committedRef = useRef<CommittedAction | null>(null);
  committedRef.current = committed;

  // Keep a stable ref to the current spot so handleCommit closure can read it
  const spotRef = useRef<PreflopSpot>(spot);
  spotRef.current = spot;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCommit = useCallback((action: CommittedAction) => {
    // Double-record guard: if already committed, do nothing.
    if (committedRef.current !== null) return;

    setCommitted(action);

    // Compute verdict against the current spot and record the result once.
    const wasCorrect = action === spotRef.current.correct;
    onRecord(wasCorrect);
  }, [onRecord]);

  const handleNext = useCallback(() => {
    setSpot(dealPreflopSpot());
    setCommitted(null);
    setRangeOpen(false);
  }, []);

  // Only one sheet at a time — opening one closes the other.
  const openInfo = useCallback(() => {
    setRangeOpen(false);
    setInfoOpen(true);
  }, []);

  const openRange = useCallback(() => {
    setInfoOpen(false);
    setRangeOpen(true);
  }, []);

  // ── Keyboard handler ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when a modifier is held or when the event comes from an input
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.repeat) return;

      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Escape closes whichever sheet is open
      if (e.key === 'Escape') {
        if (infoOpen) {
          e.preventDefault();
          setInfoOpen(false);
        } else if (rangeOpen) {
          e.preventDefault();
          setRangeOpen(false);
        }
        return;
      }

      // Don't handle game keys while a sheet is open
      if (rangeOpen || infoOpen) return;

      // I opens the situation info sheet, committed or not
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        openInfo();
        return;
      }

      const current = committedRef.current;

      if (current === null) {
        // Awaiting input
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          handleCommit('fold');
        } else if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          handleCommit('open');
        }
      } else {
        // Already committed — advance to next hand or open range with R
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          openRange();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCommit, handleNext, openInfo, openRange, rangeOpen, infoOpen]);

  // ── Render ───────────────────────────────────────────────────────────────

  const isCommitted = committed !== null;

  // Verdict copy — only defined after commit
  const wasCorrect = isCommitted ? committed === spot.correct : null;
  const verdictText = isCommitted
    ? wasCorrect
      ? `Correct — ${spot.correct}`
      : `Wrong — this is ${spot.correct === 'open' ? 'an open' : 'a fold'}`
    : null;

  return (
    <>
      {/* Felt — shows position, seats, hero cards */}
      <PreflopTable hero={spot.cards} position={spot.position} />

      {/* Controls dock */}
      <div className={styles.dock}>
        {/* Left column — hand class label + situation info (both states) */}
        <div className={styles.left}>
          <div className={styles.leftText}>
            <span className={styles.kicker}>Your hand</span>
            <span className={styles.handClass}>{spot.handClass}</span>
          </div>
          <button
            type="button"
            className={styles.btnInfo}
            onClick={openInfo}
          >
            <span className={styles.keyHint}>I</span>
            Info
          </button>
        </div>

        {/* Right column — prompt or post-commit affordance */}
        <div className={styles.right}>
          {!isCommitted ? (
            <>
              <p className={styles.prompt}>
                Action folds to you. Open or fold?
                <span className={styles.promptHint}>Keys: F = Fold · J = Open</span>
              </p>
              <div className={styles.buttons}>
                <button
                  type="button"
                  className={styles.btnFold}
                  onClick={() => handleCommit('fold')}
                  disabled={isCommitted}
                >
                  <span className={styles.keyHint}>F</span>
                  Fold
                </button>
                <button
                  type="button"
                  className={styles.btnOpen}
                  onClick={() => handleCommit('open')}
                  disabled={isCommitted}
                >
                  <span className={styles.keyHint}>J</span>
                  Open
                </button>
              </div>
            </>
          ) : (
            <div className={styles.postCommit}>
              <span
                className={
                  wasCorrect ? styles.verdictCorrect : styles.verdictWrong
                }
              >
                {verdictText}
              </span>
              <div className={styles.postCommitActions}>
                <button
                  type="button"
                  className={styles.btnRange}
                  onClick={openRange}
                >
                  <span className={styles.keyHint}>R</span>
                  Range
                </button>
                <button
                  type="button"
                  className={styles.btnNext}
                  onClick={handleNext}
                >
                  Next hand → <span style={{ fontSize: '11px', opacity: 0.6, marginLeft: 4 }}>Space</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Range sheet — rendered only after commit, when rangeOpen is true */}
      {rangeOpen && (
        <RangeSheet
          position={spot.position}
          highlight={spot.handClass}
          onClose={() => setRangeOpen(false)}
        />
      )}

      {/* Situation info sheet — open on mount, re-openable via Info / I */}
      {infoOpen && <PreflopInfoSheet onClose={() => setInfoOpen(false)} />}
    </>
  );
}
