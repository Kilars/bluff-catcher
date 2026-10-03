/**
 * The facing drills: hero faces a raise and folds, calls or re-raises. Pure,
 * no UI imports. Four drills share this machinery:
 *   btn  — an open, hero on the button: fold, call or 3-bet (this header)
 *   bb   — an open, hero in the big blind (docs/PLAN-bb-defend.md)
 *   btn4 — hero opened the button, a blind 3-bets: fold, call or 4-bet
 *          (docs/PLAN-btn-4bet.md)
 *   open4 — hero opened from LJ/HJ/CO, a seat behind 3-bets: fold, call or
 *          4-bet, cash only
 *
 * Every chart is read from the sourced dataset through `range.ts`; this file
 * only says which spot each drill bucket grades against.
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
 * match the counts printed under it. The six are `FACING_SOURCES` below.
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
import { CASH_RFI, SEAT_META, type Format, type Position, type TableSeat } from './ranges.ts';
import { requireFacingRange, requireOpenRange, type Stack } from './range.ts';
import { JAM_EQUITY, POPULATION_JAM, jamPrice, lowStakesChart, type Opponents } from './lowStakes.ts';

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Every answer a facing drill grades. A drill offers three of them (keys
 * F / J / K): fold, call, and its own re-raise — a 3-bet facing an open, a
 * 4-bet facing a 3-bet (`BucketMeta.raise`).
 */
export const FACING_ACTIONS = ['fold', 'call', '3bet', '4bet'] as const;
export type FacingAction = (typeof FACING_ACTIONS)[number];

/** The re-raise a drill offers on K. */
export type RaiseAction = Extract<FacingAction, '3bet' | '4bet'>;

/**
 * Why a hand re-raises. Both kinds grade as the same action; the kind is
 * carried for the verdict text ("Correct — 3-bet (bluff)"), because *why* a
 * hand raises is the lesson.
 */
export type ThreeBetKind = 'value' | 'bluff';

/** A chart's answer for one hand class. `kind` is set only for a re-raise. */
export interface FacingAnswer {
  action: FacingAction;
  kind?: ThreeBetKind;
}

// ─── Openers and buckets ──────────────────────────────────────────────────────

/** The seats that can open into the button. A subset of `Position`. */
export const OPENERS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO'] as const satisfies readonly Position[];
export type Opener = (typeof OPENERS)[number];

/** The seats that can open into the button in 6-max. */
export const CASH_OPENERS = ['LJ', 'HJ', 'CO'] as const;
export type CashOpener = (typeof CASH_OPENERS)[number];

/** Seats that can open into the BB at a 9-max tournament table, in action order. */
export const BB_MTT_OPENERS = ['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type BbMttOpener = (typeof BB_MTT_OPENERS)[number];

/** Seats that can open into the BB at a 6-max cash table, in action order. */
export const BB_CASH_OPENERS = ['LJ', 'HJ', 'CO', 'BTN', 'SB'] as const;
export type BbCashOpener = (typeof BB_CASH_OPENERS)[number];

/** The blinds that can 3-bet a button open, in action order. */
export const BTN4_THREE_BETTORS = ['SB', 'BB'] as const;
export type ThreeBettor = (typeof BTN4_THREE_BETTORS)[number];

/** The cash seats that open and can be 3-bet by a seat behind (the BTN has its own drill). */
export const OPEN4_OPENERS = ['LJ', 'HJ', 'CO'] as const;
export type Open4Opener = (typeof OPEN4_OPENERS)[number];

/** The seats behind each opener that can 3-bet it, in action order. */
export const OPEN4_THREE_BETTORS: Record<Open4Opener, readonly ('HJ' | 'CO' | 'BTN' | 'SB' | 'BB')[]> = {
  LJ: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  HJ: ['CO', 'BTN', 'SB', 'BB'],
  CO: ['BTN', 'SB', 'BB'],
};

/**
 * Which facing drill a chart belongs to: hero on the button facing an open
 * (docs/PLAN-3bet.md), or hero in the big blind (docs/PLAN-bb-defend.md).
 */
export type Drill = 'btn' | 'bb' | 'btn4' | 'open4';

/** The open hero faces in the BTN drill (PLAN-3bet: 2.5bb, every opener). */
export const BTN_DRILL_RAISE_BB = 2.5;

/**
 * The BTN drill's charts, across both formats. The tournament buckets come
 * first so `bucketsFor('mtt')` is exactly the pair the dealer has always
 * picked from (golden.test.ts pins the deals).
 */
const BTN_BUCKETS = ['early', 'late', 'cashEarly', 'cashCo'] as const;

/** The BB drill grades each opener against its own chart: one bucket per opener. */
export type BbBucket = `bb-mtt-${BbMttOpener}` | `bb-cash-${BbCashOpener}`;

/** BTN vs 3-bet: one bucket per (format, 3-bettor). */
export type Btn4Bucket = `btn4-${Format}-${ThreeBettor}`;

/** Open vs 3-bet: one bucket per opener, cash only. */
export type Open4Bucket = `open4-cash-${Open4Opener}`;

/**
 * Everything the BB drill's buckets differ by, per format (source metadata,
 * docs/PLAN-bb-defend.md "Source"): tournament 40bb, 2.3bb opens with the SB
 * raising to 3.5bb; cash 100bb, 2.5bb opens, SB 3bb.
 *
 * Each opener gets its exact chart, no buckets: neighbouring openers differ
 * by 74–304 combos (of 1326) at 40bb and 52–176 in cash, so any bucketing
 * would grade hundreds of combos wrong. The source does not split 3-bets into
 * value and bluff, so these are plain charts.
 */
const BB_SOURCE = {
  mtt: { openers: BB_MTT_OPENERS, stack: '40bb', open: 2.3, sbOpen: 3.5 },
  cash: { openers: BB_CASH_OPENERS, stack: '100bb', open: 2.5, sbOpen: 3 },
} as const;

/** One BB bucket per (format, opener): its id, metadata and chart, built in one place. */
const BB_SPOTS = (['mtt', 'cash'] as const).flatMap((format) => {
  const src = BB_SOURCE[format];
  return src.openers.map((o) => {
    const id = `bb-${format}-${o}` as BbBucket;
    const seat = SEAT_META[o].short;
    const meta: BucketMeta = {
      id,
      drill: 'bb',
      format,
      stackLabel: src.stack,
      label: `vs ${seat}`,
      openers: [o],
      chartSeat: o,
      raiseBb: o === 'SB' ? src.sbOpen : src.open,
      hero: 'BB',
      raise: '3bet',
      chartName: `BB vs ${seat} (${format === 'mtt' ? '40bb' : 'cash'})`,
      footnote: 'Pure chart: border hands are likely mixed in the full solve, so they are close.',
    };
    const chart = requireFacingRange({ format, stack: src.stack, node: 'vsOpen', hero: 'BB', villain: o });
    return { id, meta, chart };
  });
});

/**
 * Everything the BTN-vs-3-bet buckets differ by, per format (source sizing
 * profiles, docs/PLAN-btn-4bet.md): cash opens 2.5bb and the blind 3-bets to
 * 5× (12.5bb), hero 4-bets to 25bb; 40bb opens 2.3bb, 3-bet to 4× (9.2bb),
 * and hero's 4-bet is all-in.
 *
 * Cash 4-bets are split by what they do facing a 5-bet jam: a 4-bet that calls
 * it is value, one that folds is a bluff (`range.ts`). At 40bb the 4-bet *is*
 * the jam, so the charts are plain. Hero only gets here with a hand they
 * opened, so the dealer deals from the source's own BTN open range — at 40bb
 * that is the source's, not the RFI drill's PokerCoaching chart, so the spot
 * and its chart agree.
 */
const BTN4_SOURCE = {
  mtt: { stack: '40bb', open: 2.3, threeBet: 9.2, fourBet: 'all-in' },
  cash: { stack: '100bb', open: 2.5, threeBet: 12.5, fourBet: '25bb' },
} as const;

/** One BTN-vs-3-bet bucket per (format, 3-bettor), built in one place like `BB_SPOTS`. */
const BTN4_SPOTS = (['mtt', 'cash'] as const).flatMap((format) => {
  const src = BTN4_SOURCE[format];
  return BTN4_THREE_BETTORS.map((seat) => {
    const id: Btn4Bucket = `btn4-${format}-${seat}`;
    const meta: BucketMeta = {
      id,
      drill: 'btn4',
      format,
      stackLabel: src.stack,
      label: `vs ${seat} 3-bet`,
      openers: [seat],
      chartSeat: seat,
      raiseBb: src.threeBet,
      heroOpenBb: src.open,
      hero: 'BTN',
      raise: '4bet',
      fourBetSize: src.fourBet,
      chartName: `BTN vs ${seat} 3-bet (${format === 'mtt' ? '40bb' : 'cash'})`,
      footnote:
        format === 'cash'
          ? 'The source uses the same chart vs SB and vs BB. Pure chart: border hands are close.'
          : 'The 4-bet is all-in at 40bb, so there is no bluff split. Pure chart: border hands are close.',
    };
    const chart = requireFacingRange({ format, stack: src.stack, node: 'vs3bet', hero: 'BTN', villain: seat }) as FourBetChart;
    return { id, meta, chart, reachable: requireOpenRange({ format, stack: src.stack, hero: 'BTN' }) };
  });
});

/**
 * Open vs 3-bet sizes (source profile cash_default): a seat in position
 * 3-bets 3× (7.5bb) and hero's out-of-position 4-bet is 2.5× (19bb); a blind
 * 3-bets 5× (12.5bb) and hero's in-position 4-bet is 2× (25bb).
 */
function open4Sizes(threeBettor: TableSeat): BetSizes {
  return threeBettor === 'SB' || threeBettor === 'BB'
    ? { raiseBb: 12.5, fourBetSize: '25bb' }
    : { raiseBb: 7.5, fourBetSize: '19bb' };
}

/**
 * One open-vs-3-bet bucket per cash opener; the 3-bettor is any seat behind.
 * The pure source answers a 3-bet the same way whoever made it, so the chart
 * read here (vs the BB) is the opener's chart against every 3-bettor; only
 * the sizes change. Hero only reaches this spot with a hand they opened.
 */
const OPEN4_SPOTS = OPEN4_OPENERS.map((opener) => {
  const id: Open4Bucket = `open4-cash-${opener}`;
  const threeBettors = OPEN4_THREE_BETTORS[opener];
  const meta: BucketMeta = {
    id,
    drill: 'open4',
    format: 'cash',
    stackLabel: '100bb',
    label: 'vs 3-bet',
    openers: threeBettors,
    chartSeat: opener,
    // The figures for a blind 3-bet; `spotSizes` gives each 3-bettor's own.
    ...open4Sizes('BB'),
    sizesBy: Object.fromEntries(threeBettors.map((t) => [t, open4Sizes(t)])),
    heroOpenBb: 2.5,
    hero: opener,
    raise: '4bet',
    chartName: `${opener} vs 3-bet (cash)`,
    footnote: 'The source uses one chart whichever seat 3-bets. Pure chart: border hands are close.',
  };
  const chart = requireFacingRange({ format: 'cash', stack: '100bb', node: 'vs3bet', hero: opener, villain: 'BB' }) as FourBetChart;
  return { id, meta, chart, reachable: CASH_RFI[opener] };
});

/** Every chart any facing drill grades against. */
export type Bucket = (typeof BTN_BUCKETS)[number] | BbBucket | Btn4Bucket | Open4Bucket;
export const BUCKETS: readonly Bucket[] = [
  ...BTN_BUCKETS,
  ...BB_SPOTS.map((s) => s.id),
  ...BTN4_SPOTS.map((s) => s.id),
  ...OPEN4_SPOTS.map((s) => s.id),
];

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
  /**
   * The label again, set only when several openers share the chart — shown
   * beside the opener ("HJ opens · vs Late") so seat and chart read together.
   * A per-opener chart (BB drill) would only repeat the seat.
   */
  openerTag?: string;
  /**
   * The seats that raise into hero, graded against this bucket's chart, in
   * seat order. "Opener" is the facing drills' word for *the raiser hero
   * faces*: in BTN vs 3-bet that is the 3-bettor, not the seat that opened.
   */
  openers: readonly TableSeat[];
  /** The source chart this bucket uses: the raiser's seat it was solved against. */
  chartSeat: TableSeat;
  /** The raise hero faces, in bb: the open, or (BTN vs 3-bet) the 3-bet. */
  raiseBb: number;
  /** Hero's own open, in bb — set only when hero opened (BTN / open vs 3-bet). */
  heroOpenBb?: number;
  /** Hero's seat. */
  hero: TableSeat;
  /**
   * Per-raiser sizes, where the raise hero faces depends on who made it
   * (open vs 3-bet: in position or from a blind). Read through `spotSizes`.
   */
  sizesBy?: Partial<Record<TableSeat, BetSizes>>;
  /** The re-raise hero answers with on K. */
  raise: RaiseAction;
  /** Hero's 4-bet size as the prompt states it ("25bb", "all-in"); 4-bet drills only. */
  fourBetSize?: string;
  /** The source chart's name as the pack prints it, e.g. "BTN vs UTG+1". */
  chartName: string;
  /** One-line range-sheet footnote on where the bucket chart is off. */
  footnote?: string;
}

/** The raise hero faces and hero's 4-bet size, as the felt and prompt state them. */
export interface BetSizes {
  raiseBb: number;
  fourBetSize?: string;
}

/** The sizes in a spot: the raiser's own where the bucket has them, else the bucket's. */
export function spotSizes(bucket: Bucket, raiser: TableSeat): BetSizes {
  const meta = BUCKET_META[bucket];
  return meta.sizesBy?.[raiser] ?? { raiseBb: meta.raiseBb, fourBetSize: meta.fourBetSize };
}

function openersIn(format: Format, bucket: Bucket): readonly Opener[] {
  return OPENERS.filter((o) => BUCKET_OF_IN[format][o] === bucket);
}

export const BUCKET_META: Record<Bucket, BucketMeta> = {
  early: {
    id: 'early',
    drill: 'btn',
    format: 'mtt',
    stackLabel: '50bb+',
    label: 'vs Early',
    openerTag: 'vs Early',
    openers: openersIn('mtt', 'early'),
    chartSeat: 'UTG1',
    raiseBb: BTN_DRILL_RAISE_BB,
    hero: 'BTN',
    raise: '3bet',
    chartName: 'BTN vs UTG+1',
    footnote: 'UTG is a touch tighter than this.',
  },
  late: {
    id: 'late',
    drill: 'btn',
    format: 'mtt',
    stackLabel: '50bb+',
    label: 'vs Late',
    openerTag: 'vs Late',
    openers: openersIn('mtt', 'late'),
    chartSeat: 'LJ',
    raiseBb: BTN_DRILL_RAISE_BB,
    hero: 'BTN',
    raise: '3bet',
    chartName: 'BTN vs LJ',
    footnote: 'vs HJ/CO the exact chart is a bit wider: more suited calls and bluffs.',
  },
  cashEarly: {
    id: 'cashEarly',
    drill: 'btn',
    format: 'cash',
    stackLabel: '100bb',
    label: 'vs LJ/HJ',
    openerTag: 'vs LJ/HJ',
    openers: openersIn('cash', 'cashEarly'),
    chartSeat: 'LJ',
    raiseBb: BTN_DRILL_RAISE_BB,
    hero: 'BTN',
    raise: '3bet',
    chartName: 'BTN vs LJ/HJ (cash)',
    footnote: 'The source uses one chart for LJ and HJ. Flats are the simplified chart’s: 66–99, A9s, A8s, QTs, JTs.',
  },
  cashCo: {
    id: 'cashCo',
    drill: 'btn',
    format: 'cash',
    stackLabel: '100bb',
    label: 'vs CO',
    openerTag: 'vs CO',
    openers: openersIn('cash', 'cashCo'),
    chartSeat: 'CO',
    raiseBb: BTN_DRILL_RAISE_BB,
    hero: 'BTN',
    raise: '3bet',
    chartName: 'BTN vs CO (cash)',
    footnote: 'Same flats as vs LJ/HJ; only 3-bets are added.',
  },
  ...Object.fromEntries(BB_SPOTS.map((s) => [s.id, s.meta])),
  ...Object.fromEntries(BTN4_SPOTS.map((s) => [s.id, s.meta])),
  ...Object.fromEntries(OPEN4_SPOTS.map((s) => [s.id, s.meta])),
} as Record<Bucket, BucketMeta>;

/**
 * The hands the dealer may deal per bucket, where that is narrower than all
 * 169: BTN vs 3-bet only happens to hands hero opened.
 */
export const BUCKET_REACHABLE: Partial<Record<Bucket, ReadonlySet<HandClass>>> = Object.fromEntries(
  [...BTN4_SPOTS, ...OPEN4_SPOTS].map((s) => [s.id, s.reachable])
);

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

/**
 * A facing-a-3-bet chart (`range.ts`, node `vs3bet`). Its 4-bets are split into value
 * and bluff where the source can tell them apart (cash: by what calls a 5-bet
 * jam), or one plain set where it cannot (40bb, where the 4-bet is all-in).
 */
export interface FourBetChart {
  fourBet: { value: ReadonlySet<HandClass>; bluff: ReadonlySet<HandClass> } | ReadonlySet<HandClass>;
  call: ReadonlySet<HandClass>;
}

export type FacingChart = KindedChart | PlainChart | FourBetChart;

/** Whether a chart is a 3-bet chart that splits its 3-bets into value and bluff. */
export function hasKinds(chart: FacingChart): chart is KindedChart {
  return 'value' in chart;
}

function isFourBetChart(chart: FacingChart): chart is FourBetChart {
  return 'fourBet' in chart;
}

/** The BTN drill's chart against one opener: PokerCoaching (tournament) or the cash source. */
function btnChart(format: Format, opener: Opener): FacingChart {
  const stack: Stack = format === 'mtt' ? '50bb+' : '100bb';
  return requireFacingRange({ format, stack, node: 'vsOpen', hero: 'BTN', villain: opener });
}

/**
 * The six tournament BTN source charts, one per opener. The drill grades
 * against two of them (`EARLY`, `LATE`); all six feed the dealer's "trash"
 * tier and the tests that measure each opener's distance from its bucket.
 */
export const FACING_SOURCES = Object.fromEntries(OPENERS.map((o) => [o, btnChart('mtt', o)])) as Record<
  Opener,
  KindedChart
>;

/**
 * vs Early — BTN vs UTG+1.
 *
 * value 34 + bluff 52 + call 116 = 202 combos = 15.2% continue.
 * Offsuit broadways 3-bet as *bluffs* here: they block the top of a tight
 * range and play badly as a flat.
 */
export const EARLY: KindedChart = FACING_SOURCES.UTG1;

/**
 * vs Late — BTN vs LJ.
 *
 * value 50 + bluff 60 + call 140 = 250 combos = 18.9% continue.
 * AQ joins the value range, AJo/KQo become flats, and the bluffs move down
 * the suited aces (A8s–A2s) and pick up 65s/54s.
 */
export const LATE: KindedChart = FACING_SOURCES.LJ;

/**
 * The BTN drill's charts per format, one per opener: the dealer measures its
 * "trash" tier against all of them. Cash: the source uses one chart for vs LJ
 * and vs HJ (3-bet 110 / call 40), and vs CO only adds 3-bets (178 / 40).
 * Cash BTN is almost 3-bet or fold, and these are plain charts: the source
 * does not split 3-bets into value and bluff.
 */
export const BTN_SOURCE_CHARTS: Record<Format, readonly FacingChart[]> = {
  mtt: OPENERS.map((o) => FACING_SOURCES[o]),
  cash: CASH_OPENERS.map((o) => btnChart('cash', o)),
};

/** The chart each bucket is graded against. */
export const BUCKET_CHART = {
  early: EARLY,
  late: LATE,
  cashEarly: btnChart('cash', 'LJ'),
  cashCo: btnChart('cash', 'CO'),
  ...Object.fromEntries(BB_SPOTS.map((s) => [s.id, s.chart])),
  ...Object.fromEntries(BTN4_SPOTS.map((s) => [s.id, s.chart])),
  ...Object.fromEntries(OPEN4_SPOTS.map((s) => [s.id, s.chart])),
} as Record<Bucket, FacingChart>;

/**
 * Blinds already in the pot that neither hero nor the 3-bettor put there:
 * whichever blinds did not 3-bet (hero never posts one in these drills).
 */
function deadBlinds(threeBettor: TableSeat): number {
  return 1.5 - (threeBettor === 'SB' ? 0.5 : threeBettor === 'BB' ? 1 : 0);
}

/**
 * The cash 4-bet charts re-split for a low-stakes pool (`lowStakes.ts`), at
 * the cheapest jam price across each chart's 3-bettors. Buckets with no
 * value/bluff split — every other chart — are absent and read the source.
 */
const LOW_STAKES_CHART: Partial<Record<Bucket, FacingChart>> = Object.fromEntries(
  [...BTN4_SPOTS, ...OPEN4_SPOTS]
    .filter((s) => s.meta.format === 'cash')
    .map((s) => {
      const price = Math.min(
        ...s.meta.openers.map((t) => jamPrice(parseFloat(spotSizes(s.id, t).fourBetSize ?? ''), deadBlinds(t)))
      );
      return [s.id, lowStakesChart(s.chart, price)];
    })
);

/**
 * The chart a bucket is graded against for `opponents`. 'balanced' is the
 * source chart; 'low' differs only where a cash 4-bet chart splits value from
 * bluff, and there only in which 4-bets call a jam.
 */
export function bucketChart(bucket: Bucket, opponents: Opponents = 'balanced'): FacingChart {
  return (opponents === 'low' ? LOW_STAKES_CHART[bucket] : undefined) ?? BUCKET_CHART[bucket];
}

/**
 * Why the low-stakes read folds a hand the source calls a jam with, priced at
 * this spot's own 3-bettor: "36% against a QQ+, AK jam; calling needs 37%".
 * Null for every hand the two reads agree on.
 */
export function lowStakesNote(bucket: Bucket, raiser: TableSeat, hc: HandClass): string | null {
  if (chartAction(BUCKET_CHART[bucket], hc).kind !== 'value') return null;
  if (bucketChartAction(bucket, hc, 'low').kind !== 'bluff') return null;
  const eq = JAM_EQUITY[hc];
  const fourBet = parseFloat(spotSizes(bucket, raiser).fourBetSize ?? '');
  if (eq === undefined || Number.isNaN(fourBet)) return null;
  const price = jamPrice(fourBet, deadBlinds(raiser));
  return `${Math.round(eq)}% against a ${POPULATION_JAM} jam; calling needs ${Math.round(price)}%`;
}

/** Whether the opponents read can change a bucket's chart (cash 4-bet charts only). */
export function hasOpponentsRead(bucket: Bucket): boolean {
  return bucket in LOW_STAKES_CHART;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

/** A chart's answer for a hand class: its re-raise (with kind, if the chart has kinds), call, or fold. */
export function chartAction(chart: FacingChart, hc: HandClass): FacingAnswer {
  if (isFourBetChart(chart)) {
    const { fourBet } = chart;
    if ('value' in fourBet) {
      if (fourBet.value.has(hc)) return { action: '4bet', kind: 'value' };
      if (fourBet.bluff.has(hc)) return { action: '4bet', kind: 'bluff' };
    } else if (fourBet.has(hc)) {
      return { action: '4bet' };
    }
  } else if (hasKinds(chart)) {
    if (chart.value.has(hc)) return { action: '3bet', kind: 'value' };
    if (chart.bluff.has(hc)) return { action: '3bet', kind: 'bluff' };
  } else if (chart.threeBet.has(hc)) {
    return { action: '3bet' };
  }
  if (chart.call.has(hc)) return { action: 'call' };
  return { action: 'fold' };
}

/** The bucket chart's answer for a hand class, for `opponents` (default: the source's balanced chart). */
export function bucketChartAction(bucket: Bucket, hc: HandClass, opponents: Opponents = 'balanced'): FacingAnswer {
  return chartAction(bucketChart(bucket, opponents), hc);
}

/** The graded answer when `opener` opens and hero holds `hc` on the button (tournament). */
export function facingAction(opener: Opener, hc: HandClass): FacingAnswer {
  return bucketChartAction(BUCKET_OF[opener], hc);
}


/**
 * Combo totals per answer, as printed under each source chart; sums to 1326.
 * A kinded chart reports value and bluff, a plain one a single threeBet or
 * fourBet.
 */
export type FacingComboCounts = { call: number; fold: number } & (
  | { value: number; bluff: number }
  | { threeBet: number }
  | { fourBet: number }
);

export function facingComboCounts(chart: FacingChart): FacingComboCounts {
  const plainKey = isFourBetChart(chart) ? 'fourBet' : 'threeBet';
  const kinded = hasKinds(chart) || (isFourBetChart(chart) && 'value' in chart.fourBet);
  const counts: Record<string, number> = kinded
    ? { value: 0, bluff: 0, call: 0, fold: 0 }
    : { [plainKey]: 0, call: 0, fold: 0 };
  for (const hc of ALL_169) {
    const { action, kind } = chartAction(chart, hc);
    counts[action === 'call' || action === 'fold' ? action : (kind ?? plainKey)] += combosForClass(hc);
  }
  return counts as FacingComboCounts;
}
