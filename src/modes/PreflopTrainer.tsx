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
 *  - J = Open / Jam (when uncommitted — the label depends on stack depth,
 *    the key does not)
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
 *  - depth: which stack tier to drill (40bb+ / 20bb / 10bb). At 10bb the
 *    aggressive action is a jam, not an open; the decision is still binary, so
 *    only the wording changes. App remounts this component on a depth change
 *    (via `key`), which re-deals and re-opens the briefing for the new tier.
 *  - onRecord(wasCorrect): called exactly once per commit to record the result
 *    in the preflop stats hook lifted to App root. The double-record guard is
 *    the committedRef check in handleCommit (already committed → early return).
 *  - keysSuspended: true while an App-level overlay (the menu's range-chart
 *    browser) is on top, so game keys do not fire behind it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { dealPreflopSpot, type PreflopSpot } from '../lib/preflop/deal';
import { DEFAULT_DEPTH, DEPTH_META, type Depth } from '../lib/preflop/ranges';
import PreflopTable from '../components/PreflopTable';
import RangeSheet from '../components/RangeSheet';
import PreflopInfoSheet from '../components/PreflopInfoSheet';
import styles from './PreflopTrainer.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type CommittedAction = 'open' | 'fold';

interface PreflopTrainerProps {
  /** Stack tier to drill. Default: the 40bb+ chart. */
  depth?: Depth;
  /** Called once per committed hand with true = correct, false = wrong. */
  onRecord: (wasCorrect: boolean) => void;
  /** True while an overlay owned by App is open — all game keys go inert. */
  keysSuspended?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PreflopTrainer({
  depth = DEFAULT_DEPTH,
  onRecord,
  keysSuspended = false,
}: PreflopTrainerProps) {
  const meta = DEPTH_META[depth];

  // Current spot — initialised on mount via lazy initialiser
  const [spot, setSpot] = useState<PreflopSpot>(() => dealPreflopSpot({ depth }));

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
    setSpot(dealPreflopSpot({ depth }));
    setCommitted(null);
    setRangeOpen(false);
  }, [depth]);

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
      // An App-level overlay owns the keyboard while it is open.
      if (keysSuspended) return;

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
  }, [handleCommit, handleNext, openInfo, openRange, rangeOpen, infoOpen, keysSuspended]);

  // ── Render ───────────────────────────────────────────────────────────────

  const isCommitted = committed !== null;

  // Verdict copy — only defined after commit
  const wasCorrect = isCommitted ? committed === spot.correct : null;
  // 'open' is the data layer's word for the aggressive action at every tier;
  // at 10bb the player knows it as a jam, so read the verb off the tier.
  const correctWord = spot.correct === 'open' ? meta.action : 'fold';
  const correctNoun = spot.correct === 'open' ? meta.actionNoun : 'a fold';
  const verdictText = isCommitted
    ? wasCorrect
      ? `Correct — ${correctWord}`
      : `Wrong — this is ${correctNoun}`
    : null;

  return (
    <>
      {/* Felt — shows position, seats, hero cards */}
      <PreflopTable hero={spot.cards} position={spot.position} depth={depth} />

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
                Action folds to you. {meta.prompt}
                <span className={styles.promptHint}>
                  Keys: F = Fold · J = {meta.actionLabel}
                </span>
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
                  {meta.actionLabel}
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
          key={`${depth}:${spot.position}`}
          position={spot.position}
          depth={depth}
          heroPosition={spot.position}
          highlight={spot.handClass}
          onClose={() => setRangeOpen(false)}
        />
      )}

      {/* Situation info sheet — open on mount, re-openable via Info / I */}
      {infoOpen && (
        <PreflopInfoSheet depth={depth} onClose={() => setInfoOpen(false)} />
      )}
    </>
  );
}
