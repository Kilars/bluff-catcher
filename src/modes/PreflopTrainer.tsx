/**
 * PreflopTrainer — the desktop view of the preflop RFI drill.
 *
 * Presentation only. The spot, the committed state, the two sheets, the
 * double-record guard, the keyboard bindings and the verdict copy all live in
 * `hooks/usePreflopDrill` — see `DECISIONS.md`, "two trees, one behaviour".
 *
 * Props:
 *  - depth: which stack tier to drill (60bb+ / 20bb / 10bb). At 10bb the
 *    aggressive action is a jam, not an open; the decision is still binary, so
 *    only the wording changes. App remounts this component on a depth change
 *    (via `key`), which re-deals and re-opens the briefing for the new tier.
 *  - onRecord(wasCorrect): called exactly once per commit to record the result
 *    in the preflop stats hook lifted to App root.
 *  - keysSuspended: true while an App-level overlay (the menu's range-chart
 *    browser) is on top, so game keys do not fire behind it.
 */

import PreflopTable from '../components/PreflopTable';
import RangeSheet from '../components/RangeSheet';
import PreflopInfoSheet from '../components/PreflopInfoSheet';
import { usePreflopDrill } from '../hooks/usePreflopDrill';
import { useLayoutMode } from '../hooks/useLayoutMode';
import PhonePreflopTrainer from './phone/PhonePreflopTrainer';
import PhoneSheet from '../components/phone/PhoneSheet';
import PhoneRangeView from '../components/phone/range/PhoneRangeView';
import { DEFAULT_DEPTH, type Depth } from '../lib/preflop/ranges';
import styles from './PreflopTrainer.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PreflopTrainerProps {
  /** Stack tier to drill. Default: the 60bb+ chart. */
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
  const layout = useLayoutMode();
  const drill = usePreflopDrill({
    depth,
    onRecord,
    keysSuspended,
    briefOncePerTier: layout === 'phone',
  });

  const {
    meta,
    spot,
    rangeOpen,
    infoOpen,
    isCommitted,
    wasCorrect,
    verdictText,
    handleCommit,
    handleNext,
    openInfo,
    openRange,
    closeInfo,
    closeRange,
  } = drill;

  // ── Render ───────────────────────────────────────────────────────────────
  // The hook above is the whole behaviour. Below it the trees part company:
  // desktop draws the nine-seat felt, phone draws a 44px seat ladder instead,
  // because the felt spent 188px delivering five facts at 6.9 effective px and
  // position is ordinal, not spatial. See docs/PLAN-phone.md §5.2.
  //
  // The range view is the seam between the two phone agents' work: the trainer
  // says *when* a chart is open (rangeOpen, off the hook), and this is where
  // *what* gets mounted — wrapped in the shared full-screen sheet, with the
  // tier fixed to what the drill is testing rather than switchable, so the
  // chart on screen can never disagree with the hand being drilled.

  if (layout === 'phone') {
    return (
      <PhonePreflopTrainer
        {...drill}
        renderRange={() => (
          <PhoneSheet
            title={`${spot.position} · ${meta.label}`}
            onClose={closeRange}
          >
            <PhoneRangeView
              position={spot.position}
              depth={depth}
              highlight={spot.handClass}
              heroPosition={spot.position}
            />
          </PhoneSheet>
        )}
        renderInfo={() => (
          <PreflopInfoSheet depth={depth} onClose={closeInfo} />
        )}
      />
    );
  }

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
          onClose={closeRange}
        />
      )}

      {/* Situation info sheet — open on mount, re-openable via Info / I */}
      {infoOpen && (
        <PreflopInfoSheet depth={depth} onClose={closeInfo} />
      )}
    </>
  );
}
