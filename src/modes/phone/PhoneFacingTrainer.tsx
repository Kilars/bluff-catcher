/**
 * PhoneFacingTrainer — the phone view of the facing-open drill.
 *
 * The same flashcard frame as PhonePreflopTrainer (and its stylesheet, whose
 * height budget this inherits unchanged): seat ladder with the opener's raise
 * on it, the hero cards, and the decision panel — here with three thumb
 * buttons, Fold / Call / 3-bet.
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
import { DEFAULT_OPENER_RAISE_BB } from '../../components/PreflopTable';
import type { UseFacingDrillReturn } from '../../hooks/useFacingDrill';
import type { FacingAction } from '../../lib/preflop/facing';
import styles from './PhonePreflopTrainer.module.css';

const PHONE_ACTIONS: DecisionButtonConfig<FacingAction>[] = [
  { action: 'fold', label: 'Fold', tone: 'fold' },
  { action: 'call', label: 'Call', tone: 'call' },
  { action: '3bet', label: '3-bet', tone: 'raise' },
];

export interface PhoneFacingTrainerProps extends UseFacingDrillReturn {
  renderRange?: () => ReactNode;
  renderInfo?: () => ReactNode;
}

export default function PhoneFacingTrainer({
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
  openRange,
  renderRange,
  renderInfo,
}: PhoneFacingTrainerProps) {
  return (
    <section className={styles.trainer} data-testid="phone-facing-trainer">
      <div className={styles.topPad} />

      <PhoneSeatLadder
        position="BTN"
        opener={spot.opener}
        format={bucketMeta.format}
        contextLine={`${openerLabel} raises ${DEFAULT_OPENER_RAISE_BB}bb · ${bucketMeta.label} · ${bucketMeta.stackLabel}`}
      />

      <div className={styles.gapAbove} />

      <PhonePreflopStage cards={spot.cards} handClass={spot.handClass} />

      <div className={styles.gapBelow} />

      <PhoneDecisionPanel<FacingAction>
        isCommitted={isCommitted}
        wasCorrect={wasCorrect}
        verdictText={verdictText}
        prompt="Fold, call or 3-bet?"
        actionLabel="3-bet"
        boundaryText={detailText}
        actions={PHONE_ACTIONS}
        onCommit={handleCommit}
        onNext={handleNext}
        onOpenRange={openRange}
      />

      {rangeOpen && renderRange?.()}
      {infoOpen && renderInfo?.()}
    </section>
  );
}
