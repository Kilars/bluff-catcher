/**
 * Facing an open from the button: fold, call or 3-bet. Pure, no UI imports.
 *
 * ── Where these charts come from ──────────────────────────────────────────
 * PokerCoaching's free preflop chart pack (`full-preflop-charts.pdf`, p.6,
 * "Facing RFI: Button") — the same vendor as the RFI charts in `ranges.ts`,
 * but a different pack: **100bb with antes**, 2.5bb open, 3× 3-bet in
 * position. The pack says it applies from ~50bb up, so the drill labels it
 * 50bb+.
 *
 * The source is already pure — one colour per cell, value and bluff 3-bets
 * coloured apart — so nothing here is rounded by us. All six BTN charts were
 * extracted by colour sampling; every chart's value / bluff / call totals
 * match the counts printed under it. The six live in `facingSources.ts`.
 *
 * ── Two charts, not six ───────────────────────────────────────────────────
 * Openers fall into two buckets and hero learns one chart per bucket:
 *
 *   vs Early — UTG, UTG+1          → graded against BTN vs UTG+1
 *   vs Late  — UTG+2, LJ, HJ, CO   → graded against BTN vs LJ
 *
 * Averaged over the six openers that grades ~29 combos (of 1326) differently
 * from the seat's exact chart; `facing.test.ts` pins the per-opener rows. The
 * bucket assignment is a table (`BUCKET_OF`), so giving CO its own chart is a
 * data change, not a code change.
 *
 * ── Depth caveat ──────────────────────────────────────────────────────────
 * Solved at 100bb and stretched *down* to 50bb, which is the direction where
 * 3-bet/flat decisions actually move: towards 50bb, JJ/TT and A5s–A2s drift
 * to 3-bet and the 54s-type flats drop out. None of that is in the chart.
 * Nor are the villain ranges it assumes exactly the ones the RFI drill
 * teaches — don't cross-check the two drills combo for combo.
 *
 * Hands not listed in a chart fold.
 */

import { type HandClass, ALL_169, combosForClass } from './hands.ts';
import type { Position } from './ranges.ts';

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Hero's three options, in order of aggression (keys F / J / K). */
export const FACING_ACTIONS = ['fold', 'call', '3bet'] as const;
export type FacingAction = (typeof FACING_ACTIONS)[number];

/**
 * Why a hand 3-bets. Both kinds grade as the same action; the kind is carried
 * for the verdict text ("Correct — 3-bet (bluff)"), because *why* a hand
 * 3-bets is the lesson.
 */
export type ThreeBetKind = 'value' | 'bluff';

/** A chart's answer for one hand class. `kind` is set only for a 3-bet. */
export interface FacingAnswer {
  action: FacingAction;
  kind?: ThreeBetKind;
}

// ─── Openers and buckets ──────────────────────────────────────────────────────

/** The seats that can open into the button. A subset of `Position`. */
export const OPENERS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO'] as const satisfies readonly Position[];
export type Opener = (typeof OPENERS)[number];

export const BUCKETS = ['early', 'late'] as const;
export type Bucket = (typeof BUCKETS)[number];

/**
 * Which chart each opener is graded against. The first cut sits after UTG+1:
 * that is where UTG+2 opens up enough to bring in value AQs and the A8s–A6s
 * bluffs. A third bucket (CO alone) would be an edit here plus a chart.
 */
export const BUCKET_OF: Record<Opener, Bucket> = {
  UTG: 'early',
  UTG1: 'early',
  UTG2: 'late',
  LJ: 'late',
  HJ: 'late',
  CO: 'late',
};

export interface BucketMeta {
  id: Bucket;
  /** Plaque / tab label, e.g. "vs Early". */
  label: string;
  /** The openers graded against this bucket's chart, in seat order. */
  openers: readonly Opener[];
  /** The source chart this bucket uses: the opener seat it was solved against. */
  chartSeat: Opener;
  /** The source chart's name as the pack prints it, e.g. "BTN vs UTG+1". */
  chartName: string;
  /** One-line range-sheet footnote on where the bucket chart is off. */
  footnote: string;
}

function openersIn(bucket: Bucket): readonly Opener[] {
  return OPENERS.filter((o) => BUCKET_OF[o] === bucket);
}

export const BUCKET_META: Record<Bucket, BucketMeta> = {
  early: {
    id: 'early',
    label: 'vs Early',
    openers: openersIn('early'),
    chartSeat: 'UTG1',
    chartName: 'BTN vs UTG+1',
    footnote: 'UTG is a touch tighter than this.',
  },
  late: {
    id: 'late',
    label: 'vs Late',
    openers: openersIn('late'),
    chartSeat: 'LJ',
    chartName: 'BTN vs LJ',
    footnote: 'vs HJ/CO the exact chart is a bit wider: more suited calls and bluffs.',
  },
};

// ─── Charts ───────────────────────────────────────────────────────────────────

/**
 * One pure facing-open chart: three disjoint sets of hand classes. Anything
 * in none of them folds.
 */
export interface FacingChart {
  value: ReadonlySet<HandClass>;
  bluff: ReadonlySet<HandClass>;
  call: ReadonlySet<HandClass>;
}

/**
 * vs Early — BTN vs UTG+1 (source chart, verbatim).
 *
 * value 34 + bluff 52 + call 116 = 202 combos = 15.2% continue.
 * Offsuit broadways 3-bet as *bluffs* here: they block the top of a tight
 * range and play badly as a flat.
 */
export const EARLY: FacingChart = {
  value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AKo']),
  bluff: new Set<HandClass>(['A5s', 'A4s', 'A3s', 'A2s', 'AQo', 'AJo', 'KQo']),
  call: new Set<HandClass>([
    'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
    'AQs', 'AJs', 'ATs',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs', 'J9s',
    'T9s', '98s', '87s', '76s',
  ]),
};

/**
 * vs Late — BTN vs LJ (source chart, verbatim).
 *
 * value 50 + bluff 60 + call 140 = 250 combos = 18.9% continue.
 * AQ joins the value range, AJo/KQo become flats, and the bluffs move down
 * the suited aces (A8s–A2s) and pick up 65s/54s.
 */
export const LATE: FacingChart = {
  value: new Set<HandClass>(['AA', 'KK', 'QQ', 'AKs', 'AQs', 'AKo', 'AQo']),
  bluff: new Set<HandClass>([
    'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
    '65s', '54s',
    'ATo', 'KJo',
  ]),
  call: new Set<HandClass>([
    'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
    'AJs', 'ATs', 'A9s',
    'KQs', 'KJs', 'KTs',
    'QJs', 'QTs',
    'JTs', 'J9s',
    'T9s', '98s', '87s', '76s',
    'AJo', 'KQo',
  ]),
};

/** The chart each bucket is graded against. */
export const BUCKET_CHART: Record<Bucket, FacingChart> = {
  early: EARLY,
  late: LATE,
};

// ─── Lookups ──────────────────────────────────────────────────────────────────

/** A chart's answer for a hand class: 3-bet (with kind), call, or fold. */
export function chartAction(chart: FacingChart, hc: HandClass): FacingAnswer {
  if (chart.value.has(hc)) return { action: '3bet', kind: 'value' };
  if (chart.bluff.has(hc)) return { action: '3bet', kind: 'bluff' };
  if (chart.call.has(hc)) return { action: 'call' };
  return { action: 'fold' };
}

/** The bucket chart's answer for a hand class. */
export function bucketChartAction(bucket: Bucket, hc: HandClass): FacingAnswer {
  return chartAction(BUCKET_CHART[bucket], hc);
}

/** The graded answer when `opener` opens and hero holds `hc` on the button. */
export function facingAction(opener: Opener, hc: HandClass): FacingAnswer {
  return bucketChartAction(BUCKET_OF[opener], hc);
}

export interface FacingComboCounts {
  value: number;
  bluff: number;
  call: number;
  fold: number;
}

/** Combo totals per answer, as printed under each source chart. Sums to 1326. */
export function facingComboCounts(chart: FacingChart): FacingComboCounts {
  const counts: FacingComboCounts = { value: 0, bluff: 0, call: 0, fold: 0 };
  for (const hc of ALL_169) {
    const { action, kind } = chartAction(chart, hc);
    counts[action === '3bet' ? kind! : action] += combosForClass(hc);
  }
  return counts;
}
