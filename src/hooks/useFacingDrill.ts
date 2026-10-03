/**
 * useFacingDrill — all behaviour of the facing-open (fold / call / 3-bet)
 * drill, with no presentation. The facing twin of `usePreflopDrill`, and kept
 * deliberately shaped like it: same state machine, same sheet rules, same
 * advance keys. The double-record guard is one step stricter: handleCommit
 * sets the ref itself, so two commits in the same tick cannot both record. See docs/PLAN-3bet.md (F2–F4).
 *
 * Owns spot state:
 *  - dealFacingSpot() on mount and on "next".
 *  - committed: null (awaiting input) | 'fold' | 'call' | the drill's raise.
 *  - A commit locks the three actions until the player advances.
 *
 * Keyboard bindings (same shape as the RFI drill):
 *  - F = Fold, J = Call, K = 3-bet / 4-bet (only while uncommitted). J means *open* in
 *    the RFI drill; the modes never share a screen, and the briefing says so.
 *  - Space / Enter = Next hand (only once committed)
 *  - R = Range sheet (only once committed)
 *  - I = Situation briefing (always)
 *  - Escape = close whichever sheet is open
 *  While a sheet is open the game keys are inert.
 *
 * The briefing opens the first time the player ever meets this drill in each
 * format (both layouts), then only via Info / I — `needsBriefing('facing')` /
 * `needsBriefing('facing-cash')`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { dealFacingSpot, type FacingSpot } from '../lib/preflop/facingDeal';
import {
  BUCKET_META,
  bucketChartAction,
  spotSizes,
  bucketsFor,
  type Bucket,
  type Drill,
  type FacingAction,
  type RaiseAction,
} from '../lib/preflop/facing';
import { CELL_ACTION_LABELS, type CellAction, type ChartPage } from '../lib/preflop/grid';
import { positionLabel } from '../lib/preflop/boundary';
import type { HandClass } from '../lib/preflop/hands';
import { needsBriefing, markBriefed } from '../lib/preflop/briefed';
import type { Format } from '../lib/preflop/ranges';

/** The briefing id in `briefed.ts` per drill and format — separate from every RFI tier. */
export const FACING_BRIEFING_ID: Record<Drill, Record<Format, string>> = {
  btn: { mtt: 'facing', cash: 'facing-cash' },
  bb: { mtt: 'bbdefend', cash: 'bbdefend-cash' },
  btn4: { mtt: 'btn4bet', cash: 'btn4bet-cash' },
  // Cash only: the drill always runs in cash, whatever the format switch says.
  open4: { mtt: 'open4bet', cash: 'open4bet' },
};

/** A re-raise as the copy and buttons write it. */
export const RAISE_WORD: Record<RaiseAction, string> = { '3bet': '3-bet', '4bet': '4-bet' };

// ─── Pure helpers (exported for the views and tests) ──────────────────────────

/**
 * A bucket chart's answer for a hand, as a grid colour. A chart without kinds
 * (cash 3-bets, 40bb 4-bets) colours its raises plainly — never as "value".
 */
export function facingCellAction(bucket: Bucket, hc: HandClass): CellAction {
  const { action, kind } = bucketChartAction(bucket, hc);
  if (action === '3bet') return kind ?? 'threeBet';
  if (action === '4bet') return kind === 'value' ? 'fourBetValue' : kind === 'bluff' ? 'fourBetBluff' : 'fourBet';
  return action;
}

/**
 * "BTN vs Late (UTG+2, LJ, HJ, CO)" — the range sheet's title. Cash bucket
 * labels already name their openers ("vs LJ/HJ", "vs CO"), and so does every
 * per-seat bucket ("BB vs CO", "BTN vs SB 3-bet"), so those stand alone.
 */
export function facingChartTitle(bucket: Bucket): string {
  const meta = BUCKET_META[bucket];
  const hero = positionLabel(meta.hero);
  if (meta.drill !== 'btn' || meta.format === 'cash') return `${hero} ${meta.label}`;
  return `BTN ${meta.label} (${meta.openers.map(positionLabel).join(', ')})`;
}

/**
 * Every chart of a drill in a format, as range-sheet pages in seat order —
 * the BTN drill's opener groups, or one page per opener in BB defend — so
 * the sheet can step between them like the RFI seats. `kicker` heads each page.
 */
export function facingChartPages(format: Format, drill: Drill, kicker: string): ChartPage[] {
  return bucketsFor(format, drill).map((b) => {
    const meta = BUCKET_META[b];
    return {
      id: b,
      tab: meta.openerTag ?? positionLabel(meta.chartSeat),
      kicker,
      title: facingChartTitle(b),
      subline: `Graded on the ${meta.chartName} chart`,
      name: meta.label,
      cellAction: (hc: HandClass) => facingCellAction(b, hc),
      footnote: meta.footnote,
    };
  });
}

/**
 * The word the verdict uses for a spot's right answer: "call", "3-bet (bluff)",
 * "4-bet (value)", or a bare "3-bet" / "4-bet" when the chart does not split
 * them.
 */
export function facingAnswerWord(spot: Pick<FacingSpot, 'correct' | 'kind'>): string {
  if (spot.correct === '3bet' || spot.correct === '4bet') {
    const word = RAISE_WORD[spot.correct];
    return spot.kind ? `${word} (${spot.kind})` : word;
  }
  return spot.correct;
}

/** "Correct — call" / "Wrong — this is a 3-bet (bluff)". */
export function facingVerdictText(
  spot: Pick<FacingSpot, 'correct' | 'kind'>,
  action: FacingAction
): string {
  const word = facingAnswerWord(spot);
  return action === spot.correct ? `Correct — ${word}` : `Wrong — this is a ${word}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseFacingDrillOptions {
  /** Called once per committed hand with true = correct, false = wrong. */
  onRecord: (wasCorrect: boolean) => void;
  /** True while an overlay owned by App is open — all game keys go inert. */
  keysSuspended?: boolean;
  /** Tournament (default) or cash. App remounts the drill on a change. */
  format?: Format;
  /** Hero on the button facing an open (default), in the big blind, or facing a 3-bet. */
  drill?: Drill;
}

export function useFacingDrill({
  onRecord,
  keysSuspended = false,
  format: formatOpt = 'mtt',
  drill = 'btn',
}: UseFacingDrillOptions) {
  // Open vs 3-bet has cash charts only (docs/PLAN-btn-4bet.md, "Follow-up").
  const format: Format = drill === 'open4' ? 'cash' : formatOpt;
  const [spot, setSpot] = useState<FacingSpot>(() => dealFacingSpot({ format, drill }));
  const [committed, setCommitted] = useState<FacingAction | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const briefingId = FACING_BRIEFING_ID[drill][format];
  const [infoOpen, setInfoOpen] = useState(() => needsBriefing(briefingId));

  useEffect(() => {
    // Marked on open, not close: every dismissal route counts.
    if (infoOpen) markBriefed(briefingId);
  }, [infoOpen, briefingId]);

  const committedRef = useRef<FacingAction | null>(null);
  committedRef.current = committed;
  const spotRef = useRef<FacingSpot>(spot);
  spotRef.current = spot;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCommit = useCallback(
    (action: FacingAction) => {
      if (committedRef.current !== null) return; // double-record guard
      committedRef.current = action;
      setCommitted(action);
      onRecord(action === spotRef.current.correct);
    },
    [onRecord]
  );

  const handleNext = useCallback(() => {
    setSpot(dealFacingSpot({ format, drill }));
    committedRef.current = null;
    setCommitted(null);
    setRangeOpen(false);
  }, [format, drill]);

  const openInfo = useCallback(() => {
    setRangeOpen(false);
    setInfoOpen(true);
  }, []);

  const openRange = useCallback(() => {
    setInfoOpen(false);
    setRangeOpen(true);
  }, []);

  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const closeRange = useCallback(() => setRangeOpen(false), []);

  // ── Keyboard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (keysSuspended) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.repeat) return;

      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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

      if (rangeOpen || infoOpen) return;

      const key = e.key.toLowerCase();

      if (key === 'i') {
        e.preventDefault();
        openInfo();
        return;
      }

      if (committedRef.current === null) {
        // K is the drill's re-raise: a 3-bet facing an open, a 4-bet facing a 3-bet.
        const raise = BUCKET_META[spotRef.current.bucket].raise;
        const action: FacingAction | null =
          key === 'f' ? 'fold' : key === 'j' ? 'call' : key === 'k' ? raise : null;
        if (action) {
          e.preventDefault();
          handleCommit(action);
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      } else if (key === 'r') {
        e.preventDefault();
        openRange();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCommit, handleNext, openInfo, openRange, rangeOpen, infoOpen, keysSuspended]);

  // ── Derived ──────────────────────────────────────────────────────────────

  const bucketMeta = BUCKET_META[spot.bucket];
  /** The raise hero faces and hero's 4-bet size — open vs 3-bet varies them by 3-bettor. */
  const sizes = spotSizes(spot.bucket, spot.opener);
  const raiseWord = RAISE_WORD[bucketMeta.raise];
  const isCommitted = committed !== null;
  const wasCorrect = isCommitted ? committed === spot.correct : null;
  const correctWord = facingAnswerWord(spot);
  const verdictText = committed !== null ? facingVerdictText(spot, committed) : null;
  const openerLabel = positionLabel(spot.opener);
  /**
   * Post-commit detail line: "A8s vs HJ: 3-bet (bluff) on the vs Late chart".
   * A per-opener chart (no `openerTag`) stops at the answer.
   */
  const answerLabel = CELL_ACTION_LABELS[facingCellAction(spot.bucket, spot.handClass)];
  const chartPart = bucketMeta.openerTag ? ` on the ${bucketMeta.openerTag} chart` : '';
  const detailText = `${spot.handClass} vs ${openerLabel}: ${answerLabel}${chartPart}`;

  return {
    spot,
    bucketMeta,
    sizes,
    raiseWord,
    openerLabel,
    committed,
    rangeOpen,
    infoOpen,
    isCommitted,
    wasCorrect,
    correctWord,
    verdictText,
    detailText,
    handleCommit,
    handleNext,
    openInfo,
    openRange,
    closeInfo,
    closeRange,
  };
}

export type UseFacingDrillReturn = ReturnType<typeof useFacingDrill>;
