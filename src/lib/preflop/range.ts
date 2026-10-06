/**
 * One lookup for every sourced preflop chart: `range(spot)`. Pure, no UI
 * imports. See docs/PLAN-range-generator.md.
 *
 * A spot names the format, the stack, the decision (`node`) and the seats.
 * The lookup finds the source that covers that stack and reads its charts
 * from the generated dataset (`rangeData.ts`). Nothing is fitted or rounded
 * here: every answer is a source chart as published.
 *
 *   cash 100bb — poker-practice `Cash_100_PTO` (6-max grid, no ante)
 *   mtt  40bb  — poker-practice `MTT_40_PTO` (9-max, 1bb BB ante)
 *   mtt  50bb+ — PokerCoaching "Facing RFI: Button" (BTN vs open only, with
 *                3-bets split into value and bluff)
 *
 * The PTO files do not label 3-bets value or bluff, and none is derived here
 * (docs/PLAN-cash.md: a derived split called 65s value). A 4-bet is split by
 * what it does facing a 5-bet jam — calls are value, folds are bluffs —
 * except where the 4-bet is itself all-in (40bb), which leaves one plain set.
 *
 * The cash source reuses one chart across many seat pairs: cash CO vs HJ is
 * the same chart as CO vs LJ. That is the source's rounding, accepted as is.
 */

import { ALL_169, type HandClass } from './hands.ts';
import type { FacingChart, FourBetChart, KindedChart, PlainChart } from './facing.ts';
import type { Format, TableSeat } from './ranges.ts';
import { CHARTS, HAND_ORDER, SOURCES } from './rangeData.ts';

/** The stacks the dataset covers, as the drills label them. */
export type Stack = '100bb' | '40bb' | '50bb+';

/**
 * The decision a chart answers:
 *   open   — first in: raise or fold
 *   vsOpen — facing an open: 3-bet, call or fold
 *   vs3bet — hero opened and faces a 3-bet: 4-bet, call or fold
 */
export type RangeNode = 'open' | 'vsOpen' | 'vs3bet';

export interface Spot {
  format: Format;
  stack: Stack;
  node: RangeNode;
  /** The seat whose chart this is. */
  hero: TableSeat;
  /** The raiser hero faces: the opener (vsOpen) or the 3-bettor (vs3bet). */
  villain?: TableSeat;
}

interface Source {
  id: string;
  /** The 4-bet is all-in, so there is no 5-bet to split it by. */
  fourBetIsJam: boolean;
  /** 3-bets come split into value and bluff (PokerCoaching only). */
  kinded: boolean;
}

const SOURCE_OF: Partial<Record<`${Format}/${Stack}`, Source>> = {
  'cash/100bb': { id: 'cash100', fourBetIsJam: false, kinded: false },
  'mtt/40bb': { id: 'mtt40', fourBetIsJam: true, kinded: false },
  'mtt/50bb+': { id: 'pc50', fourBetIsJam: false, kinded: true },
};

/** Our seat names → the source's. The source counts early seats EP1–EP3. */
const SOURCE_SEAT: Record<TableSeat, string> = {
  UTG: 'EP1',
  UTG1: 'EP2',
  UTG2: 'EP3',
  LJ: 'LJ',
  HJ: 'HJ',
  CO: 'CO',
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
};

// ─── Decoding ─────────────────────────────────────────────────────────────────

const ORDER = HAND_ORDER.split(' ') as HandClass[];
if (ORDER.length !== ALL_169.length) throw new Error('rangeData: hand order is not 169 classes');

/** Decoded once per distinct chart and shared, like the hand-built sets were. */
const decoded = new Map<number, ReadonlySet<HandClass>>();

function chartSet(index: number): ReadonlySet<HandClass> {
  let set = decoded.get(index);
  if (!set) {
    const bits = CHARTS[index];
    set = new Set(ORDER.filter((_, i) => bits[i] === '1'));
    decoded.set(index, set);
  }
  return set;
}

/** A source key's hand set, or null if the source has no such key. */
function read(source: Source, key: string): ReadonlySet<HandClass> | null {
  const index = SOURCES[source.id]?.[key];
  return index === undefined ? null : chartSet(index);
}

function sourceFor(spot: Pick<Spot, 'format' | 'stack'>): Source | null {
  return SOURCE_OF[`${spot.format}/${spot.stack}`] ?? null;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

/** A seat's raise-first-in range, or null if no source covers it. */
export function openRange(spot: Pick<Spot, 'format' | 'stack' | 'hero'>): ReadonlySet<HandClass> | null {
  const source = sourceFor(spot);
  return source && read(source, `Open${SOURCE_SEAT[spot.hero]}`);
}

/** The facing chart for a spot, or null if no source covers it. */
export function facingRange(spot: Spot): FacingChart | null {
  const source = sourceFor(spot);
  if (!source || !spot.villain || spot.node === 'open') return null;
  const pair = `${SOURCE_SEAT[spot.hero]}vs${SOURCE_SEAT[spot.villain]}`;

  if (spot.node === 'vsOpen') {
    if (source.kinded) {
      const value = read(source, `Value${pair}`);
      const bluff = read(source, `Bluff${pair}`);
      const call = read(source, `Call${pair}`);
      return value && bluff && call ? ({ value, bluff, call } satisfies KindedChart) : null;
    }
    const threeBet = read(source, `3Bet${pair}`);
    const call = read(source, `Call${pair}`);
    return threeBet && call ? ({ threeBet, call } satisfies PlainChart) : null;
  }

  const fourBet = read(source, `4Bet${pair}`);
  const call = read(source, `Call 3Bet${pair}`);
  if (!fourBet || !call) return null;
  if (source.fourBetIsJam) return { fourBet, call } satisfies FourBetChart;
  const callsJam = read(source, `Call 5Bet${pair}`);
  if (!callsJam) return null;
  return {
    fourBet: {
      value: new Set([...fourBet].filter((hc) => callsJam.has(hc))),
      bluff: new Set([...fourBet].filter((hc) => !callsJam.has(hc))),
    },
    call,
  } satisfies FourBetChart;
}

/**
 * Every other seat pair the source answers with the very same facing chart —
 * the cash source reuses one chart across many pairs, so cash CO vs HJ is
 * also CO vs LJ and SB vs HJ. Empty when the chart is the pair's own.
 */
export function chartTwins(spot: Spot): { hero: TableSeat; villain: TableSeat }[] {
  const chart = facingRange(spot);
  if (!chart) return [];
  const seats = Object.keys(SOURCE_SEAT) as TableSeat[];
  const mine = chartSignature(chart);
  const twins: { hero: TableSeat; villain: TableSeat }[] = [];
  for (const hero of seats) {
    for (const villain of seats) {
      if (hero === spot.hero && villain === spot.villain) continue;
      const other = facingRange({ ...spot, hero, villain });
      if (other && chartSignature(other) === mine) twins.push({ hero, villain });
    }
  }
  return twins;
}

/**
 * A facing chart's contents as one comparable string. Compared by contents,
 * not identity: the 4-bet value/bluff sets are built fresh per lookup.
 */
export function chartSignature(chart: FacingChart): string {
  return Object.values(chart)
    .flatMap((v): ReadonlySet<HandClass>[] => (v instanceof Set ? [v] : Object.values(v)))
    .map((s) => [...s].sort().join(' '))
    .join('|');
}

/** `openRange` for a spot that must exist: throws on a missing chart (module-load wiring). */
export function requireOpenRange(spot: Pick<Spot, 'format' | 'stack' | 'hero'>): ReadonlySet<HandClass> {
  const set = openRange(spot);
  if (!set) throw new Error(`no open range for ${spot.format} ${spot.stack} ${spot.hero}`);
  return set;
}

/** `facingRange` for a spot that must exist: throws on a missing chart (module-load wiring). */
export function requireFacingRange(spot: Spot): FacingChart {
  const chart = facingRange(spot);
  if (!chart) throw new Error(`no ${spot.node} chart for ${spot.format} ${spot.stack} ${spot.hero} vs ${spot.villain}`);
  return chart;
}
