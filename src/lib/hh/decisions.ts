/**
 * One record per voluntary Hero action: what was on the table when Hero had to
 * decide, and nothing whatever about how it turned out. The omission is the
 * point — a cooler played perfectly loses a stack, a terrible fold costs
 * nothing — so every field here is knowable before the next card comes.
 */

import type { HeroHand, StreetPlay } from './hero.ts';
import type { Action, ActionKind, Street } from './parse.ts';

export interface Decision {
  street: Street;
  /** Voluntary kinds only — `fold`, `check`, `call`, `bet` or `raise`. */
  kind: ActionKind;
  position: string;
  /** Starting stack in big blinds — the only big-blind figure this module carries. */
  stackBB: number;
  /** Null when the pot was 0. */
  spr: number | null;
  /** Hero is the preflop aggressor (`HeroHand.preflopRaiser`). */
  pfa: boolean;
  facedBet: boolean;
  /** Fraction of the pot; null when Hero chose no size. */
  sizing: number | null;
  /**
   * The bet Hero *faced*, as a fraction of the pot before that bet went in —
   * the same scale `sizing` uses, so a pot-sized bet reads 1.0 from either
   * seat. Null when Hero was not facing a bet. `potBefore` already contains the
   * bet, so the pre-bet pot is `potBefore - toCall`.
   */
  facedSizing: number | null;
  allIn: boolean;
}

/**
 * Two wrong answers to guard against. `toCall > 0` counts the forced big blind,
 * so every UTG open reads as facing a bet. `StreetPlay.facedBet` means "first
 * to act into one", missing the check-then-fold that is the commonest way to
 * face a c-bet; `facedBetEver` is per-street and cannot say which action the
 * bet preceded. So read the street as printed — that is what `allActions` is for.
 */
function facedBet(all: Action[], a: Action): boolean {
  return all
    .slice(0, all.indexOf(a))
    .some((b) => b.player !== a.player && (b.kind === 'bet' || b.kind === 'raise'));
}

/**
 * Chips of a bet or raise that no opponent still in can match — they can only
 * come back uncalled (see `Action.coverBehind`). Zero when someone covers it.
 */
function uncallable(a: Action): number {
  return Math.max(0, -(a.coverBehind ?? 0));
}

/**
 * All-in, or all but. A shove is not a chosen size — the stack chose it — so
 * sizing it against the pot buckets a 6x jam with a deliberate overbet, and a
 * bet leaving under a tenth of the resulting pot behind is the same thing.
 * "Behind" is the smaller of the bettor's stack and the deepest opponent's, so
 * a bet that puts every live opponent all-in is one too, whatever its size:
 * nobody chose that number either. All carry `sizing: null` rather than a
 * number nobody meant. Exported so bigSpots and the labels read the one rule.
 */
export function shoved(a: Action): boolean {
  if (a.allIn) return true;
  if (a.amount <= 0) return false;
  const behind = Math.min(a.stackBefore - a.amount, a.coverBehind ?? Infinity);
  return behind < (a.potBefore + a.amount - uncallable(a)) * 0.1;
}

/**
 * Two different sums, and `Action.to` gets both wrong. On a bet `to` is
 * undefined, so it yields NaN — which then compares false against every
 * threshold and vanishes. On a raise it includes the call, so a raise to 300
 * over a 100 bet into a 100 pot reads 1.00 against a true 0.67. Hence
 * `amount / potBefore` for a bet and `raiseBy / (potBefore + toCall)` for a
 * raise, with no fallback when `raiseBy` is absent.
 *
 * Either is sized at what an opponent can call: the uncallable part of a bet
 * bigger than every live stack comes off, so a jam of $45 into $37 against $34
 * behind is the 0.93-pot bet it could be called for, not 1.23.
 */
export function sizing(a: Action): number | null {
  const unc = uncallable(a);
  if (a.kind === 'bet') return a.potBefore > 0 ? (a.amount - unc) / a.potBefore : null;
  if (a.kind !== 'raise' || a.raiseBy === undefined) return null;
  const pot = a.potBefore + a.toCall;
  return pot > 0 ? Math.max(0, a.raiseBy - unc) / pot : null;
}

/**
 * The pot an action can win: `potBefore` less any chips above the actor's whole
 * stack (see `Action.potCallable`). Every price — pot odds, faced sizing, MDF —
 * reads this, not `potBefore`; a call all-in for less against an overbet is
 * otherwise priced as though the uncallable excess were Hero's to win.
 */
export function callablePot(a: Action): number {
  return a.potCallable ?? a.potBefore;
}

/** Pot odds on a call: the share of the pot Hero can win that the call buys, toCall / (pot + toCall). */
export function potOdds(a: Action): number {
  return a.toCall / (callablePot(a) + a.toCall);
}

/**
 * The bet Hero faced, on the same scale as `sizing`: villain's `toCall` over the
 * pot *before* that bet, which is `potBefore - toCall` since `potBefore` already
 * counts it. Null unless a bet is genuinely faced with a pre-bet pot to measure
 * against — a limp-into-empty edge returns null rather than a divide-by-zero.
 * Read off `callablePot`, so a shove bigger than Hero's stack is sized at what
 * Hero can call, not at what was pushed in.
 */
function facedSizing(all: Action[], a: Action): number | null {
  if (!facedBet(all, a)) return null;
  const prePot = callablePot(a) - a.toCall;
  return prePot > 0 && a.toCall > 0 ? a.toCall / prePot : null;
}

/** The decision record for one of Hero's actions on street `s`. */
export function decisionOf(h: HeroHand, s: StreetPlay, a: Action): Decision {
  const allIn = shoved(a);
  return {
    street: s.street,
    kind: a.kind,
    position: h.position,
    stackBB: h.stackBB,
    spr: s.spr,
    pfa: h.pfa,
    facedBet: facedBet(s.allActions, a),
    sizing: allIn ? null : sizing(a),
    facedSizing: facedSizing(s.allActions, a),
    allIn,
  };
}

export function decisionsOf(h: HeroHand): Decision[] {
  return h.streets.flatMap((s) => s.actions.map((a) => decisionOf(h, s, a)));
}
