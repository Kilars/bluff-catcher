/**
 * One record per voluntary Hero action: what was on the table when Hero had to
 * decide, and nothing whatever about how it turned out. The omission is the
 * point — a cooler played perfectly loses a stack, a terrible fold costs
 * nothing — so every field here is knowable before the next card comes.
 */

import type { HeroHand } from './hero.ts';
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
  /** Hero was the last preflop raiser. */
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
 * All-in, or all but. A shove is not a chosen size — the stack chose it — so
 * sizing it against the pot buckets a 6x jam with a deliberate overbet, and a
 * bet leaving under a tenth of the resulting pot behind is the same thing.
 * Both carry `sizing: null` rather than a number nobody meant.
 */
function shoved(a: Action): boolean {
  if (a.allIn) return true;
  return a.amount > 0 && a.stackBefore - a.amount < (a.potBefore + a.amount) * 0.1;
}

/**
 * Two different sums, and `Action.to` gets both wrong. On a bet `to` is
 * undefined, so it yields NaN — which then compares false against every
 * threshold and vanishes. On a raise it includes the call, so a raise to 300
 * over a 100 bet into a 100 pot reads 1.00 against a true 0.67. Hence
 * `amount / potBefore` for a bet and `raiseBy / (potBefore + toCall)` for a
 * raise, with no fallback when `raiseBy` is absent.
 */
function sizing(a: Action): number | null {
  if (a.kind === 'bet') return a.potBefore > 0 ? a.amount / a.potBefore : null;
  if (a.kind !== 'raise' || a.raiseBy === undefined) return null;
  const pot = a.potBefore + a.toCall;
  return pot > 0 ? a.raiseBy / pot : null;
}

/**
 * The bet Hero faced, on the same scale as `sizing`: villain's `toCall` over the
 * pot *before* that bet, which is `potBefore - toCall` since `potBefore` already
 * counts it. Null unless a bet is genuinely faced with a pre-bet pot to measure
 * against — a limp-into-empty edge returns null rather than a divide-by-zero.
 */
function facedSizing(all: Action[], a: Action): number | null {
  if (!facedBet(all, a)) return null;
  const prePot = a.potBefore - a.toCall;
  return prePot > 0 && a.toCall > 0 ? a.toCall / prePot : null;
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
      facedSizing: facedSizing(s.allActions, a),
      allIn: shoved(a),
    })),
  );
}
