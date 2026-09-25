/**
 * Per-label coaching rubric and per-family hypothesis. This is the domain
 * knowledge the model is steered by — not a typed question set (that was the
 * type-safe-AI seam, now gone). Two parts per label:
 *
 *   - `cues`   — what to check, naming the enriched field to read so the model
 *                looks the number up rather than recomputing it.
 *   - `unless` — the counter-conditions: when the play is NOT a leak. Foregrounding
 *                "missed aggression" without these makes the model coach a bet in
 *                spots where checking is correct, so every aggressive label carries
 *                its own brake.
 *
 * `HYPOTHESIS` is the family thesis, phrased as a claim the model tests against
 * the hands rather than a conclusion to restate.
 */

import type { Label } from './labels.ts';
import type { Family } from './priority.ts';

export interface Rubric {
  cues: string[];
  /** When this is standard, not a leak. */
  unless: string;
}

/**
 * `handClass: 'strong'` admits top pair with a Q kicker and bare overpairs —
 * not nut hands. Any label gated on it must judge from the actual `cards` and
 * `board`, not the bucket, or it will call a thin TPGK bet a nut-advantage play.
 */
const NOT_THE_NUTS = 'Judge from the actual cards and board, not the handClass bucket — "strong" includes top-pair-good-kicker and bare overpairs, which are not nut hands.';

export const RUBRIC: Record<Label, Rubric> = {
  'pfa-check-flop': {
    cues: [
      'On a board that favours the raiser’s range (boardFavoursPfa true), a c-bet is standard; a check-back should be deliberate.',
      'Dry-high boards c-bet at very high frequency; wet-high boards lower, because the caller has draws and equity.',
    ],
    unless:
      'Checking back is fine on a static board with nothing to protect and no fold equity, as a deliberate trap with a strong hand, or when committed SPR makes it a stack-off decision instead.',
  },
  'check-draw': {
    cues: [
      'Strong draws (combo, nut flush, open-ended) want to bet: the semi-bluff wins fold equity now and the draw later.',
      'Read the actual draw from cards and board, not just handClass.',
    ],
    unless:
      'A weak draw (gutshot, non-nut flush draw) is a fine check on its own, in or out of position. Out of position into a range-ahead raiser is a further brake even on a moderate draw. Checking the nut flush draw on a monotone board keeps the range protected. And on the turn, with low SPR and fold equity collapsed, checking a draw can be right where betting the flop was not.',
  },
  'donk-bet': {
    cues: [
      'Position is the first filter: an in-position "lead" is almost always a leak regardless of texture.',
      'An out-of-position lead on a caller-favoured board (boardFavoursPfa false — the flop hit the caller’s range, not the raiser’s) is legitimate and underused: it denies the free check-back.',
    ],
    unless:
      'Leading a vulnerable made hand at committed SPR is a leak even out of position — it denies nothing and turns the hand face-up.',
  },
  'check-raise-flop': {
    cues: [
      'The caller’s main aggressive weapon, and rarely used. It punishes auto-c-bets and protects the check-call range.',
      'Read handClass: "strong" (sets, two pair) and "draw" (combo draws) are the qualifying classes; a "marginal-made" check-raise is the leak class.',
    ],
    unless:
      'Check-raising a merged, linear range (middle pair, weak top pair with no draw) is a leak, not aggression — the equity-when-called bar is a filter, not a formality.',
  },
  'overbet-strong': {
    cues: [
      'With a genuine nut advantage on a polarising board, a size above the pot extracts more and applies maximum pressure.',
      NOT_THE_NUTS,
    ],
    unless:
      'Overbetting top-pair-good-kicker or a bare overpair for value is a leak — it folds out worse and gets called by better. The nut advantage has to be real.',
  },
  'river-bluff-with-blocker': {
    cues: [
      'A blocker helps only when it removes hands they would CALL with. Check whether this blocker (removals) sits in their value/calling range.',
      'If the direction cannot be read from board and removals, say so rather than assume the blocker helps.',
    ],
    unless:
      'The blocker hurts when it removes hands they would FOLD — e.g. a card of the flush suit on a flushed board blocks their folding flushes, making the bluff worse.',
  },
  'river-bluff-no-blocker': {
    cues: [
      'First check the line: does the check-then-bet represent a credible value hand? Only if it does is a no-blocker bluff a candidate.',
      'Where the line is credible, this is not a licence to check every river — a hand that cannot win at showdown should sometimes fire.',
    ],
    unless:
      'Weight the bluff down when the hand unblocks their folds or the line has no credible value to represent.',
  },
  'river-call-marginal': {
    cues: [
      'The bluff-catch. Compare the hand’s showdown strength against the line to the price (requiredEquity). Small-stakes pools under-bluff rivers, so over-folding is the more common leak.',
    ],
    unless:
      'Fold the bottom of the class on villain-favourable runouts (paired boards, bricked draws, narrow value lines). requiredEquity is the threshold, not "amateurs over-fold" as a blanket rule.',
  },
  'river-check-value': {
    cues: [
      'Missed thin value: a hand that beats enough of their CALLING range should bet, thinner than instinct against pools that don’t fold enough.',
      NOT_THE_NUTS,
    ],
    unless:
      'Checking back is right when the hand beats nothing that calls, or when checking realises more than a bet that only gets called by better.',
  },
};

export const HYPOTHESIS: Record<Family, string> = {
  'PFR flop passivity':
    'Hero surrenders the initiative earned preflop — checking flops and draws that want a bet. Test this against the hands.',
  'Caller aggression':
    'Hero never takes the lead as the caller — no donks, no check-raises where they are warranted. Test this against the hands.',
  'River bluffing':
    'Hero under-bluffs rivers and, when bluffing, mis-selects the hand. Test this against the hands.',
  'River value / bluff-catch':
    'Hero’s river value bets and bluff-catches are miscalibrated — thin value left on the table, prices misread. Test this against the hands.',
};

export function rubricFor(label: Label): Rubric {
  return RUBRIC[label];
}
