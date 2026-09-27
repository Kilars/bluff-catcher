/**
 * The facing-open drill's briefing copy (PLAN-3bet F4), rendered through
 * PreflopInfoSheet's chrome via its `content` prop. Presentation, not poker:
 * the chart facts it states are pinned by `lib/preflop/facing.test.ts`.
 */

import type { InfoSheetContent } from '../components/PreflopInfoSheet';
import styles from './FacingTrainer.module.css';

export const FACING_BRIEFING: InfoSheetContent = {
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
