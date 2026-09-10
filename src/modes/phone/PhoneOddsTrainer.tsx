/**
 * PhoneOddsTrainer — the phone view of the Runout odds drill.
 *
 * Composition and nothing else. Every piece of state, every handler and all the
 * scoring live in `hooks/useOddsDrill`, whose return value is handed in whole as
 * the `drill` prop — `DECISIONS.md`, "two trees, one behaviour": a layout tree
 * contains presentation only, and forking behaviour is a bug. There is
 * deliberately no `useState`, no `dealSpot`, no stats write and no persistence
 * key anywhere in this file or under `components/phone/odds/`.
 *
 * Taking the hook's return value rather than calling the hook keeps the desktop
 * and phone trees on one instance of the drill: `modes/OddsTrainer.tsx` calls
 * `useOddsDrill(stats)` once and picks a tree, so switching layout mid-hand
 * (a rotation) does not deal a new spot or lose an in-flight guess.
 *
 * The ExplainSheet is *not* rendered here. It is a full-screen overlay, which is
 * chrome, and the parent already renders it for the desktop tree — this tree
 * only raises `handleOpenExplain` through the [?] button in the commit bar.
 */

import PhoneOddsFrame from '../../components/phone/odds/PhoneOddsFrame';
import PhoneStage from '../../components/phone/odds/PhoneStage';
import PhoneCommitBar from '../../components/phone/odds/PhoneCommitBar';
import type { UseOddsDrillReturn } from '../../hooks/useOddsDrill';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhoneOddsTrainerProps {
  /** The whole return value of `useOddsDrill(stats)`, called by the parent. */
  drill: UseOddsDrillReturn;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneOddsTrainer({ drill }: PhoneOddsTrainerProps) {
  const {
    spot,
    guess,
    hover,
    analysis,
    delta,
    currentBand,
    handleCommit,
    handleNext,
    handleHoverChange,
    handleOpenExplain,
  } = drill;

  return (
    <PhoneOddsFrame>
      {/* Read zone — identical in both states, and it does not receive one
          commit-related prop, which is what makes that structural. */}
      <PhoneStage hero={spot.hero} board={spot.board} street={spot.street} />

      {/* Swap zone. `hover` is the drill hook's uncommitted rail position; on
          phone it is the dial's pending value, which is the same thing. */}
      <PhoneCommitBar
        guess={guess}
        pending={hover}
        trueTotal={analysis.total}
        drawName={spot.read.name}
        drawNote={spot.read.note}
        band={currentBand}
        delta={delta}
        onPendingChange={handleHoverChange}
        onCommit={handleCommit}
        onNext={handleNext}
        onOpenExplain={handleOpenExplain}
      />
    </PhoneOddsFrame>
  );
}
