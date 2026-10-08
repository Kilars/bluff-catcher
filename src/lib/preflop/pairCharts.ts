/**
 * Every seat-pair chart the sources have, as range-sheet pages: the chart
 * browser's "vs open" and "vs 3-bet" views. Pure, no UI imports.
 *
 * The drills deal a curated handful of spots (`facing.ts`); this lists every
 * hero × raiser pair `range.ts` can answer, so any seat against any seat can be
 * looked up. Nothing is graded here, and no bucket stands in for a seat: each
 * page is the pair's own source chart.
 *
 * Pages group by hero's seat (the seat strip) with one tab per raiser — the
 * opener (vs open) or the 3-bettor (vs 3-bet). Where the source answers
 * several pairs with the very same chart (the cash source does, a lot), the
 * footnote names the other pairs, so a reused chart doesn't read as a solved one.
 *
 * Hands the spot would never deal (`dealtRange`: outside hero's open range)
 * show as "not in range", not as folds, matching what the drills deal.
 */

import type { HandClass } from './hands.ts';
import { CASH_SEATS, POSITIONS, type Format, type TableSeat } from './ranges.ts';
import { chartSignature, facingRange, type RangeNode, type Stack } from './range.ts';
import { chartAction, dealtRange, type FacingAnswer, type FacingChart } from './facing.ts';
import { positionLabel } from './boundary.ts';
import type { CellAction, ChartPage } from './grid.ts';

/** The browser's facing decisions: hero faces an open, or hero opened and faces a 3-bet. */
export type PairNode = Exclude<RangeNode, 'open'>;

/** One source the browser can show pairs from. */
export interface PairSet {
  id: string;
  format: Format;
  stack: Stack;
  /** Strip label, e.g. "100bb". */
  label: string;
  /** The format's name, for the page kicker, e.g. "Cash". */
  name: string;
  /** What the source is limited to, under the stack tab, e.g. "BTN only". */
  note?: string;
  /** The decisions this source has charts for. */
  nodes: readonly PairNode[];
}

export const PAIR_SETS: readonly PairSet[] = [
  { id: 'cash100', format: 'cash', stack: '100bb', label: '100bb', name: 'Cash', nodes: ['vsOpen', 'vs3bet'] },
  { id: 'mtt40', format: 'mtt', stack: '40bb', label: '40bb', name: 'Tournament', nodes: ['vsOpen', 'vs3bet'] },
  // PokerCoaching: BTN vs an open only, with value and bluff 3-bets apart.
  { id: 'mtt50', format: 'mtt', stack: '50bb+', label: '50bb+', name: 'Tournament', note: 'BTN only', nodes: ['vsOpen'] },
];

export function pairSet(id: string): PairSet {
  const set = PAIR_SETS.find((s) => s.id === id);
  if (!set) throw new Error(`no pair set ${id}`);
  return set;
}

/** The set a format opens on: the one with a full seat grid. */
export const DEFAULT_PAIR_SET: Record<Format, string> = { cash: 'cash100', mtt: 'mtt40' };

/** The sources a format has for one decision, in strip order. */
export function pairSetsFor(format: Format, node: PairNode): PairSet[] {
  return PAIR_SETS.filter((s) => s.format === format && s.nodes.includes(node));
}

/**
 * The source for a format, stack and decision, or the format's full grid
 * when that stack has no charts for it (50bb+ has no 3-bet pots).
 */
export function pairSetFor(format: Format, stack: Stack, node: PairNode): string {
  return pairSetsFor(format, node).find((s) => s.stack === stack)?.id ?? DEFAULT_PAIR_SET[format];
}

/** The seats a format seats, in action order, the big blind last. */
export const TABLE: Record<Format, readonly TableSeat[]> = {
  cash: [...CASH_SEATS, 'BB'],
  mtt: [...POSITIONS, 'SB', 'BB'],
};

/** A chart answer as a grid colour. A chart without kinds colours its raises plainly. */
export function answerCellAction({ action, kind }: FacingAnswer): CellAction {
  if (action === '3bet') return kind ?? 'threeBet';
  if (action === '4bet') return kind === 'value' ? 'fourBetValue' : kind === 'bluff' ? 'fourBetBluff' : 'fourBet';
  return action;
}

/**
 * A chart's colour for a hand, or 'none' where the spot never deals it
 * (`dealt`: `dealtRange`; null or absent means every hand is dealt).
 */
export function dealtCellAction(
  dealt: ReadonlySet<HandClass> | null | undefined,
  chart: FacingChart,
  hc: HandClass
): CellAction {
  return dealt && !dealt.has(hc) ? 'none' : answerCellAction(chartAction(chart, hc));
}

/** "CO vs HJ" / "LJ vs CO 3-bet": hero first, then the raiser. */
const pairLabel = (node: PairNode, hero: TableSeat, villain: TableSeat) =>
  `${positionLabel(hero)} vs ${positionLabel(villain)}${node === 'vs3bet' ? ' 3-bet' : ''}`;

/** The page id for a pair, so a caller can open on one. */
export function pairPageId(setId: string, node: PairNode, hero: TableSeat, villain: TableSeat): string {
  return `${setId}-${node}-${hero}-${villain}`;
}

/**
 * Every pair chart a source has for one decision, as pages: hero's seats in
 * action order, each with its raisers in action order. Empty when the source
 * has no charts for the decision.
 */
export function pairChartPages(setId: string, node: PairNode): ChartPage[] {
  const set = pairSet(setId);
  if (!set.nodes.includes(node)) return [];
  const seats = TABLE[set.format];
  const kicker = `${node === 'vsOpen' ? 'Facing an open' : 'Facing a 3-bet'} · ${set.name} · ${set.label}`;

  const found: { hero: TableSeat; villain: TableSeat; chart: FacingChart; sig: string }[] = [];
  for (const hero of seats) {
    for (const villain of seats) {
      if (hero === villain) continue;
      const chart = facingRange({ format: set.format, stack: set.stack, node, hero, villain });
      if (chart) found.push({ hero, villain, chart, sig: chartSignature(chart) });
    }
  }

  return found.map(({ hero, villain, chart, sig }) => {
    const dealt = dealtRange(set.format, set.stack, node, hero, chart);
    const twins = found.filter((f) => f.sig === sig && !(f.hero === hero && f.villain === villain));
    const shown = twins.slice(0, 4).map((t) => pairLabel(node, t.hero, t.villain));
    const more = twins.length > shown.length ? ` and ${twins.length - shown.length} more` : '';
    return {
      id: pairPageId(setId, node, hero, villain),
      tab: positionLabel(villain),
      group: positionLabel(hero),
      kicker,
      title:
        node === 'vsOpen'
          ? `${positionLabel(hero)} vs ${positionLabel(villain)} open`
          : `${positionLabel(hero)} opens, ${positionLabel(villain)} 3-bets`,
      subline: 'Source chart, not graded',
      name: pairLabel(node, hero, villain),
      cellAction: (hc: HandClass) => dealtCellAction(dealt, chart, hc),
      footnote: twins.length
        ? `The source uses this same chart for ${shown.join(', ')}${more}.`
        : undefined,
    };
  });
}
