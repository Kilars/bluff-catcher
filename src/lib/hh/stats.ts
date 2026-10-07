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

import type { GameVariant, Street } from './parse.ts';
import { BLINDS, type HeroHand, type PreflopRole } from './hero.ts';
import { boardType, type BoardType } from './board.ts';
import { potOdds } from './decisions.ts';

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

/**
 * 6-max cash reads a different game than 8-max MTT, so the preflop bands that
 * genuinely move get an overlay; postflop and showdown bands are close enough
 * to game-invariant to reuse. 6-max plays more hands and raises more of them
 * (higher PFR, narrower VPIP−PFR gap, a touch more 3-betting), and deep-stacked
 * position makes cold-calling far less of a blanket bleed than it is in an MTT.
 * Conventional 6-max online-cash reference ranges, argued alongside the MTT set
 * in docs/leak-coaching.md — change them together.
 */
const CASH_OVERRIDES: Record<string, Partial<Band>> = {
  vpip: { band: [21, 28] },
  pfr: { band: [18, 25] },
  gap: { band: [0, 5] },
  threeBet: { band: [7, 12] },
  coldCall: {
    band: [4, 14],
    note: 'flatting out of position still bleeds; in position in deep 6-max it is a real part of the range',
  },
};

/** The band table a variant is graded against. Cash overlays the moved bands
 * onto the MTT set; a mixed window falls back to the MTT bands (filter with
 * --variant to grade cash against its own). */
function bandsFor(variant: GameVariant | 'mixed'): Record<string, Band> {
  if (variant !== 'cash') return BANDS;
  const out: Record<string, Band> = { ...BANDS };
  for (const [k, o] of Object.entries(CASH_OVERRIDES)) out[k] = { ...BANDS[k], ...o };
  return out;
}

function stat(bands: Record<string, Band>, key: string, made: number, opp: number): Stat {
  const b = bands[key];
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

/** A stat cut by flop texture. Always thin — see `SPLIT_CAVEAT`. */
export interface BoardSplit {
  key: 'cbetFlop' | 'cbetTurn' | 'foldToCbetFlop';
  board: BoardType;
  made: number;
  opp: number;
  pct: number;
}

/**
 * Printed next to every split, because the sample will be too small for a long
 * time and the honest thing is to say so rather than to withhold the cut. The
 * aggregate is not a safer number — it is a wrong one that looks safe.
 */
export const SPLIT_CAVEAT =
  'split by flop texture and never banded: one session is ~7 c-bets spread over five buckets. ' +
  'Read the direction, not the percentage. The turn cut is keyed off the flop texture, not the turn card.';

function splitByBoard(
  key: BoardSplit['key'],
  opps: HeroHand[],
  made: (h: HeroHand) => boolean,
): BoardSplit[] {
  const buckets = new Map<BoardType, { made: number; opp: number }>();

  for (const h of opps) {
    const board = boardType(h.board);
    if (!board) continue;
    const bucket = buckets.get(board) ?? { made: 0, opp: 0 };
    bucket.opp += 1;
    if (made(h)) bucket.made += 1;
    buckets.set(board, bucket);
  }

  return [...buckets]
    .map(([board, b]) => ({ key, board, made: b.made, opp: b.opp, pct: (b.made / b.opp) * 100 }))
    .sort((a, b) => b.opp - a.opp);
}

/**
 * Hero's answer to a flop c-bet, or null when Hero never faced one.
 *
 * A c-bet is the preflop raiser's bet, and the first bet of the flop: a donk
 * into the raiser, any bet in a limped pot, and a bet from a third player after
 * the raiser checks are all something else. Hero's first action after it is
 * the answer — calling and then folding to a raise behind is not a fold to the
 * c-bet — and a raise landing in between means Hero faced the raise instead.
 * Hero's own donk bet comes first, so it is never mistaken for one.
 */
function cbetAnswer(h: HeroHand): 'fold' | 'continue' | null {
  if (h.pfa || !h.preflopRaiser) return null;
  const f = h.streets.find((s) => s.street === 'flop');
  if (!f) return null;
  const all = f.allActions;
  const at = all.findIndex((a) => a.kind === 'bet');
  if (at < 0 || all[at].player !== h.preflopRaiser) return null;
  const rest = all.slice(at + 1);
  const answer = rest.findIndex((a) => f.actions.includes(a));
  if (answer < 0 || rest.slice(0, answer).some((a) => a.kind === 'raise')) return null;
  return rest[answer].kind === 'fold' ? 'fold' : 'continue';
}

export interface RoleLine {
  role: PreflopRole;
  hands: number;
  netBB: number;
}

export interface Summary {
  hands: number;
  /** 'mixed' when the window spans both games — the money and rate stats blend. */
  variant: GameVariant | 'mixed';
  tournaments: number;
  /** Blind-level span of the window's tournament hands; null for cash, which
   * has no levels. [0, 0] only for an empty MTT window. */
  levels: [number, number] | null;
  /** Net in raw minor units; meaningful only for a single-variant window (chips
   * for MTT, cents for cash), so the renderer shows it for MTT alone. */
  netChips: number;
  /** Net measured in big blinds of the hand it happened in — the MTT-safe unit. */
  netBB: number;
  /** Net from hands that got to showdown ("blue line"). */
  showdownBB: number;
  /** Net from hands won or lost without showdown ("red line"). */
  nonShowdownBB: number;
  investedBB: number;
  stats: Stat[];
  /** cbetFlop / cbetTurn / foldToCbetFlop, cut by flop texture. */
  byBoard: BoardSplit[];
  byRole: RoleLine[];
  worstPots: HeroHand[];
  /** Hands where Hero called off the most, ranked — the drill-down list. */
  biggestCalls: { hand: HeroHand; street: Street; toCall: number; potOdds: number }[];
}

/** An empty window has no hands to read the game off, so it takes the one the
 * caller asked for (`--variant`), and MTT when none was. */
export function variantOf(hs: HeroHand[], requested?: GameVariant): GameVariant | 'mixed' {
  if (!hs.length) return requested ?? 'mtt';
  const first = hs[0].variant;
  return hs.every((h) => h.variant === first) ? first : 'mixed';
}

export function summarise(hs: HeroHand[], requested?: GameVariant): Summary {
  const n = hs.length;
  const variant = variantOf(hs, requested);
  const bands = bandsFor(variant);
  const sawFlop = hs.filter((h) => h.sawFlop);
  // The showdown stats' population: a preflop all-in sees the flop without
  // acting on it, and leaving it out disagreed with showdownBB below.
  const flopLive = hs.filter((h) => h.flopDealtLive);

  // ── Preflop, excluding open-raise selection ───────────────────────────────
  const firstIn = hs.filter((h) => h.firstInOpp && h.limpersAhead === 0);
  const threeBetOpps = hs.filter((h) => h.threeBetOpp);
  const coldCallOpps = threeBetOpps.filter((h) => !BLINDS.has(h.position));
  // Fold to a 3-bet means exactly that: an open (or iso-raise) facing the
  // re-raise. A 3-bet folding to a 4-bet is a different spot, far more often
  // right, and pooling it in moved a banded number. faced3Bets[] keeps both. A
  // cold 4-bet landing before Hero answered makes the fold one to a 4-bet too.
  const faced3 = hs.filter(
    (h) => h.faced3Bet && !h.faced3BetCold4Bet && (h.role === 'open' || h.role === 'iso-raise'),
  );
  const steals = hs.filter((h) => h.stealDefenceOpp);

  const vpip = hs.filter((h) => h.vpip).length;
  const pfr = hs.filter((h) => h.pfr).length;
  // A walk or an all-in from the post gave Hero no preflop choice, so it is no
  // VPIP/PFR opportunity. `hands` still counts it: it was dealt.
  const decided = hs.filter((h) => h.role !== 'no-decision').length;

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

  // Read off the street as printed, not facedBet: checking first from the
  // blinds and folding to the c-bet is the commonest version of this spot, and
  // facedBet excludes it from the numerator and the denominator both.
  const cbetAnswers = new Map(sawFlop.map((h) => [h, cbetAnswer(h)]));
  const foldsToCbet = (h: HeroHand) => cbetAnswers.get(h) === 'fold';
  const faceCbetOpps = sawFlop.filter((h) => cbetAnswers.get(h) !== null);
  const foldedToCbet = faceCbetOpps.filter(foldsToCbet);

  const xrOpps = sawFlop.filter((h) => {
    const f = flopOf(h);
    return f?.checked && f.facedBetEver;
  });
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

  const showdowns = flopLive.filter((h) => h.showdown);

  const stats: Stat[] = [
    stat(bands, 'vpip', vpip, decided),
    stat(bands, 'pfr', pfr, decided),
    stat(bands, 'gap', vpip - pfr, decided),
    stat(bands, 'limp', firstIn.filter((h) => h.role === 'limp').length, firstIn.length),
    stat(bands, 'threeBet', threeBetOpps.filter((h) => h.threeBet).length, threeBetOpps.length),
    stat(bands, 'foldTo3Bet', faced3.filter((h) => h.foldedTo3Bet).length, faced3.length),
    stat(bands, 'coldCall', coldCallOpps.filter((h) => h.role === 'cold-call').length, coldCallOpps.length),
    stat(bands, 'foldBBvsSteal', steals.filter((h) => h.stealDefence === 'fold').length, steals.length),
    stat(bands, 'cbetFlop', cbets.length, cbetOpps.length),
    stat(bands, 'cbetTurn', barrels.length, barrelOpps.length),
    stat(bands, 'foldToCbetFlop', foldedToCbet.length, faceCbetOpps.length),
    stat(bands, 'checkRaiseFlop', xrs.length, xrOpps.length),
    stat(bands, 'aggFreq', aggressive, aggressive + passive),
    stat(bands, 'wwsf', flopLive.filter((h) => h.wonPot).length, flopLive.length),
    stat(bands, 'wtsd', showdowns.length, flopLive.length),
    stat(bands, 'wsd', showdowns.filter((h) => h.wonPot).length, showdowns.length),
  ];

  const byBoard: BoardSplit[] = [
    ...splitByBoard('cbetFlop', cbetOpps, (h) => Boolean(flopOf(h)?.bet)),
    ...splitByBoard('cbetTurn', barrelOpps, (h) => Boolean(turnOf(h)?.bet)),
    ...splitByBoard('foldToCbetFlop', faceCbetOpps, foldsToCbet),
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
          potOdds: potOdds(a),
        })),
    )
    .sort(
      (a, b) =>
        (b.hand.bb > 0 ? b.toCall / b.hand.bb : 0) - (a.hand.bb > 0 ? a.toCall / a.hand.bb : 0),
    )
    .slice(0, 8);

  // Cash hands carry level 0, so a mixed window reads the tournament hands only.
  const levels = hs.filter((h) => h.variant === 'mtt').map((h) => h.level);
  const levelSpan: [number, number] | null =
    variant === 'cash' ? null : levels.length ? [Math.min(...levels), Math.max(...levels)] : [0, 0];

  return {
    hands: n,
    variant,
    tournaments: new Set(hs.map((h) => h.tournamentId).filter(Boolean)).size,
    levels: levelSpan,
    netChips: hs.reduce((t, h) => t + h.net, 0),
    netBB,
    showdownBB,
    nonShowdownBB: netBB - showdownBB,
    investedBB: hs.reduce((t, h) => t + (h.bb > 0 ? h.invested / h.bb : 0), 0),
    stats,
    byBoard,
    byRole: [...roles.values()].sort((a, b) => a.netBB - b.netBB),
    worstPots: byNet.slice(0, 5),
    biggestCalls,
  };
}
