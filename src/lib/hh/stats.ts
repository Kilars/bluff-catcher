/**
 * Aggregates Hero's hands into leak statistics.
 *
 * The framing throughout is the one that matters at the table: does a number
 * mean chips are leaving that should not ("bleed"), or that chips are not
 * coming in that should ("missed")? Every stat carries a reference band and is
 * flagged in one of those two directions, or left alone.
 *
 * Opening ranges are reported but never flagged — those are drilled in the
 * preflop trainer, so a leak report that harps on them is noise.
 */

import type { Street } from './parse.ts';
import type { HeroHand, PreflopRole } from './hero.ts';

/** Which side of the ledger a reading falls on. */
export type Flag = 'bleed' | 'missed' | null;

export type Verdict = 'low' | 'ok' | 'high' | 'thin' | 'none';

export interface Stat {
  key: string;
  label: string;
  group: string;
  made: number;
  opp: number;
  pct: number | null;
  band: readonly [number, number] | null;
  verdict: Verdict;
  flag: Flag;
  note?: string;
}

/**
 * Reference bands for low/mid-stakes 8-max MTT play, as percentages.
 *
 * Conventional coaching ranges, not solver output. They are sourced and argued
 * in docs/leak-coaching.md, which is also where the leak taxonomy behind the
 * bleed/missed directions lives — change them together.
 *
 * `minN` is the sample below which a reading is reported as thin and never
 * flagged. Postflop stats need thousands of hands before they mean anything,
 * so on a small sample the money breakdown is the honest signal, not these.
 */
interface Band {
  label: string;
  group: string;
  band: readonly [number, number] | null;
  /** What a reading above / below the band means. */
  high: Flag;
  low: Flag;
  minN: number;
  note?: string;
}

const BANDS: Record<string, Band> = {
  vpip: { label: 'VPIP', group: 'Preflop', band: [20, 28], high: 'bleed', low: 'missed', minN: 30 },
  pfr: { label: 'PFR', group: 'Preflop', band: [16, 23], high: null, low: 'missed', minN: 30 },
  gap: {
    label: 'VPIP − PFR gap',
    group: 'Preflop',
    band: [0, 7],
    high: 'bleed',
    low: null,
    minN: 30,
    note: 'a wide gap is calling instead of raising',
  },
  limp: {
    label: 'Limp (first in)',
    group: 'Preflop',
    band: [0, 2],
    high: 'bleed',
    low: null,
    minN: 15,
  },
  threeBet: {
    label: '3-bet',
    group: 'Preflop',
    band: [6, 11],
    high: null,
    low: 'missed',
    minN: 15,
  },
  foldTo3Bet: {
    label: 'Fold to 3-bet',
    group: 'Preflop',
    band: [40, 58],
    high: 'missed',
    low: 'bleed',
    minN: 10,
  },
  coldCall: {
    label: 'Cold-call an open',
    group: 'Preflop',
    band: [3, 10],
    high: 'bleed',
    low: null,
    minN: 15,
    note: 'flatting out of position is the classic slow bleed',
  },
  foldBBvsSteal: {
    label: 'Fold BB vs steal',
    group: 'Preflop',
    band: [40, 58],
    high: 'missed',
    low: 'bleed',
    minN: 10,
  },
  cbetFlop: {
    label: 'C-bet flop',
    group: 'Postflop',
    band: [50, 72],
    high: null,
    low: 'missed',
    minN: 10,
  },
  cbetTurn: {
    label: 'C-bet turn (2nd barrel)',
    group: 'Postflop',
    band: [40, 60],
    high: null,
    low: 'missed',
    minN: 8,
  },
  foldToCbetFlop: {
    label: 'Fold to flop c-bet',
    group: 'Postflop',
    band: [40, 58],
    high: 'missed',
    low: 'bleed',
    minN: 10,
  },
  checkRaiseFlop: {
    label: 'Check-raise flop',
    group: 'Postflop',
    band: [8, 16],
    high: null,
    low: 'missed',
    minN: 10,
  },
  aggFreq: {
    label: 'Aggression frequency',
    group: 'Postflop',
    band: [35, 52],
    high: null,
    low: 'missed',
    minN: 20,
  },
  wwsf: {
    label: 'Won when saw flop',
    group: 'Showdown',
    band: [43, 50],
    high: null,
    low: 'bleed',
    minN: 20,
  },
  wtsd: {
    label: 'Went to showdown',
    group: 'Showdown',
    band: [26, 32],
    high: 'bleed',
    low: 'missed',
    minN: 20,
  },
  wsd: {
    label: 'Won at showdown',
    group: 'Showdown',
    band: [48, 56],
    high: null,
    low: 'bleed',
    minN: 10,
    note: 'low here with high WTSD means calling down too light',
  },
};

function stat(key: string, made: number, opp: number): Stat {
  const b = BANDS[key];
  const pct = opp > 0 ? (made / opp) * 100 : null;

  let verdict: Verdict = 'none';
  let flag: Flag = null;

  if (pct === null) verdict = 'none';
  else if (opp < b.minN) verdict = 'thin';
  else if (!b.band) verdict = 'ok';
  else if (pct > b.band[1]) {
    verdict = 'high';
    flag = b.high;
  } else if (pct < b.band[0]) {
    verdict = 'low';
    flag = b.low;
  } else verdict = 'ok';

  return {
    key,
    label: b.label,
    group: b.group,
    made,
    opp,
    pct,
    band: b.band,
    verdict,
    flag,
    note: b.note,
  };
}

const POSTFLOP: readonly Street[] = ['flop', 'turn', 'river'];

export interface RoleLine {
  role: PreflopRole;
  hands: number;
  netBB: number;
}

export interface Summary {
  hands: number;
  tournaments: number;
  levels: [number, number];
  netChips: number;
  /** Net measured in big blinds of the hand it happened in — the MTT-safe unit. */
  netBB: number;
  /** Net from hands that got to showdown ("blue line"). */
  showdownBB: number;
  /** Net from hands won or lost without showdown ("red line"). */
  nonShowdownBB: number;
  investedBB: number;
  stats: Stat[];
  byRole: RoleLine[];
  worstPots: HeroHand[];
  bestPots: HeroHand[];
  /** Hands where Hero called off the most, ranked — the drill-down list. */
  biggestCalls: { hand: HeroHand; street: Street; toCall: number; potOdds: number }[];
}

export function summarise(hs: HeroHand[]): Summary {
  const n = hs.length;
  const sawFlop = hs.filter((h) => h.sawFlop);

  // ── Preflop, excluding open-raise selection ───────────────────────────────
  const firstIn = hs.filter((h) => h.firstInOpp);
  const threeBetOpps = hs.filter((h) => h.threeBetOpp);
  const coldCallOpps = threeBetOpps.filter((h) => h.position !== 'SB' && h.position !== 'BB');
  const faced3 = hs.filter((h) => h.faced3Bet);
  const steals = hs.filter((h) => h.stealDefenceOpp);

  const vpip = hs.filter((h) => h.vpip).length;
  const pfr = hs.filter((h) => h.pfr).length;

  // ── Postflop ──────────────────────────────────────────────────────────────
  const flopOf = (h: HeroHand) => h.streets.find((s) => s.street === 'flop');
  const turnOf = (h: HeroHand) => h.streets.find((s) => s.street === 'turn');

  const cbetOpps = sawFlop.filter((h) => {
    const f = flopOf(h);
    return h.pfa && f && !f.facedBet;
  });
  const cbets = cbetOpps.filter((h) => flopOf(h)?.bet);

  const barrelOpps = cbets.filter((h) => {
    const t = turnOf(h);
    return t && !t.facedBet;
  });
  const barrels = barrelOpps.filter((h) => turnOf(h)?.bet);

  const faceCbetOpps = sawFlop.filter((h) => {
    const f = flopOf(h);
    return !h.pfa && f && f.facedBet;
  });
  const foldedToCbet = faceCbetOpps.filter((h) => flopOf(h)?.folded);

  const xrOpps = sawFlop.filter((h) => flopOf(h)?.checked);
  const xrs = xrOpps.filter((h) => flopOf(h)?.checkRaised);

  let aggressive = 0;
  let passive = 0;
  for (const h of hs) {
    for (const s of h.streets) {
      if (!POSTFLOP.includes(s.street)) continue;
      for (const a of s.actions) {
        if (a.kind === 'bet' || a.kind === 'raise') aggressive += 1;
        else if (a.kind === 'call' || a.kind === 'fold') passive += 1;
      }
    }
  }

  const showdowns = sawFlop.filter((h) => h.showdown);

  const stats: Stat[] = [
    stat('vpip', vpip, n),
    stat('pfr', pfr, n),
    stat('gap', vpip - pfr, n),
    stat('limp', firstIn.filter((h) => h.role === 'limp').length, firstIn.length),
    stat('threeBet', threeBetOpps.filter((h) => h.threeBet).length, threeBetOpps.length),
    stat('foldTo3Bet', faced3.filter((h) => h.foldedTo3Bet).length, faced3.length),
    stat('coldCall', coldCallOpps.filter((h) => h.role === 'cold-call').length, coldCallOpps.length),
    stat('foldBBvsSteal', steals.filter((h) => h.stealDefence === 'fold').length, steals.length),
    stat('cbetFlop', cbets.length, cbetOpps.length),
    stat('cbetTurn', barrels.length, barrelOpps.length),
    stat('foldToCbetFlop', foldedToCbet.length, faceCbetOpps.length),
    stat('checkRaiseFlop', xrs.length, xrOpps.length),
    stat('aggFreq', aggressive, aggressive + passive),
    stat('wwsf', sawFlop.filter((h) => h.wonPot).length, sawFlop.length),
    stat('wtsd', showdowns.length, sawFlop.length),
    stat('wsd', showdowns.filter((h) => h.wonPot).length, showdowns.length),
  ];

  // ── Money ─────────────────────────────────────────────────────────────────
  const netBB = hs.reduce((t, h) => t + h.netBB, 0);
  const showdownBB = hs.filter((h) => h.showdown).reduce((t, h) => t + h.netBB, 0);

  const roles = new Map<PreflopRole, RoleLine>();
  for (const h of hs) {
    const line = roles.get(h.role) ?? { role: h.role, hands: 0, netBB: 0 };
    line.hands += 1;
    line.netBB += h.netBB;
    roles.set(h.role, line);
  }

  const byNet = [...hs].sort((a, b) => a.netBB - b.netBB);

  const biggestCalls = hs
    .flatMap((h) =>
      h.decisions
        .filter((a) => a.kind === 'call' && a.toCall > 0)
        .map((a) => ({
          hand: h,
          street: a.street,
          toCall: a.toCall,
          potOdds: a.toCall / (a.potBefore + a.toCall),
        })),
    )
    .sort((a, b) => b.toCall / b.hand.bb - a.toCall / a.hand.bb)
    .slice(0, 8);

  const levels = hs.map((h) => h.level);

  return {
    hands: n,
    tournaments: new Set(hs.map((h) => h.tournamentId)).size,
    levels: [Math.min(...levels), Math.max(...levels)],
    netChips: hs.reduce((t, h) => t + h.net, 0),
    netBB,
    showdownBB,
    nonShowdownBB: netBB - showdownBB,
    investedBB: hs.reduce((t, h) => t + h.invested / h.bb, 0),
    stats,
    byRole: [...roles.values()].sort((a, b) => a.netBB - b.netBB),
    worstPots: byNet.slice(0, 5),
    bestPots: byNet.slice(-3).reverse(),
    biggestCalls,
  };
}
