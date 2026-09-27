/**
 * FacingTrainer — the facing-open drill: someone opens, it folds to hero on
 * the button, and hero chooses Fold / Call / 3-bet. See docs/PLAN-3bet.md.
 *
 * Presentation only, in the same split as PreflopTrainer: the spot, commit,
 * sheets, keys and verdict copy all live in `hooks/useFacingDrill`, and this
 * file picks the tree — the nine-seat felt plus dock on desktop, the
 * PhoneFacingTrainer flashcard on phone. The dock reuses
 * PreflopTrainer.module.css so the two drills look like one app.
 *
 * Props:
 *   stats — this mode's own `usePreflopStats()` instance
 *     (`bluff-catcher:facing:v1`), separate from RFI's.
 *   keysSuspended — true while an App-level overlay is up; game keys go inert.
 */

import PreflopTable, { DEFAULT_OPENER_RAISE_BB } from '../components/PreflopTable';
import RangeSheet from '../components/RangeSheet';
import PreflopInfoSheet from '../components/PreflopInfoSheet';
import PhoneSheet from '../components/phone/PhoneSheet';
import PhoneRangeView from '../components/phone/range/PhoneRangeView';
import type { usePreflopStats } from '../hooks/usePreflopStats';
import { useLayoutMode } from '../hooks/useLayoutMode';
import {
  facingCellAction,
  facingChartTitle,
  useFacingDrill,
} from '../hooks/useFacingDrill';
import { FACING_CONTEXT_LABEL } from '../lib/facingMeta';
import type { HandClass } from '../lib/preflop/hands';
import PhoneFacingTrainer from './phone/PhoneFacingTrainer';
import { FACING_BRIEFING } from './facingBriefing';
import styles from './PreflopTrainer.module.css';
import own from './FacingTrainer.module.css';

export interface FacingTrainerProps {
  /** This mode's own `usePreflopStats()` instance — see the file header. */
  stats: ReturnType<typeof usePreflopStats>;
  /** True while an overlay owned by App is open — all game keys go inert. */
  keysSuspended?: boolean;
}

export function FacingTrainer({ stats, keysSuspended = false }: FacingTrainerProps) {
  const layout = useLayoutMode();
  const drill = useFacingDrill({ onRecord: stats.record, keysSuspended });

  const {
    spot,
    bucketMeta,
    openerLabel,
    rangeOpen,
    infoOpen,
    isCommitted,
    wasCorrect,
    verdictText,
    detailText,
    handleCommit,
    handleNext,
    openInfo,
    openRange,
    closeInfo,
    closeRange,
  } = drill;

  const cellAction = (hc: HandClass) => facingCellAction(spot.bucket, hc);
  const chartTitle = facingChartTitle(spot.bucket);
  const info = <PreflopInfoSheet content={FACING_BRIEFING} onClose={closeInfo} />;

  if (layout === 'phone') {
    return (
      <PhoneFacingTrainer
        {...drill}
        renderRange={() => (
          <PhoneSheet title={chartTitle} subtitle={FACING_CONTEXT_LABEL} onClose={closeRange}>
            <PhoneRangeView
              key={spot.bucket}
              position="BTN"
              highlight={spot.handClass}
              cellAction={cellAction}
              legend
              footnote={bucketMeta.footnote}
              fixedChart={bucketMeta.label}
            />
          </PhoneSheet>
        )}
        renderInfo={() => info}
      />
    );
  }

  return (
    <>
      <PreflopTable
        hero={spot.cards}
        position="BTN"
        opener={spot.opener}
        raiseBb={DEFAULT_OPENER_RAISE_BB}
        openerTag={bucketMeta.label}
        stackLabel="50bb+"
        centreTitle={`${openerLabel} opens · ${bucketMeta.label}`}
        centreLine={`Folds to you on the button · ${FACING_CONTEXT_LABEL}`}
      />

      <div className={styles.dock}>
        <div className={styles.left}>
          <div className={styles.leftText}>
            <span className={styles.kicker}>Your hand</span>
            <span className={styles.handClass}>{spot.handClass}</span>
          </div>
          <button type="button" className={styles.btnInfo} onClick={openInfo}>
            <span className={styles.keyHint} aria-hidden="true">I</span>
            Info
          </button>
        </div>

        <div className={styles.right}>
          {!isCommitted ? (
            <>
              <p className={styles.prompt}>
                {openerLabel} opens {DEFAULT_OPENER_RAISE_BB}bb. Fold, call or 3-bet?
                <span className={styles.promptHint}>
                  Keys: F = Fold · J = Call · K = 3-bet · {bucketMeta.label} chart
                </span>
              </p>
              <div className={own.buttons}>
                <button
                  type="button"
                  className={styles.btnFold}
                  onClick={() => handleCommit('fold')}
                >
                  <span className={styles.keyHint} aria-hidden="true">F</span>
                  Fold
                </button>
                <button
                  type="button"
                  className={`${own.btnAction} ${own.btnCall}`}
                  onClick={() => handleCommit('call')}
                >
                  <span className={styles.keyHint} aria-hidden="true">J</span>
                  Call
                </button>
                <button
                  type="button"
                  className={`${own.btnAction} ${own.btnRaise}`}
                  onClick={() => handleCommit('3bet')}
                >
                  <span className={styles.keyHint} aria-hidden="true">K</span>
                  3-bet
                </button>
              </div>
            </>
          ) : (
            <div className={styles.postCommit}>
              <div className={own.verdictBlock}>
                <span
                  className={wasCorrect ? styles.verdictCorrect : styles.verdictWrong}
                  data-testid="verdict"
                >
                  {verdictText}
                </span>
                <span className={own.detail}>{detailText}</span>
              </div>
              <div className={styles.postCommitActions}>
                <button type="button" className={styles.btnRange} onClick={openRange}>
                  <span className={styles.keyHint} aria-hidden="true">R</span>
                  Range
                </button>
                <button type="button" className={styles.btnNext} onClick={handleNext}>
                  Next hand →{' '}
                  <span style={{ fontSize: '11px', opacity: 0.6, marginLeft: 4 }}>Space</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rangeOpen && (
        <RangeSheet
          key={spot.bucket}
          position="BTN"
          highlight={spot.handClass}
          cellAction={cellAction}
          legend
          footnote={bucketMeta.footnote}
          fixedChart={{
            kicker: `Facing an open · ${FACING_CONTEXT_LABEL}`,
            title: chartTitle,
            subline: `Graded on the ${bucketMeta.chartName} chart`,
          }}
          onClose={closeRange}
        />
      )}

      {infoOpen && info}
    </>
  );
}

export default FacingTrainer;
