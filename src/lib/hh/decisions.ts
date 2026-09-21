/**
 * One record per voluntary Hero action: what was on the table when Hero had to
 * decide, and nothing whatever about how it turned out.
 *
 * The omission is the point. The hands that lost are not the hands played
 * worst — a cooler played perfectly loses a stack and a terrible fold costs
 * nothing — so a coach that can see the result will grade the result. Every
 * field here is knowable before the next card comes.
 */

import type { HeroHand } from './hero.ts';
import type { Action, ActionKind, Street } from './parse.ts';

export interface Decision {
  street: Street;
  /** Voluntary kinds only — `fold`, `check`, `call`, `bet` or `raise`. */
  kind: ActionKind;
  position: string;
  /**
   * Hero's starting stack in big blinds, and the only big-blind figure this
   * module may carry: it describes the spot Hero was in, not what the hand
   * paid. 12bb and 80bb are different games; both are facts at the decision.
   */
  stackBB: number;
  /** Stack-to-pot ratio at the start of the street, null when the pot was 0. */
  spr: number | null;
  /** Hero was the last preflop raiser. */
  pfa: boolean;
  /** There was a bet or a raise in front of this action — see `facedBet`. */
  facedBet: boolean;
  /**
   * Sizing as a fraction of the pot, or null when Hero chose no size: a fold,
   * a check, a call, or an all-in (`allIn` tells those apart from the kind).
   */
  sizing: number | null;
  /** Hero was all-in, or as good as — see `shoved`. */
  allIn: boolean;
}

/**
 * Was there a bet or a raise in front of this action?
 *
 * Not `toCall > 0`. Preflop the big blind is a *forced* bet, so that test has
 * the UTG opener facing one in an unopened pot, and every open lands in the
 * "faced a bet" population.
 *
 * Not `StreetPlay.facedBet` either. That one answers "was Hero first to act
 * into a bet", which is false for the commonest way there is to face one:
 * checking out of position and then folding to the c-bet. `facedBetEver` is
 * closer but is per-street and cannot say which of Hero's actions on the
 * street the bet came before.
 *
 * So read the street as printed and look behind the action itself — which is
 * what `allActions` exists for.
 */
function facedBet(all: Action[], a: Action): boolean {
  return all
    .slice(0, all.indexOf(a))
    .some((b) => b.player !== a.player && (b.kind === 'bet' || b.kind === 'raise'));
}

/**
 * All-in, or all but.
 *
 * A shove is not a chosen size — the stack chose it — so sizing it as a
 * fraction of the pot buckets a 6x jam with somebody's deliberate overbet.
 * The same is true a hair short of all-in: a bet that leaves less than a
 * tenth of the resulting pot behind commits the rest anyway, and the leftover
 * chips are an artefact of the stack, not a decision. Both carry the decision
 * with `sizing: null` rather than a number nobody meant.
 */
function shoved(a: Action): boolean {
  if (a.allIn) return true;
  return a.amount > 0 && a.stackBefore - a.amount < (a.potBefore + a.amount) * 0.1;
}

/**
 * Sizing as a fraction of the pot Hero was pricing against. Two different
 * sums, and there is a way to get each of them wrong:
 *
 *  - A **bet** is `amount / potBefore`. Reaching for `Action.to` instead
 *    yields NaN on every bet — `to` is documented "raises only" and is
 *    undefined here — and NaN then propagates silently through any bucketing
 *    that follows, since it compares false against every threshold.
 *  - A **raise** is `raiseBy / (potBefore + toCall)`: the chips put in over
 *    the call, against the pot that exists once the call is made. Using `to`
 *    inflates every bucket, because `to` includes the call — a raise to 300
 *    over a 100 bet into a 100 pot reads 1.00 where the true figure is 0.67.
 *
 * `raiseBy` is the printed increment, so it needs no arithmetic; it is
 * optional on `Action` only because bets do not carry one, and a raise
 * without it is null rather than a guess.
 */
function sizing(a: Action): number | null {
  if (a.kind === 'bet') return a.potBefore > 0 ? a.amount / a.potBefore : null;
  if (a.kind !== 'raise' || a.raiseBy === undefined) return null;
  const pot = a.potBefore + a.toCall;
  return pot > 0 ? a.raiseBy / pot : null;
}

export function decisionsOf(h: HeroHand): Decision[] {
  return h.streets.flatMap((s) =>
    s.actions.map((a) => ({
      street: s.street,
      kind: a.kind,
      position: h.position,
      stackBB: h.stackBB,
      spr: s.spr,
      pfa: h.pfa,
      facedBet: facedBet(s.allActions, a),
      sizing: shoved(a) ? null : sizing(a),
      allIn: shoved(a),
    })),
  );
}
