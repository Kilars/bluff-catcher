/**
 * OddsTrainer — the desktop view of the Runout odds drill.
 *
 * Presentation only. Every piece of state, every handler and all the scoring
 * live in `hooks/useOddsDrill` — see `DECISIONS.md`, "two trees, one
 * behaviour": a layout tree may contain presentation and nothing else, so the
 * phone tree can render the same drill without a second copy of the rules.
 *
 * Stats are passed in via props (lifted to root for mode-aware Header) and
 * handed straight to the hook.
 */

import Table from '../components/Table';
import Dock from '../components/Dock';
import ExplainSheet from '../components/ExplainSheet';
import { useOddsDrill } from '../hooks/useOddsDrill';
import { useStats } from '../hooks/useStats';

type UseStatsReturn = ReturnType<typeof useStats>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface OddsTrainerProps {
  stats: UseStatsReturn;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OddsTrainer({ stats }: OddsTrainerProps) {
  const {
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
  } = useOddsDrill(stats);

  // ── Render ─────────────────────────────────────────────────────────────────
  // OddsTrainer renders Table + Dock only. The outer frame and Header are
  // managed by the root App. The ExplainSheet is position:fixed/absolute
  // and overlays the full viewport.

  return (
    <>
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
    </>
  );
}
