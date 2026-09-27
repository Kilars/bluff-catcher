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
