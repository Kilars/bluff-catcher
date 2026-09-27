/**
 * FacingTrainer — the facing-open drills: someone opens, it folds to hero on
 * the button (docs/PLAN-3bet.md) or in the big blind (`drill="bb"`,
 * docs/PLAN-bb-defend.md), and hero chooses Fold / Call / 3-bet.
 *
 * Presentation only, in the same split as PreflopTrainer: the spot, commit,
 * sheets, keys and verdict copy all live in `hooks/useFacingDrill`, and this
 * file picks the tree — the felt (9-max, or 6-max in cash) plus dock on desktop, the
 * PhoneFacingTrainer flashcard on phone. The dock reuses
 * PreflopTrainer.module.css so the two drills look like one app.
 *
 * Props:
 *   stats — this mode's own `usePreflopStats()` instance
 *     (`bluff-catcher:facing:v1`, `bluff-catcher:bbdefend:v1`, …), separate from RFI's.
 *   drill — 'btn' (default) or 'bb': hero's seat, charts, copy and briefing.
 *   keysSuspended — true while an App-level overlay is up; game keys go inert.
 */

import { useCallback } from 'react';
import PreflopTable from '../components/PreflopTable';
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
import { BB_CONTEXT_LABEL, FACING_CONTEXT_LABEL } from '../lib/facingMeta';
import { DRILL_HERO, type Drill } from '../lib/preflop/facing';
import type { HandClass } from '../lib/preflop/hands';
import type { Format } from '../lib/preflop/ranges';
import PhoneFacingTrainer from './phone/PhoneFacingTrainer';
import { BB_BRIEFING, FACING_BRIEFING } from './facingBriefing';
import styles from './PreflopTrainer.module.css';
import own from './FacingTrainer.module.css';

export interface FacingTrainerProps {
  /** This mode's own `usePreflopStats()` instance — see the file header. */
  stats: ReturnType<typeof usePreflopStats>;
  /** True while an overlay owned by App is open — all game keys go inert. */
  keysSuspended?: boolean;
  /** Tournament (default) or cash. App keys the trainer on it, so a switch re-deals. */
  format?: Format;
  /** Hero on the button (default) or in the big blind. */
  drill?: Drill;
}

/** What differs on screen between the two drills. */
const DRILL_VIEW = {
  btn: {
    contextLabel: FACING_CONTEXT_LABEL,
    briefing: FACING_BRIEFING,
    kicker: 'Facing an open',
    where: 'Folds to you on the button',
  },
  bb: {
    contextLabel: BB_CONTEXT_LABEL,
    briefing: BB_BRIEFING,
    kicker: 'Defending the big blind',
    where: 'Folds to you in the big blind',
  },
} as const;

export function FacingTrainer({
  stats,
  keysSuspended = false,
  format = 'mtt',
  drill: drillKind = 'btn',
}: FacingTrainerProps) {
  const layout = useLayoutMode();
  const drill = useFacingDrill({ onRecord: stats.record, keysSuspended, format, drill: drillKind });
  const view = DRILL_VIEW[drillKind];
  const hero = DRILL_HERO[drillKind];
  const contextLabel = view.contextLabel[format];

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

  // Stable per chart, so the grids can memoise their legend on it.
  const cellAction = useCallback((hc: HandClass) => facingCellAction(spot.bucket, hc), [spot.bucket]);
  const chartTitle = facingChartTitle(spot.bucket);
  const info = <PreflopInfoSheet content={view.briefing[format]} onClose={closeInfo} />;

  if (layout === 'phone') {
    return (
      <PhoneFacingTrainer
        {...drill}
        renderRange={() => (
          <PhoneSheet title={chartTitle} subtitle={contextLabel} onClose={closeRange}>
            <PhoneRangeView
              key={spot.bucket}
              position={spot.opener}
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
        position={hero}
        opener={spot.opener}
        raiseBb={bucketMeta.raiseBb}
        openerTag={bucketMeta.openerTag}
        format={format}
        stackLabel={bucketMeta.stackLabel}
        centreTitle={[`${openerLabel} opens`, bucketMeta.openerTag].filter(Boolean).join(' · ')}
        centreLine={`${view.where} · ${contextLabel}`}
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
                {openerLabel} opens {bucketMeta.raiseBb}bb. Fold, call or 3-bet?
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
                  <span className={styles.spaceHint}>Space</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {rangeOpen && (
        <RangeSheet
          key={spot.bucket}
          position={spot.opener}
          highlight={spot.handClass}
          cellAction={cellAction}
          legend
          footnote={bucketMeta.footnote}
          fixedChart={{
            kicker: `${view.kicker} · ${contextLabel}`,
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
