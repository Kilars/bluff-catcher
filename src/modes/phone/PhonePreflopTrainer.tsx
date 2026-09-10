/**
 * PhonePreflopTrainer — the phone view of the preflop RFI drill.
 *
 * A flashcard, not a poker table (PLAN-phone §5.2). Three blocks, top to
 * bottom: the seat ladder that replaced the nine-seat felt, the hero cards at
 * 120×170, and the decision panel (a height-fixed feedback slot over a 64px
 * thumb row).
 *
 * **No drill logic of its own.** It takes the return value of
 * `usePreflopDrill` as props and renders it — DECISIONS.md: a layout tree is
 * presentation only, and forking behaviour is a bug. There is no deal here, no
 * commit, no stats write, no persistence key and no keyboard handler; the one
 * piece of local state in the subtree is PhoneDecisionPanel's 300ms input lock,
 * which decides when a tap is *plausible*, never what it means.
 *
 * Usage:
 *
 *     const drill = usePreflopDrill({ depth, onRecord, keysSuspended });
 *     <PhonePreflopTrainer
 *       {...drill}
 *       renderRange={() => <PhoneRangeView … onClose={drill.closeRange} />}
 *     />
 *
 * `renderRange` / `renderInfo` are seams, not imports: the phone range view is
 * built separately (Phase 6) and the parent owns which sheet component the
 * phone tree mounts. This component only says *when* — `rangeOpen` and
 * `infoOpen` come straight off the hook.
 *
 * No key-hint badges anywhere: there is no keyboard on a phone. (The hook's
 * keyboard handler is shared behaviour and stays — it costs nothing here and a
 * Bluetooth keyboard is free a11y.)
 */

import type { ReactNode } from 'react';
import PhoneSeatLadder from '../../components/phone/preflop/PhoneSeatLadder';
import PhonePreflopStage from '../../components/phone/preflop/PhonePreflopStage';
import PhoneDecisionPanel from '../../components/phone/preflop/PhoneDecisionPanel';
import { POSITION_LABEL } from '../../components/PreflopTable';
import type { UsePreflopDrillReturn } from '../../hooks/usePreflopDrill';
import type { Position } from '../../lib/preflop/ranges';
import styles from './PhonePreflopTrainer.module.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhonePreflopTrainerProps extends UsePreflopDrillReturn {
  /**
   * The range view, mounted when the drill says `rangeOpen`. The seam where
   * `PhoneRangeView` lands; the parent wires it, so this file never imports it.
   */
  renderRange?: () => ReactNode;
  /** Same seam for the situation briefing, mounted when `infoOpen`. */
  renderInfo?: () => ReactNode;
  /**
   * The post-commit boundary sentence, 15px under the verdict — e.g.
   * "HJ opens A2s+ suited". Phase 6 derives it in `lib/preflop/boundary.ts`;
   * until that exists the fallback below states the same fact from the spot the
   * hook already dealt, with no new logic.
   */
  boundaryText?: string;
}

// ─── Fallback boundary copy ───────────────────────────────────────────────────

/**
 * "A5s is inside the HJ opening range" — a restatement of `spot.correct`,
 * which the dealer computed from the charts. Not a second opinion about the
 * hand: it reads the same field the verdict does.
 */
function defaultBoundaryText(
  handClass: string,
  position: Position,
  correct: 'open' | 'fold',
  rangeKicker: string
): string {
  const inOut = correct === 'open' ? 'inside' : 'outside';
  return `${handClass} is ${inOut} the ${POSITION_LABEL[position]} ${rangeKicker.toLowerCase()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhonePreflopTrainer({
  meta,
  spot,
  rangeOpen,
  infoOpen,
  isCommitted,
  wasCorrect,
  verdictText,
  handleCommit,
  handleNext,
  openRange,
  renderRange,
  renderInfo,
  boundaryText,
}: PhonePreflopTrainerProps) {
  const boundary =
    boundaryText ??
    defaultBoundaryText(spot.handClass, spot.position, spot.correct, meta.rangeKicker);

  return (
    <section className={styles.trainer} data-testid="phone-preflop-trainer">
      <PhoneSeatLadder position={spot.position} />

      <div className={styles.gap} />

      <PhonePreflopStage cards={spot.cards} handClass={spot.handClass} />

      <div className={styles.gap} />

      <PhoneDecisionPanel
        isCommitted={isCommitted}
        wasCorrect={wasCorrect}
        verdictText={verdictText}
        prompt={meta.prompt}
        actionLabel={meta.actionLabel}
        boundaryText={boundary}
        onCommit={handleCommit}
        onNext={handleNext}
        onOpenRange={openRange}
      />

      {/* Seams — the parent owns what mounts here. */}
      {rangeOpen && renderRange?.()}
      {infoOpen && renderInfo?.()}
    </section>
  );
}
