/**
 * Turns parsed hands into Hero-centric facts: what Hero did, what it cost, and
 * what the pot looked like at each decision.
 *
 * Deliberately light on preflop *opening* ranges — those are trained elsewhere
 * in the app. The categories here are about the spots a chart does not cover:
 * 3-betting, defending, and every postflop street.
 */

import { STREETS, isDecision, type Action, type GameVariant, type Hand, type Street } from './parse.ts';

/**
 * How Hero entered (or declined) the pot. `no-decision` is a hand Hero never
 * acted in preflop — a big-blind walk, or an all-in from the blind or ante post —
 * so it is neither a fold nor a hand Hero chose to play.
 */
export type PreflopRole =
  | 'no-decision'
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
  /**
   * Stack-to-pot ratio Hero was playing, on the *effective* stack: Hero's, or
   * the biggest stack still live against Hero if that is smaller. Hero covering
   * a short villain is not deep — only the short stack can go in.
   */
  spr: number | null;
  actions: Action[];
  /**
   * The street exactly as printed, villains included.
   *
   * `actions` is Hero's alone, which leaves villain sizing unrecoverable. The
   * only trace a villain bet leaves in Hero's own actions is `toCall`, and
   * that is lossy the moment more than one opponent is in: a bet, a call and
   * a raise ahead of Hero all arrive as one number, so what Hero *faced*
   * cannot be read back out of what Hero *owed*. Keep the whole street and
   * let callers read the bet itself.
   */
  allActions: Action[];
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
  variant: GameVariant;
  tournamentId: string;
  timestamp: string;
  /** Calendar date, YYYY-MM-DD, off the export's own clock — the window key. */
  handDate: string;
  level: number;
  bb: number;
  position: string;
  /**
   * Players left to act after Hero preflop (0 on the button), counted off the
   * live seats. The table label cannot say this for early seats: they are
   * named from the front (UTG, UTG1…), so a 7-handed UTG is the 9-max UTG+2.
   */
  seatsToButton: number;
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
  /** Seat of the raiser Hero faced when first acting; null first-in or unraised. */
  facingRaiserPos: string | null;
  /** Seat of the first raiser (the opener) when Hero first acted; null unraised. */
  openerPos: string | null;
  /** Limpers already in when Hero first had to decide. */
  limpersAhead: number;
  /** Hero could have entered first in (no raise ahead, not in the BB). */
  firstInOpp: boolean;
  /** Hero faced exactly one raise and had not yet acted. */
  threeBetOpp: boolean;
  threeBet: boolean;
  /**
   * Hero raised and someone raised over the top, with chips left for Hero to
   * answer it — a re-shove over Hero's all-in is no decision. Any raise counts:
   * an open facing a 3-bet and a 3-bet facing a 4-bet both set it (`role` says
   * which), so the `foldTo3Bet` stat narrows it to opens.
   */
  faced3Bet: boolean;
  foldedTo3Bet: boolean;
  /** Seat of the villain who raised over Hero's raise; null unless faced3Bet. */
  threeBettorPos: string | null;
  /** A caller was already in when that raise landed — a squeeze, pot heading multiway. */
  faced3BetMultiway: boolean;
  /**
   * The raise's size as a fraction of the pot it raised over, capped at Hero's
   * stack — a jam for more than Hero has is sized at the part Hero can call.
   * Null if unreadable.
   */
  faced3BetSizing: number | null;
  /**
   * Another player raised again over that raise before Hero answered it — a
   * cold 4-bet. Hero's answer is then to two raises, so `foldTo3Bet` leaves the
   * hand out; `faced3BetResponse` still records what Hero did.
   */
  faced3BetCold4Bet: boolean;
  /** How Hero answered it. '4bet' is the re-raise whatever street of the war it is. */
  faced3BetResponse: 'fold' | 'call' | '4bet' | null;
  /** Hero was in the BB facing a lone steal-position open. */
  stealDefenceOpp: boolean;
  stealDefence: 'fold' | 'call' | '3bet' | null;

  /** Hero is the preflop aggressor (`preflopRaiser`). */
  pfa: boolean;
  /**
   * The preflop aggressor, Hero or not: the last preflop raiser who was neither
   * all-in nor folded by the end of preflop. Null in an unraised pot, and when
   * every raiser is all-in or folded — nobody is left to c-bet or be led into.
   */
  preflopRaiser: string | null;
  /** Hero acted on the flop — the c-bet stats' population, which needs a flop decision. */
  sawFlop: boolean;
  /**
   * The flop was dealt with Hero still in, acted on or not. A preflop all-in
   * that runs out has no flop decision but did see the flop, and the showdown
   * stats (WTSD / W$SD / WWSF) count it, as trackers do.
   */
  flopDealtLive: boolean;
  /**
   * Players still in when the flop was dealt — every dealt player without a
   * preflop fold, Hero or not, so a preflop all-in who never acts again
   * counts. 0 when no flop was dealt.
   */
  playersToFlop: number;
  streetReached: Street;
  showdown: boolean;
  wonPot: boolean;
  streets: StreetPlay[];
  /** Every voluntary Hero action, for drill-down on the big pots. */
  decisions: Action[];
  board: string[];
}

const STEAL_POSITIONS = new Set(['CO', 'BTN', 'SB']);
const VPIP_ROLES = new Set<PreflopRole>([
  'limp',
  'open',
  'iso-raise',
  'cold-call',
  'blind-defend',
  '3bet',
  'squeeze',
  '4bet+',
]);
const PFR_ROLES = new Set<PreflopRole>(['open', 'iso-raise', '3bet', 'squeeze', '4bet+']);
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

/**
 * The most chips that can go in against Hero from the start of `street`: Hero's
 * own stack, capped by the deepest opponent still in. Stacks are the header
 * chips less everything each player put in on earlier streets; an opponent who
 * folded before the street is out of it.
 */
function effectiveStack(hand: Hand, street: Street, hero: string, heroStack: number): number {
  const earlier = hand.actions.filter((a) => STREETS.indexOf(a.street) < STREETS.indexOf(street));
  const folded = new Set(earlier.filter((a) => a.kind === 'fold').map((a) => a.player));
  let deepest = 0;
  for (const seat of hand.seats) {
    if (seat.name === hero || folded.has(seat.name) || !hand.order.includes(seat.name)) continue;
    const put = earlier.filter((a) => a.player === seat.name).reduce((t, a) => t + a.amount, 0);
    deepest = Math.max(deepest, seat.chips - put);
  }
  return Math.min(heroStack, deepest);
}

function buildStreet(hand: Hand, street: Street, hero: string): StreetPlay | null {
  const all = hand.actions.filter((a) => a.street === street);
  const mine = all.filter((a) => a.player === hero && isDecision(a));
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
    spr: potAtStart > 0 ? effectiveStack(hand, street, hero, first.stackBefore) / potAtStart : null,
    actions: mine,
    allActions: all,
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
  | 'facingRaiserPos'
  | 'openerPos'
  | 'limpersAhead'
  | 'firstInOpp'
  | 'threeBetOpp'
  | 'threeBet'
  | 'faced3Bet'
  | 'foldedTo3Bet'
  | 'threeBettorPos'
  | 'faced3BetMultiway'
  | 'faced3BetSizing'
  | 'faced3BetCold4Bet'
  | 'faced3BetResponse'
  | 'stealDefenceOpp'
  | 'stealDefence'
> {
  const pre = hand.actions.filter((a) => a.street === 'preflop' && isDecision(a));
  const heroPos = hand.position[hero] ?? '?';

  let raises = 0;
  let limpers = 0;
  let callersSinceRaise = 0;
  let lastRaiser: string | null = null;
  let firstRaiser: string | null = null;

  let role: PreflopRole = 'fold';
  let seenHero = false;
  let threeBetOpp = false;
  let threeBet = false;
  let faced3Bet = false;
  let foldedTo3Bet = false;
  let threeBettorPos: string | null = null;
  let faced3BetMultiway = false;
  let faced3BetSizing: number | null = null;
  let faced3BetCold4Bet = false;
  let faced3BetResponse: HeroHand['faced3BetResponse'] = null;
  let stealDefenceOpp = false;
  let stealDefence: HeroHand['stealDefence'] = null;
  let heroRaised = false;
  // Hero's latest raise: how far Hero can follow a raise over it.
  let heroRaise: Action | null = null;
  // A raise that was all-in leaves Hero nothing to answer a re-raise with.
  let heroAllIn = false;
  let facingRaises = 0;
  let facingRaiserPos: string | null = null;
  let openerPos: string | null = null;
  let limpersAhead = 0;

  for (const a of pre) {
    if (a.player === hero) {
      if (!seenHero) {
        seenHero = true;
        facingRaises = raises;
        facingRaiserPos = lastRaiser ? (hand.position[lastRaiser] ?? null) : null;
        openerPos = firstRaiser ? (hand.position[firstRaiser] ?? null) : null;
        limpersAhead = limpers;
        threeBetOpp = raises === 1;

        if (a.kind === 'fold') role = 'fold';
        else if (a.kind === 'check') role = 'bb-check';
        else if (a.kind === 'call') {
          if (raises === 0) role = 'limp';
          else role = BLINDS.has(heroPos) ? 'blind-defend' : 'cold-call';
        } else if (a.kind === 'raise') {
          heroRaised = true;
          heroRaise = a;
          heroAllIn = a.allIn;
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
      } else if (heroRaised && faced3Bet && faced3BetResponse === null) {
        // Hero's first answer to the raise over the top: the fold keeps the
        // existing foldedTo3Bet flag the stat reads, and call/4bet fill in the
        // rest so the spot can be coached without a result.
        if (a.kind === 'fold') {
          foldedTo3Bet = true;
          faced3BetResponse = 'fold';
        } else if (a.kind === 'call') {
          faced3BetResponse = 'call';
        } else if (a.kind === 'raise') {
          faced3BetResponse = '4bet';
        }
      }
    } else if (faced3Bet && faced3BetResponse === null && a.kind === 'raise') {
      // A further raise before Hero answered the first: Hero now faces a 4-bet.
      faced3BetCold4Bet = true;
    } else if (seenHero && heroRaised && !heroAllIn && a.kind === 'raise' && !faced3Bet) {
      faced3Bet = true;
      threeBettorPos = hand.position[a.player] ?? null;
      // callersSinceRaise is still pre-`a` here (the bottom of the loop updates
      // it after), so it counts the flats of Hero's raise — i.e. a squeeze.
      faced3BetMultiway = callersSinceRaise > 0;
      // Sized at what Hero can call: a jam for more than Hero has is, to Hero,
      // a raise to Hero's whole stack. `to - raiseBy` is the level it raised
      // over (Hero's raise), and Hero reaches that plus what Hero had left.
      const reach = heroRaise?.to !== undefined ? heroRaise.to + heroRaise.stackBefore - heroRaise.amount : Infinity;
      faced3BetSizing =
        a.raiseBy !== undefined && a.to !== undefined && a.potBefore + a.toCall > 0
          ? Math.max(0, Math.min(a.to, reach) - (a.to - a.raiseBy)) / (a.potBefore + a.toCall)
          : null;
    }

    if (a.kind === 'raise') {
      raises += 1;
      callersSinceRaise = 0;
      lastRaiser = a.player;
      firstRaiser ??= a.player;
    } else if (a.kind === 'call') {
      if (raises === 0) limpers += 1;
      else callersSinceRaise += 1;
    }
  }

  return {
    // Hero never acted: there was nothing to fold, so 'fold' would be a lie.
    role: seenHero ? role : 'no-decision',
    facingRaises,
    facingRaiserPos,
    openerPos,
    limpersAhead,
    firstInOpp: seenHero && facingRaises === 0 && heroPos !== 'BB',
    threeBetOpp,
    threeBet,
    faced3Bet,
    foldedTo3Bet,
    threeBettorPos,
    faced3BetMultiway,
    faced3BetSizing,
    faced3BetCold4Bet,
    faced3BetResponse,
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

  // The aggressor postflop play is read against: the last preflop raiser who
  // still had chips when the flop came. An all-in raiser never acts again, so
  // naming one made every flop lead a "donk" into a player who cannot bet, and
  // hid the real raiser's c-bet or check behind a short stack's jam. A raiser
  // who folded to a re-raise is gone too: open, jam behind, open folds.
  const preflop = hand.actions.filter((a) => a.street === 'preflop');
  const outPreflop = new Set(preflop.filter((a) => a.allIn || a.kind === 'fold').map((a) => a.player));
  const lastPreflopRaiser =
    preflop.filter((a) => a.kind === 'raise' && !outPreflop.has(a.player)).at(-1)?.player ?? null;

  const seat = hand.seats.find((s) => s.name === hero);
  const startingStack = seat?.chips ?? 0;
  const streetReached = streets.at(-1)?.street ?? 'preflop';

  return {
    id: hand.id,
    variant: hand.variant,
    tournamentId: hand.tournamentId,
    timestamp: hand.timestamp,
    handDate: handDate(hand.timestamp),
    level: hand.level,
    bb: hand.bb,
    position: hand.position[hero] ?? '?',
    // The button is always last in `order`, dead small blind or not.
    seatsToButton: hand.order.length - 1 - hand.order.indexOf(hero),
    cards: hand.heroCards,
    startingStack,
    stackBB: hand.bb > 0 ? startingStack / hand.bb : 0,
    playersDealt: hand.order.length,

    invested,
    grossBB: hand.bb > 0 ? (invested + returned) / hand.bb : 0,
    won,
    net: won - invested,
    netBB: hand.bb > 0 ? (won - invested) / hand.bb : 0,

    // Whitelisted, not "anything but a fold": a walk or a post-all-in is not a
    // fold and did not put chips in voluntarily either.
    vpip: VPIP_ROLES.has(pre.role),
    pfr: PFR_ROLES.has(pre.role),
    ...pre,

    pfa: lastPreflopRaiser === hero,
    preflopRaiser: lastPreflopRaiser,
    sawFlop: streets.some((s) => s.street === 'flop'),
    flopDealtLive:
      hand.streets.includes('flop') &&
      !hand.actions.some((a) => a.player === hero && a.street === 'preflop' && a.kind === 'fold'),
    playersToFlop: hand.streets.includes('flop')
      ? hand.order.filter((p) => !preflop.some((a) => a.player === p && a.kind === 'fold')).length
      : 0,
    streetReached,
    showdown: sawShowdown(hand, hero),
    wonPot: won > 0,
    streets,
    decisions: hand.actions.filter((a) => a.player === hero && isDecision(a)),
    board: hand.board,
  };
}

