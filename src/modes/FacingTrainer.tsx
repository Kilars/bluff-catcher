/**
 * FacingTrainer — the facing modes (docs/PLAN-menu.md), grouped by the raise
 * hero answers:
 *   - 3-bet: it folds to hero facing an open, on the button (docs/PLAN-3bet.md)
 *     or in a curated seat (`spots.ts`). Fold / Call / 3-bet.
 *   - 4-bet: hero opened and is 3-bet, from the button (docs/PLAN-btn-4bet.md)
 *     or, in cash, from LJ/HJ/CO. Fold / Call / 4-bet.
 *   - Blinds: the big blind (docs/PLAN-bb-defend.md) and the small blind's
 *     curated spots facing an open. Fold / Call / 3-bet.
 * A mode deals from every chart in it, so the copy names hero's seat per hand.
 *
 * Presentation only, in the same split as PreflopTrainer: the spot, commit,
 * sheets, keys and verdict copy all live in `hooks/useFacingDrill`, and this
 * file picks the tree — the felt (9-max, or 6-max in cash) plus dock on desktop, the
 * PhoneFacingTrainer flashcard on phone. The dock reuses
 * PreflopTrainer.module.css so the two drills look like one app.
 *
 * Props:
 *   stats — this mode's own `usePreflopStats()` instance (`STATS_KEY`), separate from RFI's.
 *   mode — 'threebet' (default), 'fourbet' or 'blinds': charts, copy and briefing.
 *   keysSuspended — true while an App-level overlay is up; game keys go inert.
 */

import { useMemo } from 'react';
import PreflopTable from '../components/PreflopTable';
import ChartBrowser, { type BrowserSpot } from '../components/ChartBrowser';
import PreflopInfoSheet from '../components/PreflopInfoSheet';
import type { usePreflopStats } from '../hooks/usePreflopStats';
import { useLayoutMode } from '../hooks/useLayoutMode';
import {
  facingChartPages,
  useFacingDrill,
} from '../hooks/useFacingDrill';
import { MODE_CONTEXT_LABEL, MODE_KICKER } from '../lib/facingMeta';
import type { FacingMode } from '../lib/preflop/facing';
import { positionLabel } from '../lib/preflop/boundary';
import { DEFAULT_DEPTH, chartKeyFor, type Format, type Seat } from '../lib/preflop/ranges';
import { pairSetFor } from '../lib/preflop/pairCharts';
import PhoneFacingTrainer from './phone/PhoneFacingTrainer';
import { FOURBET_CASH_LOW_BRIEFING, MODE_BRIEFING } from './facingBriefing';
import type { Opponents } from '../lib/preflop/lowStakes';
import styles from './PreflopTrainer.module.css';
import own from './FacingTrainer.module.css';

export interface FacingTrainerProps {
  /** This mode's own `usePreflopStats()` instance — see the file header. */
  stats: ReturnType<typeof usePreflopStats>;
  /** True while an overlay owned by App is open — all game keys go inert. */
  keysSuspended?: boolean;
  /** Tournament (default) or cash. App keys the trainer on it, so a switch re-deals. */
  format?: Format;
  /** Facing an open (default), facing a 3-bet, or in the blinds. */
  mode?: FacingMode;
  /** Who is across the table; changes only the cash 4-bet drills. App keys the trainer on it. */
  opponents?: Opponents;
}

export function FacingTrainer({
  stats,
  keysSuspended = false,
  format = 'mtt',
  mode = 'threebet',
  opponents = 'balanced',
}: FacingTrainerProps) {
  const layout = useLayoutMode();
  const drill = useFacingDrill({ onRecord: stats.record, keysSuspended, format, mode, opponents });
  const contextLabel = MODE_CONTEXT_LABEL[mode][format];
  const heroOpened = drill.bucketMeta.heroOpenBb !== undefined;
  // A mode deals several seats, so the line names hero's every hand.
  const heroSeat = drill.bucketMeta.hero;
  const centreWhere = heroOpened
    ? `You opened the ${heroSeat === 'BTN' ? 'button' : positionLabel(heroSeat)}`
    : heroSeat === 'BTN'
      ? 'Folds to you on the button'
      : heroSeat === 'BB'
        ? 'Folds to you in the big blind'
        : heroSeat === 'SB'
          ? 'Folds to you in the small blind'
          : `Folds to you in the ${positionLabel(heroSeat)}`;

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
  const kicker = `${MODE_KICKER[mode]} · ${contextLabel}`;
  const pages = useMemo(
    () => facingChartPages(format, mode, kicker, opponents),
    [format, mode, kicker, opponents]
  );
  const startPage = Math.max(0, pages.findIndex((p) => p.id === spot.bucket));
  // The sheets take an RFI seat, which a paged sheet only uses to seed its
  // (hidden) seat tabs — and there is no BB RFI seat. Any seat will do.
  const sheetSeat: Seat = spot.opener === 'BB' ? 'BTN' : spot.opener;
  // The low-stakes read only re-splits cash 4-bets, so only those briefings change.
  const lowBriefing = opponents === 'low' && format === 'cash' && mode === 'fourbet' ? FOURBET_CASH_LOW_BRIEFING : undefined;
  const info = <PreflopInfoSheet content={lowBriefing ?? MODE_BRIEFING[mode][format]} onClose={closeInfo} />;

  // The range sheet opens on the graded charts; its decision strip reaches
  // every seat pair, opening on the dealt one (`ChartBrowser`).
  const spotNode = mode === 'fourbet' ? 'vs3bet' : 'vsOpen';
  const browserSpot: BrowserSpot = {
    node: spotNode,
    setId: pairSetFor(format, bucketMeta.stackLabel, spotNode),
    hero: bucketMeta.hero,
    villain: spot.opener,
    hand: spot.handClass,
  };
  const rangeSheet = (sheetLayout: 'phone' | 'desktop') => (
    <ChartBrowser
      key={spot.bucket}
      layout={sheetLayout}
      format={format}
      depth={chartKeyFor(format, DEFAULT_DEPTH)}
      drill={{ pages, startPage, seat: sheetSeat }}
      spot={browserSpot}
      title={MODE_KICKER[mode]}
      subtitle={contextLabel}
      onClose={closeRange}
    />
  );

  if (layout === 'phone') {
    return (
      <PhoneFacingTrainer
        {...drill}
        renderRange={() => rangeSheet('phone')}
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
        centreLine={`${centreWhere} · ${contextLabel}`}
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

      {rangeOpen && rangeSheet('desktop')}

      {infoOpen && info}
    </>
  );
}

export default FacingTrainer;
