/**
 * PhoneFacingTrainer — the phone view of the facing-open drill.
 *
 * The same flashcard frame as PhonePreflopTrainer (and its stylesheet, whose
 * height budget this inherits unchanged): seat ladder with the opener's raise
 * on it, the hero cards, and the decision panel — here with three thumb
 * buttons, Fold / Call / 3-bet (or 4-bet, facing a 3-bet).
 *
 * No drill logic of its own: it renders the return value of `useFacingDrill`.
 * `renderRange` / `renderInfo` are the same seams the RFI phone tree uses.
 */

import type { ReactNode } from 'react';
import PhoneSeatLadder from '../../components/phone/preflop/PhoneSeatLadder';
import PhonePreflopStage from '../../components/phone/preflop/PhonePreflopStage';
import PhoneDecisionPanel, {
  type DecisionButtonConfig,
} from '../../components/phone/preflop/PhoneDecisionPanel';
import type { UseFacingDrillReturn } from '../../hooks/useFacingDrill';
import type { FacingAction, RaiseAction } from '../../lib/preflop/facing';
import styles from './PhonePreflopTrainer.module.css';

/** Fold, call, and the drill's re-raise (3-bet facing an open, 4-bet facing a 3-bet). */
function phoneActions(raise: RaiseAction, raiseWord: string): DecisionButtonConfig<FacingAction>[] {
  return [
    { action: 'fold', label: 'Fold', tone: 'fold' },
    { action: 'call', label: 'Call', tone: 'call' },
    { action: raise, label: raiseWord, tone: 'raise' },
  ];
}

export interface PhoneFacingTrainerProps extends UseFacingDrillReturn {
  renderRange?: () => ReactNode;
  renderInfo?: () => ReactNode;
}

export default function PhoneFacingTrainer({
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
  openRange,
  renderRange,
  renderInfo,
}: PhoneFacingTrainerProps) {
  return (
    <section className={styles.trainer} data-testid="phone-facing-trainer">
      <div className={styles.topPad} />

      <PhoneSeatLadder
        position={bucketMeta.hero}
        opener={spot.opener}
        raiseBb={sizes.raiseBb}
        heroOpenBb={bucketMeta.heroOpenBb}
        format={bucketMeta.format}
        contextLine={[
          `${openerLabel} ${bucketMeta.heroOpenBb !== undefined ? '3-bets to' : 'raises'} ${sizes.raiseBb}bb`,
          bucketMeta.openerTag,
          bucketMeta.stack,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <div className={styles.gapAbove} />

      <PhonePreflopStage cards={spot.cards} handClass={spot.handClass} />

      <div className={styles.gapBelow} />

      <PhoneDecisionPanel<FacingAction>
        isCommitted={isCommitted}
        wasCorrect={wasCorrect}
        verdictText={verdictText}
        // Facing a 3-bet the size matters: at 40bb the 4-bet is a jam.
        prompt={`Fold, call or ${raiseWord}${sizes.fourBetSize ? ` (${sizes.fourBetSize})` : ''}?`}
        actionLabel={raiseWord}
        boundaryText={detailText}
        actions={phoneActions(bucketMeta.raise, raiseWord)}
        onCommit={handleCommit}
        onNext={handleNext}
        onOpenRange={openRange}
      />

      {rangeOpen && renderRange?.()}
      {infoOpen && renderInfo?.()}
    </section>
  );
}
