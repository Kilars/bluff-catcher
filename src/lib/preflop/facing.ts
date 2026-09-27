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
import type { Format, Position, Seat } from './ranges.ts';
import { CASH_VS_CO, CASH_VS_EARLY, type CashOpener } from './cashRanges.ts';
import {
  BB_CASH_CHARTS,
  BB_CASH_OPENERS,
  BB_MTT_CHARTS,
  BB_MTT_OPENERS,
  type BbCashOpener,
  type BbMttOpener,
} from './bbDefendRanges.ts';

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

/**
 * Which facing drill a chart belongs to: hero on the button facing an open
 * (docs/PLAN-3bet.md), or hero in the big blind (docs/PLAN-bb-defend.md).
 */
export type Drill = 'btn' | 'bb';

/**
 * The BTN drill's charts, across both formats. The tournament buckets come
 * first so `bucketsFor('mtt')` is exactly the pair the dealer has always
 * picked from (golden.test.ts pins the deals).
 */
const BTN_BUCKETS = ['early', 'late', 'cashEarly', 'cashCo'] as const;

/** The BB drill grades each opener against its own chart: one bucket per opener. */
export type BbBucket = `bb-mtt-${BbMttOpener}` | `bb-cash-${BbCashOpener}`;

const BB_BUCKETS: readonly BbBucket[] = [
  ...BB_MTT_OPENERS.map((o) => `bb-mtt-${o}` as const),
  ...BB_CASH_OPENERS.map((o) => `bb-cash-${o}` as const),
];

/** Every chart either drill grades against. */
export type Bucket = (typeof BTN_BUCKETS)[number] | BbBucket;
export const BUCKETS: readonly Bucket[] = [...BTN_BUCKETS, ...BB_BUCKETS];

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

/**
 * The one opener → bucket map per format. Cash (6-max): only LJ, HJ and CO
 * can open into the button, and the source uses one chart for vs LJ and vs
 * HJ, so bucketing adds no error on top of it.
 */
export const BUCKET_OF_IN: Record<Format, Partial<Record<Opener, Bucket>>> = {
  mtt: BUCKET_OF,
  cash: { LJ: 'cashEarly', HJ: 'cashEarly', CO: 'cashCo' } satisfies Record<CashOpener, Bucket>,
};

/** The bucket an opener is graded against in a format (BTN drill). */
export function bucketFor(format: Format, opener: Opener): Bucket {
  const bucket = BUCKET_OF_IN[format][opener];
  if (!bucket) throw new Error(`${opener} cannot open into the button in 6-max`);
  return bucket;
}

/** A drill's buckets in a format, in the order the dealer picks from. */
export function bucketsFor(format: Format, drill: Drill = 'btn'): readonly Bucket[] {
  return BUCKETS.filter((b) => BUCKET_META[b].format === format && BUCKET_META[b].drill === drill);
}

export interface BucketMeta {
  id: Bucket;
  drill: Drill;
  format: Format;
  /** Stack figure for the plaques and labels, e.g. "50bb+". */
  stackLabel: string;
  /** Plaque / tab label, e.g. "vs Early". */
  label: string;
  /** The openers graded against this bucket's chart, in seat order. */
  openers: readonly Seat[];
  /** The source chart this bucket uses: the opener seat it was solved against. */
  chartSeat: Seat;
  /** The open size hero faces, in bb. */
  raiseBb: number;
  /** The source chart's name as the pack prints it, e.g. "BTN vs UTG+1". */
  chartName: string;
  /** One-line range-sheet footnote on where the bucket chart is off. */
  footnote?: string;
}

function openersIn(format: Format, bucket: Bucket): readonly Opener[] {
  return OPENERS.filter((o) => BUCKET_OF_IN[format][o] === bucket);
}

/**
 * The BB drill's opens (source metadata, docs/PLAN-bb-defend.md "Source"):
 * tournament 2.3bb at 40bb with the SB raising to 3.5bb; cash 2.5bb, SB 3bb.
 */
const BB_RAISE_BB: Record<Format, { open: number; sb: number }> = {
  mtt: { open: 2.3, sb: 3.5 },
  cash: { open: 2.5, sb: 3 },
};

/** "UTG+1" etc. — kept local so this module stays free of display imports. */
const SEAT_NAME: Record<Seat, string> = {
  UTG: 'UTG', UTG1: 'UTG+1', UTG2: 'UTG+2', LJ: 'LJ', HJ: 'HJ', CO: 'CO', BTN: 'BTN', SB: 'SB',
};

function bbMeta(format: Format, openers: readonly (BbMttOpener | BbCashOpener)[]) {
  const stackLabel = format === 'mtt' ? '40bb' : '100bb';
  return Object.fromEntries(
    openers.map((o) => {
      const id = `bb-${format}-${o}` as BbBucket;
      const meta: BucketMeta = {
        id,
        drill: 'bb',
        format,
        stackLabel,
        label: `vs ${SEAT_NAME[o]}`,
        openers: [o],
        chartSeat: o,
        raiseBb: o === 'SB' ? BB_RAISE_BB[format].sb : BB_RAISE_BB[format].open,
        chartName: `BB vs ${SEAT_NAME[o]} (${format === 'mtt' ? '40bb' : 'cash'})`,
      };
      return [id, meta];
    })
  );
}

export const BUCKET_META: Record<Bucket, BucketMeta> = {
  early: {
    id: 'early',
    drill: 'btn',
    format: 'mtt',
    stackLabel: '50bb+',
    label: 'vs Early',
    openers: openersIn('mtt', 'early'),
    chartSeat: 'UTG1',
    raiseBb: 2.5,
    chartName: 'BTN vs UTG+1',
    footnote: 'UTG is a touch tighter than this.',
  },
  late: {
    id: 'late',
    drill: 'btn',
    format: 'mtt',
    stackLabel: '50bb+',
    label: 'vs Late',
    openers: openersIn('mtt', 'late'),
    chartSeat: 'LJ',
    raiseBb: 2.5,
    chartName: 'BTN vs LJ',
    footnote: 'vs HJ/CO the exact chart is a bit wider: more suited calls and bluffs.',
  },
  cashEarly: {
    id: 'cashEarly',
    drill: 'btn',
    format: 'cash',
    stackLabel: '100bb',
    label: 'vs LJ/HJ',
    openers: openersIn('cash', 'cashEarly'),
    chartSeat: 'LJ',
    raiseBb: 2.5,
    chartName: 'BTN vs LJ/HJ (cash)',
    footnote: 'The source uses one chart for LJ and HJ. Flats are the simplified chart’s: 66–99, A9s, A8s, QTs, JTs.',
  },
  cashCo: {
    id: 'cashCo',
    drill: 'btn',
    format: 'cash',
    stackLabel: '100bb',
    label: 'vs CO',
    openers: openersIn('cash', 'cashCo'),
    chartSeat: 'CO',
    raiseBb: 2.5,
    chartName: 'BTN vs CO (cash)',
    footnote: 'Same flats as vs LJ/HJ; only 3-bets are added.',
  },
  ...bbMeta('mtt', BB_MTT_OPENERS),
  ...bbMeta('cash', BB_CASH_OPENERS),
} as Record<Bucket, BucketMeta>;

// ─── Charts ───────────────────────────────────────────────────────────────────

/**
 * One pure facing-open chart: disjoint sets of hand classes, anything in none
 * of them folds. A tournament chart splits its 3-bets into value and bluff; a
 * cash chart's source does not, so it holds one plain `threeBet` set and never
 * claims a kind.
 */
export interface KindedChart {
  value: ReadonlySet<HandClass>;
  bluff: ReadonlySet<HandClass>;
  call: ReadonlySet<HandClass>;
}

export interface PlainChart {
  threeBet: ReadonlySet<HandClass>;
  call: ReadonlySet<HandClass>;
}

export type FacingChart = KindedChart | PlainChart;

/** Whether a chart splits its 3-bets into value and bluff. */
export function hasKinds(chart: FacingChart): chart is KindedChart {
  return 'value' in chart;
}

/**
 * vs Early — BTN vs UTG+1 (source chart, verbatim).
 *
 * value 34 + bluff 52 + call 116 = 202 combos = 15.2% continue.
 * Offsuit broadways 3-bet as *bluffs* here: they block the top of a tight
 * range and play badly as a flat.
 */
export const EARLY: KindedChart = {
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
export const LATE: KindedChart = {
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
export const BUCKET_CHART = {
  early: EARLY,
  late: LATE,
  cashEarly: CASH_VS_EARLY,
  cashCo: CASH_VS_CO,
  ...Object.fromEntries(BB_MTT_OPENERS.map((o) => [`bb-mtt-${o}`, BB_MTT_CHARTS[o]])),
  ...Object.fromEntries(BB_CASH_OPENERS.map((o) => [`bb-cash-${o}`, BB_CASH_CHARTS[o]])),
} as Record<Bucket, FacingChart>;

/** The BB drill's bucket for an opener: each opener has its own chart. */
export function bbBucketFor(format: Format, opener: Seat): BbBucket {
  const bucket = `bb-${format}-${opener}`;
  if (!(bucket in BUCKET_CHART)) throw new Error(`${opener} is not a BB-defence opener in ${format}`);
  return bucket as BbBucket;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

/** A chart's answer for a hand class: 3-bet (with kind, if the chart has kinds), call, or fold. */
export function chartAction(chart: FacingChart, hc: HandClass): FacingAnswer {
  if (hasKinds(chart)) {
    if (chart.value.has(hc)) return { action: '3bet', kind: 'value' };
    if (chart.bluff.has(hc)) return { action: '3bet', kind: 'bluff' };
  } else if (chart.threeBet.has(hc)) {
    return { action: '3bet' };
  }
  if (chart.call.has(hc)) return { action: 'call' };
  return { action: 'fold' };
}

/** The bucket chart's answer for a hand class. */
export function bucketChartAction(bucket: Bucket, hc: HandClass): FacingAnswer {
  return chartAction(BUCKET_CHART[bucket], hc);
}

/** The graded answer when `opener` opens and hero holds `hc` on the button (tournament). */
export function facingAction(opener: Opener, hc: HandClass): FacingAnswer {
  return bucketChartAction(BUCKET_OF[opener], hc);
}


/**
 * Combo totals per answer, as printed under each source chart; sums to 1326.
 * A kinded chart reports value and bluff, a plain one a single threeBet.
 */
export type FacingComboCounts = { call: number; fold: number } & (
  | { value: number; bluff: number }
  | { threeBet: number }
);

export function facingComboCounts(chart: FacingChart): FacingComboCounts {
  const counts: Record<string, number> = hasKinds(chart)
    ? { value: 0, bluff: 0, call: 0, fold: 0 }
    : { threeBet: 0, call: 0, fold: 0 };
  for (const hc of ALL_169) {
    const { action, kind } = chartAction(chart, hc);
    counts[action === '3bet' ? (kind ?? 'threeBet') : action] += combosForClass(hc);
  }
  return counts as FacingComboCounts;
}
