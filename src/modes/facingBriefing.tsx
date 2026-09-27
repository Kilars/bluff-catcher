/**
 * The facing-open drill's briefing copy (PLAN-3bet F4), rendered through
 * PreflopInfoSheet's chrome via its `content` prop. Presentation, not poker:
 * the chart facts it states are pinned by `lib/preflop/facing.test.ts`.
 */

import type { InfoSheetContent } from '../components/PreflopInfoSheet';
import type { Format } from '../lib/preflop/ranges';
import styles from './FacingTrainer.module.css';

const MTT_BRIEFING: InfoSheetContent = {
  kicker: 'The situation',
  title: 'Fold, call or 3-bet on the button',
  subline: '9-handed tournament table · 50bb+ effective',
  steps: [
    {
      title: 'The spot',
      body: 'One player opens to 2.5bb and everyone else folds to you on the button. Fold, call, or 3-bet to about 3× the open.',
    },
    {
      title: 'Two charts, not six',
      body: (
        <ul className={styles.briefList}>
          <li>
            <strong>vs Early</strong> — UTG, UTG+1.
          </li>
          <li>
            <strong>vs Late</strong> — UTG+2, LJ, HJ, CO.
          </li>
          <li>Every hand names the opener and the chart you are graded on.</li>
        </ul>
      ),
    },
    {
      title: 'Three rules',
      body: (
        <ul className={styles.briefList}>
          <li>JJ and TT always call.</li>
          <li>
            Offsuit broadways: vs Early, AQo, AJo and KQo 3-bet as bluffs. vs Late, AQo is a
            value 3-bet and AJo, KQo call.
          </li>
          <li>
            Bluffs move down the suited aces (A5s–A2s vs Early, A8s–A2s vs Late) and pick up
            small suited connectors (65s, 54s) vs Late.
          </li>
        </ul>
      ),
    },
    {
      title: 'Stack depth',
      body: 'The charts are solved at 100bb and labelled 50bb+. Nearer 50bb, JJ/TT and A5s–A2s lean more towards 3-bet than the chart shows.',
    },
  ],
  keys: [
    { key: 'F', label: 'Fold' },
    { key: 'J', label: 'Call' },
    { key: 'K', label: '3-bet' },
    { key: 'Space', label: 'Next hand' },
    { key: 'R', label: 'Range grid' },
    { key: 'I', label: 'This page' },
  ],
  keysNote: 'J means call here. In the RFI drill it means open.',
  cta: 'Start drilling',
};

/**
 * Cash (6-max, 100bb, no ante). The chart facts are pinned by
 * `lib/preflop/cashRanges.test.ts`.
 */
const CASH_BRIEFING: InfoSheetContent = {
  ...MTT_BRIEFING,
  subline: '6-max cash table · 100bb effective, no ante',
  steps: [
    {
      title: 'The spot',
      body: 'LJ, HJ or CO opens to 2.5bb and everyone else folds to you on the button. Fold, call, or 3-bet to about 3× the open.',
    },
    {
      title: 'Two charts',
      body: (
        <ul className={styles.briefList}>
          <li>
            <strong>vs LJ/HJ</strong> — the source uses one chart for both.
          </li>
          <li>
            <strong>vs CO</strong> — the same, plus more 3-bets.
          </li>
        </ul>
      ),
    },
    {
      title: 'Three rules',
      body: (
        <ul className={styles.briefList}>
          <li>
            The button is almost 3-bet or fold. The chart only flats 66–99, A9s, A8s, QTs and
            JTs.
          </li>
          <li>JJ and TT 3-bet here — they flat in the tournament chart.</li>
          <li>
            vs CO adds only 3-bets: more suited aces (A7s, A6s, A3s, A2s), suited connectors
            (87s, 76s, 54s), K9s, AJo, ATo and KJo.
          </li>
        </ul>
      ),
    },
    {
      title: 'No value or bluff label',
      body: 'The cash source does not split its 3-bets, so the verdict just says 3-bet.',
    },
  ],
};

export const FACING_BRIEFING: Record<Format, InfoSheetContent> = {
  mtt: MTT_BRIEFING,
  cash: CASH_BRIEFING,
};

/**
 * BB defence (docs/PLAN-bb-defend.md). The defend percentages are pinned by
 * `lib/preflop/bbDefendRanges.test.ts`.
 */
const BB_MTT_BRIEFING: InfoSheetContent = {
  ...MTT_BRIEFING,
  title: 'Fold, call or 3-bet in the big blind',
  subline: '9-handed tournament table · 40bb effective, BB ante',
  steps: [
    {
      title: 'The spot',
      body: 'One player opens to 2.3bb (the SB to 3.5bb) and everyone else folds to you in the big blind. Fold, call, or 3-bet (about 4× the open when out of position).',
    },
    {
      title: 'One chart per opener',
      body: 'BB defence changes a lot from seat to seat, so every opener has its own chart. The table shows who opened.',
    },
    {
      title: 'Why the BB defends so wide',
      body: (
        <ul className={styles.briefList}>
          <li>You already have 1bb in, the BB ante is in the pot, and you close the action.</li>
          <li>That price means defending (call or 3-bet) 44% of hands vs UTG, up to 78% vs the BTN.</li>
          <li>You're out of position against everyone but the SB, so 3-bets are big. Every chart 3-bets AA.</li>
        </ul>
      ),
    },
    {
      title: 'Pure charts',
      body: 'The source rounds the solver to one answer per hand, with no value/bluff split. Hands on a border are close decisions.',
    },
  ],
  keysNote: 'J means call here. In the RFI drill it means open.',
};

const BB_CASH_BRIEFING: InfoSheetContent = {
  ...BB_MTT_BRIEFING,
  subline: '6-max cash table · 100bb effective, no ante',
  steps: [
    {
      title: 'The spot',
      body: 'LJ, HJ, CO, BTN or SB opens (2.5bb, the SB 3bb) and everyone else folds to you in the big blind. Fold, call, or 3-bet.',
    },
    BB_MTT_BRIEFING.steps[1],
    {
      title: 'Tighter than tournaments',
      body: (
        <ul className={styles.briefList}>
          <li>No ante, deeper stacks and bigger opens: you defend 22% of hands vs LJ, up to 52% vs the SB.</li>
          <li>The source doesn't state its rake. Real rake would push marginal calls further toward folding.</li>
        </ul>
      ),
    },
    BB_MTT_BRIEFING.steps[3],
  ],
};

export const BB_BRIEFING: Record<Format, InfoSheetContent> = {
  mtt: BB_MTT_BRIEFING,
  cash: BB_CASH_BRIEFING,
};
