/**
 * FacingTrainer — the facing drills: someone opens, it folds to hero on
 * the button (docs/PLAN-3bet.md) or in the big blind (`drill="bb"`,
 * docs/PLAN-bb-defend.md), and hero chooses Fold / Call / 3-bet; or hero
 * opened the button and a blind 3-bets (`drill="btn4"`,
 * docs/PLAN-btn-4bet.md), and hero chooses Fold / Call / 4-bet; or the same
 * from an LJ/HJ/CO open, in cash (`drill="open4"`).
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
 *   drill — 'btn' (default), 'bb', 'btn4' or 'open4': charts, copy and briefing.
 *   keysSuspended — true while an App-level overlay is up; game keys go inert.
 */

import { useMemo } from 'react';
import PreflopTable from '../components/PreflopTable';
import RangeSheet from '../components/RangeSheet';
import PreflopInfoSheet from '../components/PreflopInfoSheet';
import PhoneSheet from '../components/phone/PhoneSheet';
import PhoneRangeView from '../components/phone/range/PhoneRangeView';
import type { usePreflopStats } from '../hooks/usePreflopStats';
import { useLayoutMode } from '../hooks/useLayoutMode';
import {
  facingChartPages,
  useFacingDrill,
} from '../hooks/useFacingDrill';
import { BB_CONTEXT_LABEL, BTN4_CONTEXT_LABEL, FACING_CONTEXT_LABEL, OPEN4_CONTEXT_LABEL } from '../lib/facingMeta';
import type { Drill } from '../lib/preflop/facing';
import { positionLabel } from '../lib/preflop/boundary';
import type { Format, Seat } from '../lib/preflop/ranges';
import PhoneFacingTrainer from './phone/PhoneFacingTrainer';
import { BB_BRIEFING, BTN4_BRIEFING, FACING_BRIEFING, OPEN4_BRIEFING } from './facingBriefing';
import styles from './PreflopTrainer.module.css';
import own from './FacingTrainer.module.css';

export interface FacingTrainerProps {
  /** This mode's own `usePreflopStats()` instance — see the file header. */
  stats: ReturnType<typeof usePreflopStats>;
  /** True while an overlay owned by App is open — all game keys go inert. */
  keysSuspended?: boolean;
  /** Tournament (default) or cash. App keys the trainer on it, so a switch re-deals. */
  format?: Format;
  /** Hero on the button facing an open (default), in the big blind, or facing a 3-bet. */
  drill?: Drill;
}

/** What differs on screen between the drills. */
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
  btn4: {
    contextLabel: BTN4_CONTEXT_LABEL,
    briefing: BTN4_BRIEFING,
    kicker: 'Facing a 3-bet',
    where: 'You opened the button',
  },
  open4: {
    contextLabel: OPEN4_CONTEXT_LABEL,
    briefing: OPEN4_BRIEFING,
    kicker: 'Facing a 3-bet',
    where: 'You opened',
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
  const contextLabel = view.contextLabel[format];
  const heroOpened = drill.bucketMeta.heroOpenBb !== undefined;

  const {
    spot,
    bucketMeta,
    sizes,
    raiseWord,
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

  // Every chart of this drill, so the range sheet can step between them;
  // it opens on the one hero was graded on. Stable per drill and format, so
  // the grids can memoise their legends on each page's colouring.
  const kicker = `${view.kicker} · ${contextLabel}`;
  const pages = useMemo(() => facingChartPages(format, drillKind, kicker), [format, drillKind, kicker]);
  const startPage = Math.max(0, pages.findIndex((p) => p.id === spot.bucket));
  // The sheets take an RFI seat, which a paged sheet only uses to seed its
  // (hidden) seat tabs — and there is no BB RFI seat. Any seat will do.
  const sheetSeat: Seat = spot.opener === 'BB' ? 'BTN' : spot.opener;
  const info = <PreflopInfoSheet content={view.briefing[format]} onClose={closeInfo} />;

  if (layout === 'phone') {
    return (
      <PhoneFacingTrainer
        {...drill}
        renderRange={() => (
          <PhoneSheet title={view.kicker} subtitle={contextLabel} onClose={closeRange}>
            <PhoneRangeView
              key={spot.bucket}
              position={sheetSeat}
              highlight={spot.handClass}
              legend
              pages={pages}
              startPage={startPage}
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
        position={bucketMeta.hero}
        opener={spot.opener}
        raiseBb={sizes.raiseBb}
        heroOpenBb={bucketMeta.heroOpenBb}
        openerTag={bucketMeta.openerTag}
        format={format}
        stackLabel={bucketMeta.stackLabel}
        centreTitle={[`${openerLabel} ${heroOpened ? '3-bets' : 'opens'}`, bucketMeta.openerTag]
          .filter(Boolean)
          .join(' · ')}
        centreLine={`${drillKind === 'open4' ? `You opened the ${positionLabel(bucketMeta.hero)}` : view.where} · ${contextLabel}`}
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
                {heroOpened
                  ? `You open ${bucketMeta.heroOpenBb}bb, ${openerLabel} 3-bets to ${sizes.raiseBb}bb. Fold, call or 4-bet (${sizes.fourBetSize})?`
                  : `${openerLabel} opens ${sizes.raiseBb}bb. Fold, call or 3-bet?`}
                <span className={styles.promptHint}>
                  Keys: F = Fold · J = Call · K = {raiseWord} · {bucketMeta.label} chart
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
                  onClick={() => handleCommit(bucketMeta.raise)}
                >
                  <span className={styles.keyHint} aria-hidden="true">K</span>
                  {raiseWord}
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
          position={sheetSeat}
          highlight={spot.handClass}
          legend
          pages={pages}
          startPage={startPage}
          onClose={closeRange}
        />
      )}

      {infoOpen && info}
    </>
  );
}

export default FacingTrainer;
