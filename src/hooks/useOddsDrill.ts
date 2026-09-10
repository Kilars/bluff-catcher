/**
 * useOddsDrill — all behaviour of the Runout odds drill, with no presentation.
 *
 * Extracted verbatim from `modes/OddsTrainer.tsx`. The component that called
 * this logic is now a view over it, and a second (phone) view can render the
 * same drill without a second copy of the rules. Per `DECISIONS.md` — "two
 * trees, one behaviour" — forking presentation is expected, forking behaviour
 * is a bug, so nothing below may be reimplemented in a layout tree.
 *
 * State (ephemeral, dropped on unmount — only the stats hook persists):
 *   spot        current dealt Spot
 *   guess       null = not committed
 *   hover       ghost position on the rail
 *   showExplain whether the explanation sheet is over the top
 *
 * The seen-boards set lives in a ref, not state: it must survive a deal without
 * causing a render of its own, and `dealSpot` mutates nothing but reads it to
 * avoid repeating a board inside a session.
 *
 * Stats are passed in rather than owned here, because the root App lifts them
 * for the mode-aware Header. The hook takes the same object the component took
 * as a prop.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { dealSpot, boardKey } from '../lib/deal';
import { analyse } from '../lib/odds';
import { explain } from '../lib/explain';
import { bandOf, type Band } from '../lib/band';
import type { Spot } from '../lib/deal';
import type { useStats } from './useStats';

type UseStatsReturn = ReturnType<typeof useStats>;

// ─── Initial deal ─────────────────────────────────────────────────────────────

function initialDeal(): { spot: Spot; seen: Set<string> } {
  const seen = new Set<string>();
  const spot = dealSpot({ seen });
  seen.add(boardKey(spot.board));
  return { spot, seen };
}

const { spot: INITIAL_SPOT, seen: INITIAL_SEEN } = initialDeal();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOddsDrill(stats: UseStatsReturn) {
  const seenRef = useRef<Set<string>>(INITIAL_SEEN);

  const [spot, setSpot] = useState<Spot>(INITIAL_SPOT);
  const [guess, setGuess] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [showExplain, setShowExplain] = useState(false);

  // ── Derived (memoised on spot) ─────────────────────────────────────────────

  const analysis = useMemo(
    () =>
      analyse(
        spot.read.backdoor
          ? { hero: spot.hero, board: spot.board, mode: 'backdoor' }
          : { hero: spot.hero, board: spot.board, hits: spot.read.hits }
      ),
    [spot]
  );

  const explanation = useMemo(
    () => explain(spot.read, analysis, spot.hero, spot.board),
    [spot, analysis]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCommit = useCallback(
    (pct: number) => {
      if (guess !== null) return; // already committed
      const delta = Math.abs(pct - analysis.total);
      const band = bandOf(delta);
      setGuess(pct);
      setHover(null);
      stats.record(delta, band, spot.read.primaryCategory);
    },
    [guess, analysis.total, stats, spot.read.primaryCategory]
  );

  const handleNext = useCallback(() => {
    const newSpot = dealSpot({ seen: seenRef.current });
    seenRef.current.add(boardKey(newSpot.board));
    setSpot(newSpot);
    setGuess(null);
    setHover(null);
    setShowExplain(false);
  }, []);

  const handleHoverChange = useCallback((pct: number | null) => {
    setHover(pct);
  }, []);

  const handleOpenExplain = useCallback(() => {
    if (guess !== null) setShowExplain(true);
  }, [guess]);

  const handleCloseExplain = useCallback(() => {
    setShowExplain(false);
  }, []);

  // ── Scoring (current hand) ─────────────────────────────────────────────────

  const delta = guess !== null ? Math.abs(guess - analysis.total) : 0;
  const currentBand: Band | null = guess !== null ? bandOf(delta) : null;

  return {
    spot,
    guess,
    hover,
    showExplain,
    analysis,
    explanation,
    delta,
    currentBand,
    handleCommit,
    handleNext,
    handleHoverChange,
    handleOpenExplain,
    handleCloseExplain,
  };
}

export type UseOddsDrillReturn = ReturnType<typeof useOddsDrill>;
