/**
 * browserAxes — the chart browser's menu as data: the rows it shows, which
 * tabs in each row apply to what's picked above, and how one pick repairs the
 * picks below it. Pure, no React, so every way of picking (a tap now, a slice
 * through the rows later) goes through one set of rules (docs/PLAN-slice-menu.md).
 *
 * Rows, top to bottom: Format · Spot · Stack (tournament only) · Your seat ·
 * Versus. Within a format the rows and their tabs never change; a tab that
 * doesn't apply is disabled, not removed. Your seat and Versus list the same
 * table in the same order, so their columns line up.
 */

import {
  CHART_META,
  DEFAULT_DEPTH,
  chartKeyFor,
  type ChartKey,
  type Depth,
  type Format,
  type Seat,
  type TableSeat,
} from './ranges.ts';
import type { Stack } from './range.ts';
import type { ChartPage } from './grid.ts';
import { TABLE, pairChartPages, pairPageId, pairSet, pairSetFor, pairSetsFor, type PairNode } from './pairCharts.ts';

/** The spot row: the decision a chart is for. Drill is a trainer's own charts. */
export type SpotKind = 'drill' | 'open' | '3bet' | '4bet';
type LiveSpot = Exclude<SpotKind, 'drill'>;

/** The tournament stack row, shallow to deep: the RFI tiers and the pair packs in one. */
export const STACKS = ['10bb', '20bb', '40bb', '50bb+', '60bb+'] as const;
export type StackId = (typeof STACKS)[number];

const STACK_DEPTH: Partial<Record<StackId, Depth>> = { '10bb': 'short', '20bb': 'mid', '60bb+': 'deep' };
const STACK_PAIR: Partial<Record<StackId, Stack>> = { '40bb': '40bb', '50bb+': '50bb+' };
const DEPTH_STACK: Record<Depth, StackId> = { deep: '60bb+', mid: '20bb', short: '10bb' };

/** 3-bet is hero facing an open; 4-bet is hero's open facing a 3-bet. */
export const SPOT_NODE: Record<'3bet' | '4bet', PairNode> = { '3bet': 'vsOpen', '4bet': 'vs3bet' };
export const NODE_SPOT: Record<PairNode, '3bet' | '4bet'> = { vsOpen: '3bet', vs3bet: '4bet' };

export interface Axes {
  /** Whether a trainer's charts exist, so Drill is a spot at all. */
  drill: boolean;
  format: Format;
  spot: SpotKind;
  /**
   * The tournament stack each spot is on, so a trip to 4-bet (40bb only) or to
   * cash and back finds 3-bet still on 50bb+ and Open on its tier.
   */
  stacks: Record<LiveSpot, StackId>;
  hero: TableSeat;
  /** The raiser hero faces. Kept while on Open, where it doesn't apply. */
  villain: TableSeat | null;
}

export type Row = 'format' | 'spot' | 'stack' | 'seat' | 'versus';

export function nodeOf(spot: SpotKind): PairNode | null {
  return spot === '3bet' || spot === '4bet' ? SPOT_NODE[spot] : null;
}

/** The RFI chart Open shows. */
export function chartKeyOf(a: Axes): ChartKey {
  return chartKeyFor(a.format, STACK_DEPTH[a.stacks.open] ?? DEFAULT_DEPTH);
}

/** The pair source a facing spot shows, or null on Open and Drill. */
export function setIdOf(a: Axes): string | null {
  const node = nodeOf(a.spot);
  if (!node) return null;
  const stack = a.format === 'mtt' ? (STACK_PAIR[a.stacks[a.spot as LiveSpot]] ?? '40bb') : '100bb';
  return pairSetFor(a.format, stack, node);
}

// Building a source's pages reads every pair's chart, so each list is built once.
const pagesCache = new Map<string, ChartPage[]>();
const pairsCache = new Map<string, { hero: TableSeat; villain: TableSeat }[]>();

/** A source's pages for one decision, built once and shared (a stable identity). */
export function pairPagesOf(setId: string, node: PairNode): ChartPage[] {
  const key = `${setId}-${node}`;
  let pages = pagesCache.get(key);
  if (!pages) {
    pages = pairChartPages(setId, node);
    pagesCache.set(key, pages);
  }
  return pages;
}

/** The pairs behind `pairPagesOf`, in page order. */
export function pairsOf(setId: string, node: PairNode): { hero: TableSeat; villain: TableSeat }[] {
  const key = `${setId}-${node}`;
  let pairs = pairsCache.get(key);
  if (!pairs) {
    const ids = new Set(pairPagesOf(setId, node).map((p) => p.id));
    const seats = TABLE[pairSet(setId).format];
    pairs = seats.flatMap((hero) =>
      seats.filter((villain) => ids.has(pairPageId(setId, node, hero, villain))).map((villain) => ({ hero, villain }))
    );
    pairsCache.set(key, pairs);
  }
  return pairs;
}

/** Every tab a row has in a format, applicable or not. Empty: the row isn't shown. */
export function rowTabs(format: Format, row: Row, drill = false): readonly string[] {
  switch (row) {
    case 'format':
      return ['mtt', 'cash'];
    case 'spot':
      return drill ? ['drill', 'open', '3bet', '4bet'] : ['open', '3bet', '4bet'];
    case 'stack':
      return format === 'mtt' ? STACKS : [];
    case 'seat':
    case 'versus':
      return TABLE[format];
  }
}

/** The tabs in a row that apply to what's picked above it. */
export function enabled(a: Axes, row: Row): ReadonlySet<string> {
  if (row === 'format' || row === 'spot') return new Set(rowTabs(a.format, row, a.drill));
  if (a.spot === 'drill') return new Set();
  const node = nodeOf(a.spot);
  if (row === 'stack') {
    if (a.format !== 'mtt') return new Set();
    if (!node) return new Set(Object.values(DEPTH_STACK));
    return new Set(pairSetsFor('mtt', node).map((s) => STACKS.find((id) => STACK_PAIR[id] === s.stack)!));
  }
  if (!node) return row === 'seat' ? new Set<string>(CHART_META[chartKeyOf(a)].seats) : new Set();
  const pairs = pairsOf(setIdOf(a)!, node);
  return new Set(row === 'seat' ? pairs.map((p) => p.hero) : pairs.filter((p) => p.hero === a.hero).map((p) => p.villain));
}

/** The allowed tab nearest `from` along `order`, the later one on a tie. */
function nearest<T extends string>(order: readonly T[], from: T, allowed: ReadonlySet<string>): T | null {
  const i = Math.max(0, order.indexOf(from));
  for (let d = 0; d < order.length; d++) {
    if (i + d < order.length && allowed.has(order[i + d])) return order[i + d];
    if (i - d >= 0 && allowed.has(order[i - d])) return order[i - d];
  }
  return null;
}

/**
 * Moves every pick that no longer applies to the nearest one that does, top
 * down: stack, then your seat, then the raiser (nearest to the old raiser, or
 * to your seat when there was none: the opener just before you, the
 * 3-bettor just after).
 */
function repair(a: Axes): Axes {
  if (a.spot === 'drill') return a;
  let next = a;
  if (a.format === 'mtt') {
    const spot = a.spot as LiveSpot;
    const stacks = enabled(a, 'stack');
    if (!stacks.has(a.stacks[spot])) {
      next = { ...next, stacks: { ...next.stacks, [spot]: nearest(STACKS, a.stacks[spot], stacks)! } };
    }
  }
  const table = TABLE[next.format];
  const hero = nearest(table, next.hero, enabled(next, 'seat'));
  if (hero && hero !== next.hero) next = { ...next, hero };
  if (nodeOf(next.spot)) {
    const villains = enabled(next, 'versus');
    if (!next.villain || !villains.has(next.villain)) {
      next = { ...next, villain: nearest(table, next.villain ?? next.hero, villains) };
    }
  }
  return next;
}

/** A seat the format's table has: the 9-max early seats fold into the 6-max LJ. */
function onTable(seat: TableSeat, format: Format): TableSeat {
  return TABLE[format].includes(seat) ? seat : TABLE[format][0];
}

/**
 * Picks one tab and repairs the rows below it. A tab that doesn't apply is
 * ignored, so a caller can pass any tab it was given.
 */
export function pick(a: Axes, row: Row, id: string): Axes {
  if (!enabled(a, row).has(id)) return a;
  switch (row) {
    case 'format': {
      const format = id as Format;
      return repair({ ...a, format, hero: onTable(a.hero, format), villain: a.villain && onTable(a.villain, format) });
    }
    case 'spot':
      return repair({ ...a, spot: id as SpotKind });
    case 'stack':
      return repair({ ...a, stacks: { ...a.stacks, [a.spot]: id as StackId } });
    case 'seat':
      return repair({ ...a, hero: id as TableSeat });
    case 'versus':
      return { ...a, villain: id as TableSeat };
  }
}

/** One page along the chart order: the next raiser, then the next seat's first. */
export function step(a: Axes, delta: number): Axes {
  const node = nodeOf(a.spot);
  if (!node) {
    const seats = CHART_META[chartKeyOf(a)].seats as readonly TableSeat[];
    const i = seats.indexOf(a.hero);
    const hero = seats[Math.min(seats.length - 1, Math.max(0, i + delta))];
    return hero ? { ...a, hero } : a;
  }
  const pairs = pairsOf(setIdOf(a)!, node);
  const i = pairs.findIndex((p) => p.hero === a.hero && p.villain === a.villain);
  const p = pairs[Math.min(pairs.length - 1, Math.max(0, i + delta))];
  return p ? { ...a, hero: p.hero, villain: p.villain } : a;
}

export interface InitialAxes {
  format: Format;
  /** The RFI tier Open starts on ('cash' means the tournament default). */
  depth: ChartKey;
  drill: boolean;
  /** The dealt pair, which the facing spots start on. */
  spot?: { node: PairNode; setId: string; hero: TableSeat; villain: TableSeat };
}

export function initialAxes({ format, depth, drill, spot }: InitialAxes): Axes {
  const set = spot ? pairSet(spot.setId) : undefined;
  const fmt = set?.format ?? format;
  const tier: Depth = depth === 'cash' ? DEFAULT_DEPTH : depth;
  const stacks: Record<LiveSpot, StackId> = { open: DEPTH_STACK[tier], '3bet': '40bb', '4bet': '40bb' };
  if (set?.format === 'mtt') stacks[NODE_SPOT[spot!.node]] = set.stack as StackId;
  const hero: Seat = CHART_META[chartKeyFor(fmt, tier)].seats[0];
  return repair({
    drill,
    format: fmt,
    spot: drill ? 'drill' : 'open',
    stacks,
    hero: spot?.hero ?? hero,
    villain: spot?.villain ?? null,
  });
}
