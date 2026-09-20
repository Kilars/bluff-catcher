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
  /** Someone had bet before Hero's *first* action on this street. */
  facedBet: boolean;
  /**
   * Hero had to put chips in at some point on this street.
   *
   * Not the same question as `facedBet`, and the difference is a whole
   * population: checking first out of position and then folding to the bet is
   * the commonest way there is to face a c-bet, and `facedBet` says false for
   * all of it. Postflop, use this one to ask "did Hero face a bet" and
   * `facedBet` to ask "was Hero first to act into one".
   *
   * Preflop it means neither: everyone but a big blind who gets a walk has
   * chips to put in, so it is true for the opener too. Read it on a postflop
   * street or not at all. It also says nothing about *who* bet first — Hero
   * betting and being raised sets it, so a caller that means "Hero faced a
   * c-bet" must exclude `bet` as well.
   */
  facedBetEver: boolean;
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
  /** Calendar date, YYYY-MM-DD, off the export's own clock — the window key. */
  handDate: string;
  level: number;
  bb: number;
  position: string;
  cards: string[] | null;
  startingStack: number;
  /** Starting stack measured in big blinds — the number that drives strategy. */
  stackBB: number;
  playersDealt: number;

  invested: number;
  /**
   * Chips Hero put in before an uncalled bet came back, in big blinds. What it
   * cost to contest the pot: a river bluff that got through is the same size
   * whether or not it was called, and `invested` alone would rank it lower.
   */
  grossBB: number;
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
/**
 * Every label that is a blind, including the heads-up button — which posts the
 * small blind and is therefore in one. Exported because `stats.ts` asks the
 * same question and was answering it with two literals, so `SB/BTN` walked
 * into the cold-call denominator: a heads-up blind defence counted as a
 * cold-call opportunity it could never satisfy.
 */
export const BLINDS = new Set(['SB', 'BB', 'SB/BTN']);

/**
 * The hand's calendar date. GGPoker prints `2026/09/08 20:03:09` with no zone,
 * so this is the export's local day — good enough to slice sessions by, and the
 * only date the file gives us.
 */
function handDate(timestamp: string): string {
  return timestamp.slice(0, 10).replaceAll('/', '-');
}

/**
 * Did Hero reach a showdown?
 *
 * Not "did Hero show": a losing call-down prints `Hero: mucks hand` and no
 * shows line, so reading Hero's own cards counted a showdown only when Hero
 * won one — biasing WTSD down and WSD up every time, and booking the loss to
 * the red line.
 *
 * But "anyone showed" is the same error inverted. An opponent who folds may
 * still flash a hand, which would book an uncontested c-bet win to the blue
 * line. So: Hero did not fold, and either Hero's cards are face up, or someone
 * else's are and Hero's last bet was called — an uncalled bet coming back to
 * Hero is the signature of a pot that ended before anyone had to show.
 */
function sawShowdown(hand: Hand, hero: string): boolean {
  if (hand.actions.some((a) => a.player === hero && a.kind === 'fold')) return false;
  if (hand.shows.some((s) => s.player === hero)) return true;
  return hand.shows.length > 0 && hand.uncalled?.player !== hero;
}

function isVoluntary(a: Action): boolean {
  return a.kind !== 'ante' && a.kind !== 'sb' && a.kind !== 'bb';
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
    facedBetEver: mine.some((a) => a.toCall > 0),
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
  const returned = hand.uncalled?.player === hero ? hand.uncalled.amount : 0;

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
    handDate: handDate(hand.timestamp),
    level: hand.level,
    bb: hand.bb,
    position: hand.position[hero] ?? '?',
    cards: hand.heroCards,
    startingStack,
    stackBB: hand.bb > 0 ? startingStack / hand.bb : 0,
    playersDealt: hand.order.length,

    invested,
    grossBB: hand.bb > 0 ? (invested + returned) / hand.bb : 0,
    won,
    net: won - invested,
    netBB: hand.bb > 0 ? (won - invested) / hand.bb : 0,

    vpip: pre.role !== 'fold' && pre.role !== 'bb-check',
    pfr: ['open', 'iso-raise', '3bet', 'squeeze', '4bet+'].includes(pre.role),
    ...pre,

    pfa: lastPreflopRaiser === hero,
    sawFlop: streets.some((s) => s.street === 'flop'),
    streetReached,
    showdown: sawShowdown(hand, hero),
    wonPot: won > 0,
    streets,
    decisions: hand.actions.filter((a) => a.player === hero && isVoluntary(a)),
    board: hand.board,
  };
}

