/**
 * PLAN-coach.md §3 deferred `lines.ts`, now built: a compact, blind action line
 * for one hand up to the street Hero decided on. Reviews found that a bare
 * "checked a draw" is street-context-free — a check into a 75% c-bet reads the
 * same as a check that ended the street, and a trap (bet/call pre, check flop)
 * reads the same as passivity (limp, face c-bet, check). The sequence is what
 * tells them apart, so the model gets it.
 *
 * Blind by construction: sizes are pot-fractions, never chips; blinds and antes
 * carry no letter; no result and no villain cards can appear. Hero's actions are
 * upper-case, villains' lower-case. Streets are joined by " / ".
 *
 *   "B33/c / X b75" = Hero c-bet a third, villain called; turn Hero checked and
 *   faced a 75% bet.
 */

import type { HeroHand } from './hero.ts';
import type { Action, Street } from './parse.ts';

const SEQ: readonly Street[] = ['preflop', 'flop', 'turn', 'river'];

const LETTER: Partial<Record<Action['kind'], string>> = {
  fold: 'f',
  check: 'x',
  call: 'c',
  bet: 'b',
  raise: 'r',
};

/** Bet/raise size as a whole-number pot percentage; empty for the rest. */
function sizeTag(a: Action): string {
  if (a.kind === 'bet') return a.potBefore > 0 ? `${Math.round((a.amount / a.potBefore) * 100)}` : '';
  if (a.kind === 'raise' && a.raiseBy !== undefined) {
    const pot = a.potBefore + a.toCall;
    return pot > 0 ? `${Math.round((a.raiseBy / pot) * 100)}` : '';
  }
  return '';
}

function token(a: Action, isHero: boolean): string | null {
  const l = LETTER[a.kind];
  if (!l) return null; // blinds and antes are not decisions
  const t = `${l}${sizeTag(a)}`;
  return isHero ? t.toUpperCase() : t;
}

/**
 * The line for streets up to and including `upTo`. On the decision street the
 * render stops at Hero's LAST action: a villain bet *before* it is the faced-bet
 * context we want, but a villain response *after* it is the result — a fold means
 * Hero won the pot, and coaching may never see that. Earlier streets render whole,
 * because the hand continued past them, so they carry no terminal response.
 */
export function actionLine(h: HeroHand, upTo: Street): string {
  // `StreetPlay.actions` is Hero's alone, so its players name Hero's seat(s).
  const hero = new Set(h.streets.flatMap((s) => s.actions.map((a) => a.player)));
  const limit = SEQ.indexOf(upTo);
  const segments: string[] = [];
  for (const play of h.streets) {
    if (SEQ.indexOf(play.street) > limit) break;
    let acts = play.allActions;
    if (play.street === upTo) {
      let last = -1;
      for (let i = 0; i < acts.length; i++) if (hero.has(acts[i].player)) last = i;
      if (last >= 0) acts = acts.slice(0, last + 1);
    }
    const toks = acts.map((a) => token(a, hero.has(a.player))).filter((t): t is string => t !== null);
    if (toks.length) segments.push(toks.join(''));
  }
  return segments.join(' / ');
}
