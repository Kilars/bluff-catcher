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

/**
 * BTN vs 3-bet (docs/PLAN-btn-4bet.md). The chart facts are pinned by
 * `lib/preflop/btn4BetRanges.test.ts`.
 */
const BTN4_CASH_BRIEFING: InfoSheetContent = {
  ...MTT_BRIEFING,
  title: 'Fold, call or 4-bet on the button',
  subline: '6-max cash table · 100bb effective, no ante',
  steps: [
    {
      title: 'The spot',
      body: 'You open the button to 2.5bb, a blind 3-bets to 12.5bb and the other blind folds. Fold, call, or 4-bet to 25bb. Only hands you open are dealt.',
    },
    {
      title: 'Value and bluff',
      body: (
        <ul className={styles.briefList}>
          <li>
            <strong>Value</strong> — AA–TT, AK, AQs. They call a 5-bet jam.
          </li>
          <li>
            <strong>Bluff</strong> — A5s, AQo, AJo, KQo. They 4-bet for the blockers and fold to a
            jam: the blue half of the cell.
          </li>
          <li>The split comes from the source's own answer to a 5-bet jam.</li>
        </ul>
      ),
    },
    {
      title: 'Three rules',
      body: (
        <ul className={styles.briefList}>
          <li>Calls are middle pairs and suited broadways/aces: 66–99, AJs–A8s, KQs–K9s, QJs, QTs, JTs.</li>
          <li>Offsuit hands below AJo/KQo fold, and so do 55 and below.</li>
          <li>About 7 in 10 of your opens fold to the 3-bet. That is the chart, not a leak.</li>
        </ul>
      ),
    },
    {
      title: 'SB or BB',
      body: 'The source uses the same chart against either blind. The table shows who 3-bet.',
    },
  ],
  keys: [
    { key: 'F', label: 'Fold' },
    { key: 'J', label: 'Call' },
    { key: 'K', label: '4-bet' },
    { key: 'Space', label: 'Next hand' },
    { key: 'R', label: 'Range grid' },
    { key: 'I', label: 'This page' },
  ],
};

const BTN4_MTT_BRIEFING: InfoSheetContent = {
  ...BTN4_CASH_BRIEFING,
  subline: '9-handed tournament table · 40bb effective, BB ante',
  steps: [
    {
      title: 'The spot',
      body: 'You open the button to 2.3bb, a blind 3-bets to 9.2bb and the other blind folds. Fold, call, or 4-bet. At 40bb the 4-bet is all-in. Only hands you open are dealt.',
    },
    {
      title: 'One chart per blind',
      body: 'Against the SB and against the BB the charts differ, so each has its own. The table shows who 3-bet.',
    },
    {
      title: 'Three rules',
      body: (
        <ul className={styles.briefList}>
          <li>AA and KK call (and QQ and AKs vs the BB). A jam would fold out the 3-bettor's bluffs.</li>
          <li>
            The jams are strong-but-not-best hands that would rather not play a bloated pot: JJ, TT,
            AQ, KQo, AK (AKo vs the BB), and a few pairs — 88 and 33 vs either blind.
          </li>
          <li>Suited aces and suited connectors call. They play well in position.</li>
        </ul>
      ),
    },
    {
      title: 'No bluff split',
      body: 'The 4-bet is the jam, so there is no 5-bet to fold to. Every 4-bet is plain red. Pure chart: hands on a border are close.',
    },
  ],
};

export const BTN4_BRIEFING: Record<Format, InfoSheetContent> = {
  mtt: BTN4_MTT_BRIEFING,
  cash: BTN4_CASH_BRIEFING,
};

/**
 * Open vs 3-bet (cash only). The chart facts are pinned by
 * `lib/preflop/open4BetRanges.test.ts`.
 */
const OPEN4_CASH_BRIEFING: InfoSheetContent = {
  ...BTN4_CASH_BRIEFING,
  title: 'Fold, call or 4-bet after you open',
  subline: '6-max cash table · 100bb effective, no ante · cash only',
  steps: [
    {
      title: 'The spot',
      body: 'You open 2.5bb from LJ, HJ or CO and a seat behind you 3-bets: to 7.5bb in position, 12.5bb from a blind. Everyone else folds. Fold, call, or 4-bet (19bb out of position, 25bb vs a blind). Only hands you open are dealt.',
    },
    {
      title: 'One chart per seat',
      body: 'The source answers a 3-bet the same way whoever made it, so each opener has one chart. Value 4-bets call a 5-bet jam; bluffs fold to it (the blue half).',
    },
    {
      title: 'Three rules',
      body: (
        <ul className={styles.briefList}>
          <li>Value: AA–QQ and AK; JJ too from HJ and CO. From the LJ, JJ is a bluff.</li>
          <li>Bluffs are blockers: ATs, A5s, KTs, plus AQo from the CO.</li>
          <li>Calls: 77–TT (66 too from HJ/CO), AQs, AJs, KQs, KJs. Everything else folds: about 6 in 10 LJ opens, 7 in 10 CO opens.</li>
        </ul>
      ),
    },
    {
      title: 'Cash only',
      body: 'The tournament source has a different, noisy chart for every 3-bettor and a jam for a 4-bet, so this drill always plays cash.',
    },
  ],
};

export const OPEN4_BRIEFING: Record<Format, InfoSheetContent> = {
  mtt: OPEN4_CASH_BRIEFING,
  cash: OPEN4_CASH_BRIEFING,
};
