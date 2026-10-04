/**
 * The low-stakes read on the cash 4-bet charts: which value 4-bets still call
 * a 5-bet jam when the jammer has no bluffs. Pure, no UI imports.
 *
 * ── Why ───────────────────────────────────────────────────────────────────
 * The source splits 4-bets by its own answer to a jam: call it and the hand is
 * value, fold and it is a bluff. That answer assumes a balanced jammer, who
 * also jams JJ, AQs and a few suited-ace bluffs. A low-stakes pool's 5-bet jam
 * is value only. Against that, TT has ~36% and needs ~37%, and AQs has ~29%:
 * calling with them is a leak the chart teaches.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 * Not a hand list. Each value 4-bet is priced:
 *
 *   price  = what hero calls / the pot after calling
 *          = (stack − hero's 4-bet) / (2 × stack + dead blinds)
 *   equity = hero's all-in equity against `POPULATION_JAM`
 *
 * and keeps calling only while equity ≥ price. One that falls short still
 * 4-bets — the chart's 4-bet/call/fold lines are untouched — but folds to the
 * jam, so it is graded and coloured as a bluff. Nothing is promoted.
 *
 * Where a chart covers several 3-bettors (open vs 3-bet), the cheapest price
 * of them is used: a hand is flagged only if calling loses against every seat.
 * (AKo, for one, is a small loser against an in-position jam but not against
 * a blind's, so it stays value.)
 *
 * ── The numbers ───────────────────────────────────────────────────────────
 * `JAM_EQUITY` is vendored from `research/population-jam-equity.json`, which
 * `research/population-jam-equity.py` writes; `lowStakes.test.ts` checks the
 * two agree and that every cash value 4-bet has a number.
 */

import type { HandClass } from './hands.ts';
import type { FourBetChart } from './facing.ts';

/** Who the drill assumes is across the table: a low-stakes pool, or the solver's balanced player. */
export const OPPONENTS = ['low', 'balanced'] as const;
export type Opponents = (typeof OPPONENTS)[number];

/** Menu label and note per read, shared by the desktop menu and the phone sheet. */
export const OPPONENTS_META: Record<Opponents, { label: string; note: string }> = {
  low: { label: 'Low stakes', note: '5-bet jams are QQ+, AK · fewer hands call them' },
  balanced: { label: 'Balanced', note: 'The solver chart as solved' },
};

/** The low-stakes 5-bet jam, as the copy writes it. */
export const POPULATION_JAM = 'QQ+, AK';

/** Effective stack the cash charts are solved at, in bb. */
export const CASH_STACK_BB = 100;

/** Hero's all-in equity (%) against `POPULATION_JAM`, per value 4-bet. */
export const JAM_EQUITY: Partial<Record<HandClass, number>> = {
  AA: 84.1,
  KK: 57.2,
  QQ: 40.2,
  JJ: 36.2,
  TT: 36.4,
  AKs: 41.9,
  AKo: 38.8,
  AQs: 28.6,
};

/**
 * The equity (%) hero needs to call a jam after 4-betting to `fourBetBb`,
 * with `deadBb` of folded blinds in the pot.
 */
export function jamPrice(fourBetBb: number, deadBb: number, stackBb = CASH_STACK_BB): number {
  return (100 * (stackBb - fourBetBb)) / (2 * stackBb + deadBb);
}

/**
 * A cash 4-bet chart re-split for a value-only jammer. `price` is the
 * cheapest jam price (%) across the chart's 3-bettors. A chart without a
 * value/bluff split (40bb, where the 4-bet is the jam) comes back unchanged.
 */
export function lowStakesChart(chart: FourBetChart, price: number): FourBetChart {
  const { fourBet } = chart;
  if (!('value' in fourBet)) return chart;
  const value = new Set<HandClass>();
  const bluff = new Set<HandClass>(fourBet.bluff);
  for (const hc of fourBet.value) {
    const eq = JAM_EQUITY[hc];
    if (eq === undefined) throw new Error(`No jam equity for ${hc}: re-run research/population-jam-equity.py`);
    (eq >= price ? value : bluff).add(hc);
  }
  return { ...chart, fourBet: { value, bluff } };
}
