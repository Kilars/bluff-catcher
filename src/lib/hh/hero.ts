/**
 * Turns parsed hands into Hero-centric facts: what Hero did, what it cost, and
 * what the pot looked like at each decision.
 *
 * Deliberately light on preflop *opening* ranges — those are trained elsewhere
 * in the app. The categories here are about the spots a chart does not cover:
 * 3-betting, defending, and every postflop street.
 */

import type { Action, Hand, Street } from './parse.ts';

/** How Hero entered (or declined) the pot. */
export type PreflopRole =
  | 'fold'
  | 'bb-check'
  | 'limp'
  | 'open'
  | 'iso-raise'
  | 'cold-call'
  | 'blind-defend'
  | '3bet'
  | 'squeeze'
  | '4bet+';

export interface StreetPlay {
  street: Street;
  potAtStart: number;
  /** Hero's stack when the street began. */
  stackAtStart: number;
  /** Stack-to-pot ratio Hero was playing. */
  spr: number | null;
  actions: Action[];
  /** Someone had bet before Hero's first action on this street. */
  facedBet: boolean;
  bettor: string | null;
  bet: boolean;
  raised: boolean;
  called: boolean;
  checked: boolean;
  folded: boolean;
  checkRaised: boolean;
}

export interface HeroHand {
  id: string;
  tournamentId: string;
  timestamp: string;
  level: number;
  bb: number;
  position: string;
  cards: string[] | null;
  startingStack: number;
  /** Starting stack measured in big blinds — the number that drives strategy. */
  stackBB: number;
  playersDealt: number;

  invested: number;
  won: number;
  net: number;
  netBB: number;

  vpip: boolean;
  pfr: boolean;
  role: PreflopRole;

  /** Raises already made when Hero first had to decide. */
  facingRaises: number;
  /** Limpers already in when Hero first had to decide. */
  limpersAhead: number;
  /** Hero could have entered first in (no raise ahead, not in the BB). */
  firstInOpp: boolean;
  /** Hero faced exactly one raise and had not yet acted. */
  threeBetOpp: boolean;
  threeBet: boolean;
  /** Hero opened and someone raised over the top. */
  faced3Bet: boolean;
  foldedTo3Bet: boolean;
  /** Hero was in the BB facing a lone steal-position open. */
  stealDefenceOpp: boolean;
  stealDefence: 'fold' | 'call' | '3bet' | null;

  /** Hero was the last preflop raiser. */
  pfa: boolean;
  sawFlop: boolean;
  streetReached: Street;
  showdown: boolean;
  wonPot: boolean;
  streets: StreetPlay[];
  /** Every voluntary Hero action, for drill-down on the big pots. */
  decisions: Action[];
  board: string[];
}

const STEAL_POSITIONS = new Set(['CO', 'BTN', 'SB']);
const BLINDS = new Set(['SB', 'BB', 'SB/BTN']);

function isVoluntary(a: Action): boolean {
  return a.kind !== 'ante' && a.kind !== 'sb' && a.kind !== 'bb';
}

/** Pot odds Hero was laid on a call: the share of the final pot they put in. */
export function potOdds(a: Action): number | null {
  if (a.toCall <= 0) return null;
  return a.toCall / (a.potBefore + a.toCall);
}

function buildStreet(hand: Hand, street: Street, hero: string): StreetPlay | null {
  const all = hand.actions.filter((a) => a.street === street);
  const mine = all.filter((a) => a.player === hero && isVoluntary(a));
  if (mine.length === 0) return null;

  const first = mine[0];
  const before = all.slice(0, all.indexOf(first));
  const aggressor = [...before].reverse().find((a) => a.kind === 'bet' || a.kind === 'raise');

  const kinds = mine.map((a) => a.kind);
  const checkedThenRaised =
    kinds.indexOf('check') >= 0 && kinds.lastIndexOf('raise') > kinds.indexOf('check');

  const potAtStart = all.length ? all[0].potBefore : first.potBefore;

  return {
    street,
    potAtStart,
    stackAtStart: first.stackBefore,
    spr: potAtStart > 0 ? first.stackBefore / potAtStart : null,
    actions: mine,
    facedBet: street === 'preflop' ? first.toCall > 0 : Boolean(aggressor),
    bettor: aggressor?.player ?? null,
    bet: kinds.includes('bet'),
    raised: kinds.includes('raise'),
    called: kinds.includes('call'),
    checked: kinds.includes('check'),
    folded: kinds.includes('fold'),
    checkRaised: checkedThenRaised,
  };
}

function classifyPreflop(
  hand: Hand,
  hero: string,
): Pick<
  HeroHand,
  | 'role'
  | 'facingRaises'
  | 'limpersAhead'
  | 'firstInOpp'
  | 'threeBetOpp'
  | 'threeBet'
  | 'faced3Bet'
  | 'foldedTo3Bet'
  | 'stealDefenceOpp'
  | 'stealDefence'
> {
  const pre = hand.actions.filter((a) => a.street === 'preflop' && isVoluntary(a));
  const heroPos = hand.position[hero] ?? '?';

  let raises = 0;
  let limpers = 0;
  let callersSinceRaise = 0;
  let lastRaiser: string | null = null;

  let role: PreflopRole = 'fold';
  let seenHero = false;
  let threeBetOpp = false;
  let threeBet = false;
  let faced3Bet = false;
  let foldedTo3Bet = false;
  let stealDefenceOpp = false;
  let stealDefence: HeroHand['stealDefence'] = null;
  let heroRaised = false;
  let facingRaises = 0;
  let limpersAhead = 0;

  for (const a of pre) {
    if (a.player === hero) {
      if (!seenHero) {
        seenHero = true;
        facingRaises = raises;
        limpersAhead = limpers;
        threeBetOpp = raises === 1;

        if (a.kind === 'fold') role = 'fold';
        else if (a.kind === 'check') role = 'bb-check';
        else if (a.kind === 'call') {
          if (raises === 0) role = 'limp';
          else role = BLINDS.has(heroPos) ? 'blind-defend' : 'cold-call';
        } else if (a.kind === 'raise') {
          heroRaised = true;
          if (raises === 0) role = limpers > 0 ? 'iso-raise' : 'open';
          else if (raises === 1) role = callersSinceRaise > 0 ? 'squeeze' : '3bet';
          else role = '4bet+';
          threeBet = raises === 1;
        }

        if (
          heroPos === 'BB' &&
          raises === 1 &&
          callersSinceRaise === 0 &&
          limpers === 0 &&
          lastRaiser &&
          STEAL_POSITIONS.has(hand.position[lastRaiser] ?? '')
        ) {
          stealDefenceOpp = true;
          stealDefence = a.kind === 'raise' ? '3bet' : a.kind === 'call' ? 'call' : 'fold';
        }
      } else if (heroRaised && faced3Bet && foldedTo3Bet === false && a.kind === 'fold') {
        foldedTo3Bet = true;
      }
    } else if (seenHero && heroRaised && a.kind === 'raise' && !faced3Bet) {
      faced3Bet = true;
    }

    if (a.kind === 'raise') {
      raises += 1;
      callersSinceRaise = 0;
      lastRaiser = a.player;
    } else if (a.kind === 'call') {
      if (raises === 0) limpers += 1;
      else callersSinceRaise += 1;
    }
  }

  return {
    role,
    facingRaises,
    limpersAhead,
    firstInOpp: seenHero && facingRaises === 0 && heroPos !== 'BB',
    threeBetOpp,
    threeBet,
    faced3Bet,
    foldedTo3Bet,
    stealDefenceOpp,
    stealDefence,
  };
}

export function heroHand(hand: Hand): HeroHand | null {
  const hero = hand.hero;
  if (!hero) return null;

  const invested = hand.invested[hero] ?? 0;
  const won = hand.won[hero] ?? 0;

  const pre = classifyPreflop(hand, hero);
  const streets = (['preflop', 'flop', 'turn', 'river'] as const)
    .map((s) => buildStreet(hand, s, hero))
    .filter((s): s is StreetPlay => s !== null);

  const preflopRaises = hand.actions.filter((a) => a.street === 'preflop' && a.kind === 'raise');
  const lastPreflopRaiser = preflopRaises.at(-1)?.player ?? null;

  const seat = hand.seats.find((s) => s.name === hero);
  const startingStack = seat?.chips ?? 0;
  const streetReached = streets.at(-1)?.street ?? 'preflop';

  return {
    id: hand.id,
    tournamentId: hand.tournamentId,
    timestamp: hand.timestamp,
    level: hand.level,
    bb: hand.bb,
    position: hand.position[hero] ?? '?',
    cards: hand.heroCards,
    startingStack,
    stackBB: hand.bb > 0 ? startingStack / hand.bb : 0,
    playersDealt: hand.order.length,

    invested,
    won,
    net: won - invested,
    netBB: hand.bb > 0 ? (won - invested) / hand.bb : 0,

    vpip: pre.role !== 'fold' && pre.role !== 'bb-check',
    pfr: ['open', 'iso-raise', '3bet', 'squeeze', '4bet+'].includes(pre.role),
    ...pre,

    pfa: lastPreflopRaiser === hero,
    sawFlop: streets.some((s) => s.street === 'flop'),
    streetReached,
    showdown: hand.shows.some((s) => s.player === hero),
    wonPot: won > 0,
    streets,
    decisions: hand.actions.filter((a) => a.player === hero && isVoluntary(a)),
    board: hand.board,
  };
}

export function heroHands(hands: Hand[]): HeroHand[] {
  return hands.map(heroHand).filter((h): h is HeroHand => h !== null);
}
