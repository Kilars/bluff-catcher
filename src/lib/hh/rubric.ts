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
  'pfa-check-turn': {
    cues: [
      'Hero c-bet the flop and then checked the turn. The turn barrel is the follow-through the flop bet set up; a check-back should be a deliberate range decision, not a default after firing once.',
      'One-and-done — betting the flop and giving up the turn — leaves the pot to a range that called the flop and now gets a free card; read the turn card and boardFavoursPfa, not a rate.',
    ],
    unless:
      'Checking the turn is fine when the card shifts the range to the caller, when the hand wants to pot-control at committed SPR, as a deliberate check-back with showdown value, or heads-up-to-Hero pricing aside when villains acted between — read the specific spot, not a barrelling quota.',
  },
  'barrel-abandon': {
    cues: [
      'Hero c-bet the flop and barrelled the turn, then checked the river with air (no showdown value). The river is the last card the two-barrel story had to be told on, and checking hands the pot to a range that called two bets and now gets to showdown for free.',
      'Read the actual river card and board texture from cards/board: a card that completes obvious draws or shifts the range to the caller is a reason to give up, not a reason to fire a third time. This is a candidate to think about, not a verdict.',
    ],
    unless:
      'Giving up the river with air can be correct: on a bricked board where a third barrel has no fold equity — the caller has arrived with a range that no longer folds — checking and conceding beats burning chips on a bluff that cannot get through. A river give-up is not automatically a leak, and this label counts nothing and coaches no barrelling frequency.',
  },
  'cbet-multiway-air': {
    cues: [
      'Hero c-bet the flop with air (no showdown value) into 3+ players. A pure-bluff c-bet needs fold equity, and multiway it must fold out every villain, not just one — each extra range behind is another that has to fold before the bluff prints.',
      'Read the actual hand and board from cards/board, not just handClass: backdoor equity (a gutshot plus a backdoor flush, two overcards with a backdoor straight) turns this from a naked bluff into a bet with a plan.',
    ],
    unless:
      'A multiway air c-bet is fine with real backdoor equity that can barrel or improve, or as the opening bet of a coherent multi-street plan on a board that favours the raiser’s range. Board texture and the number of players are the read, never a c-bet rate — this label counts nothing and coaches no frequency.',
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
  'turn-probe': {
    cues: [
      'The preflop raiser declined the c-bet, so the turn is uncapped for both — leading here (a probe) attacks a range that gave up the flop and often gives up again.',
      'Texture is the filter: a probe earns its money on turn cards that favour the caller’s range (boardFavoursPfa false) or complete draws the check-back left in; read the board, not a probing rate.',
    ],
    unless:
      'Betting a hand that wants to keep the pot small, or on a turn that still favours the raiser’s checked-back range, is a leak not a probe. And `pfaCheckedFlop` is a heads-up read — with a third player in, the checked flop may not be the raiser’s, so confirm the line was caller-vs-raiser before calling it a declined c-bet.',
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
  'river-raise-value': {
    cues: [
      'Raising over a river bet is the top of the value range: the hand must beat enough of the bettor’s value and the hands that call the raise. Compare the actual cards and board to the line villain is repping (facedSizing).',
      NOT_THE_NUTS,
    ],
    unless:
      'Raising for value is a leak when the made hand only folds out worse and gets called by better — a "marginal-made" raise usually turns the hand into a bluff-catch that folds out the bluffs it beat. Calling is the play then. A label is a candidate, not a verdict, and frequency is never the point.',
  },
  'river-raise-bluff': {
    cues: [
      'A river raise with no showdown value is a pure bluff, and it must fold out the value the bettor just represented — a steeper ask than a bet, since the bet already got called or made. Read the line and whether the raise credibly reps a hand that beats the bettor.',
      'A blocker helps only when it removes hands they would CALL the raise with; if the direction cannot be read from board and removals, say so rather than assume it helps.',
    ],
    unless:
      'Weight the bluff-raise down when the hand unblocks their calls or the line reps no credible hand strong enough to raise. The direction a blocker points reverses with the board and needs a villain range the payload does not carry, so do not decide it here.',
  },
  'fold-to-turn-barrel': {
    cues: [
      'Hero folded the turn to a continued bet (villain bet the flop too). Weigh the price against the hand: compare requiredEquity (from facedSizing) and mdf to the showdown class Hero held — a hand that clears the price defends, one that does not folds.',
      'Small-stakes pools under-bluff and under-barrel, so over-folding to a second barrel is the more common leak; treat that as a lean to test against the price, not a verdict.',
    ],
    unless:
      'A fold can be correct — do not assume an over-fold. Folding the bottom of the class is right on villain-favourable runouts, at committed SPR that turns the call into a stack-off, or when the hand beats none of the barrelling range. requiredEquity/mdf are the thresholds, not "amateurs over-fold" as a blanket rule. facedSizing/mdf are exact only heads-up-to-Hero — when villains acted between the bet and Hero they mis-scale, so confirm the line before trusting the price. Multiway the flop and turn bets can come from different villains, so this need not be one player firing twice — confirm a single aggressor before reading it as a barrel.',
  },
  'fold-to-river-barrel': {
    cues: [
      'Hero folded the river to a continued barrel (villain bet the turn behind too, backing the river bet). Weigh the price against the hand: compare requiredEquity (from facedSizing) and mdf to the showdown class Hero held — the river call/fold boundary is sharp, and a hand that clears the price defends.',
      'Small-stakes pools under-bluff rivers, so over-folding to a barrelled line is the more common leak; treat that as a lean to test against the price, not a verdict.',
    ],
    unless:
      'A fold can be correct — do not assume an over-fold. Folding the bottom of the class is right on villain-favourable runouts (paired boards, bricked draws, narrow barrelled value lines) where the price is not met. requiredEquity/mdf are the thresholds, not "amateurs over-fold" as a blanket rule. facedSizing/mdf are exact only heads-up-to-Hero — when villains acted between the bet and Hero they mis-scale, so confirm the line before trusting the price. Multiway the turn and river bets can come from different villains, so this need not be one player firing twice — confirm a single aggressor before reading it as a barrel.',
  },
};

export const HYPOTHESIS: Record<Family, string> = {
  'PFR flop passivity':
    'Hero surrenders initiative across the hand — declining to fire the flop, or abandoning a barrel line he started. Test this against the hands.',
  'PFR c-bet selection':
    'Hero mis-selects which flops to c-bet as the raiser — firing air into a multiway field where the fold equity a bluff needs is not there. Test this against the board and the number of players, not a c-bet rate.',
  'Caller aggression':
    'Hero never takes the lead as the caller — no donks, no check-raises where they are warranted. Test this against the hands.',
  'River bluffing':
    'Hero under-bluffs rivers and, when bluffing, mis-selects the hand. Test this against the hands.',
  'River value / bluff-catch':
    'Hero’s river value bets and bluff-catches are miscalibrated — thin value left on the table, prices misread. Test this against the hands.',
  'Facing aggression':
    'Hero over-folds to barrels — giving up too readily to a continued bet against a pool that under-bluffs. Test this against the price and hand class, not the result.',
};

export function rubricFor(label: Label): Rubric {
  return RUBRIC[label];
}
