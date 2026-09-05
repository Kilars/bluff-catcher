/**
 * App — single stateful view for the Runout odds drill.
 *
 * State (ephemeral, Phase 6 adds localStorage):
 *   spot      current dealt Spot
 *   guess     null = not committed
 *   hover     ghost position on rail
 *   showExplain
 *   errors    running list of deltas (for avg error)
 *   streak    increments on green, resets otherwise
 *   hands     total hands played
 *   bands     cumulative green/amber/red counts
 *
 * Phase 4 — desktop only (fixed 1280 × 860 canvas).
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { dealSpot, boardKey } from './lib/deal';
import { analyse } from './lib/odds';
import { explain } from './lib/explain';
import { useStats } from './hooks/useStats';
import Header from './components/Header';
import Table from './components/Table';
import Dock from './components/Dock';
import ExplainSheet from './components/ExplainSheet';
import type { Spot } from './lib/deal';

// ─── Scoring constants ────────────────────────────────────────────────────────

const GREEN_BAND = 5;
const AMBER_BAND = 10;

type Band = 'green' | 'amber' | 'red';

function bandOf(delta: number): Band {
  if (delta <= GREEN_BAND) return 'green';
  if (delta <= AMBER_BAND) return 'amber';
  return 'red';
}

// ─── Initial deal ─────────────────────────────────────────────────────────────

function initialDeal(): { spot: Spot; seen: Set<string> } {
  const seen = new Set<string>();
  const spot = dealSpot({ seen });
  seen.add(boardKey(spot.board));
  return { spot, seen };
}

const { spot: INITIAL_SPOT, seen: INITIAL_SEEN } = initialDeal();

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const seenRef = useRef<Set<string>>(INITIAL_SEEN);
  const stats = useStats();

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'relative',
        width: '1280px',
        height: '860px',
        overflow: 'hidden',
        background: 'var(--color-bg)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <Header
        hands={stats.hands}
        streak={stats.streak}
        errors={stats.errors}
        bands={stats.bands}
        onResetStats={stats.reset}
      />

      <Table
        hero={spot.hero}
        board={spot.board}
        street={spot.street}
      />

      <Dock
        guess={guess}
        hover={hover}
        trueTotal={analysis.total}
        drawName={spot.read.name}
        drawNote={spot.read.note}
        band={currentBand}
        delta={delta}
        onCommit={handleCommit}
        onNext={handleNext}
        onHoverChange={handleHoverChange}
        onOpenExplain={handleOpenExplain}
      />

      {/* Explanation sheet — rendered over the top */}
      {showExplain && (
        <ExplainSheet
          explanation={explanation}
          drawName={spot.read.name}
          street={spot.street}
          onClose={handleCloseExplain}
          onNext={handleNext}
          layout="Bottom sheet"
        />
      )}
    </div>
  );
}
