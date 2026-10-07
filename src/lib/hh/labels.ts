/**
 * PLAN-coach.md §3: the axes crossed into labels, and the grouping that
 * replaces counting. Two rules from there govern this file.
 *
 * **A label states a fact and never a verdict** — `overbet-strong` is true of
 * the best bet in the game and of the worst one — and **nothing here counts**:
 * a label carries its instances and the facets they all agree on, because what
 * separates a rule from a misclick is whether the instances *look alike*.
 *
 * Preflop decisions are deliberately unlabelled: `handClass` is the postflop
 * taxonomy, and running it against an empty board would be a category error
 * wearing a real-looking answer. `rfiFolds` and `byRole` cover preflop.
 */

import { handClass, removals, type HandClass, type Removal } from '../read.ts';
import type { Card } from '../odds.ts';
import type { ChartKey } from '../preflop/ranges.ts';
import { BOARD_SEEN, boardType, type BoardType } from './board.ts';
import { decisionOf, sizing, type Decision } from './decisions.ts';
import type { HeroHand, StreetPlay } from './hero.ts';
import { actionLine } from './lines.ts';
import { chartKeyForHand } from './rfi.ts';

/**
 * A decision with everything a model needs to second-guess it, and nothing it
 * would need to grade the result instead. `board` is cut at the street Hero
 * acted on, so a river card Hero never saw cannot leak backwards into a read of
 * a turn decision.
 */
export interface LabelledDecision extends Decision {
  /** The hand id, so the user can find the hand in the client. */
  id: string;
  cards: Card[];
  board: Card[];
  handClass: HandClass;
  /**
   * The *flop's* texture, on every street: later cards change what is possible
   * but not which range the flop handed the initiative to. It is also the cut
   * `byBoard` uses, so the two agree.
   */
  boardType: BoardType | null;
  /** The chart `rfi.ts` already reads: 'cash', or a tournament stack-depth bucket. */
  depth: ChartKey;
  removals: Removal[];
  /** Players who saw the flop — heads-up vs multiway changes every threshold. */
  playersToFlop: number;
  /** Compact blind action line up to Hero's street — see lines.ts. */
  line: string;
  labels: string[];
}

export interface LabelGroup {
  label: string;
  decisions: LabelledDecision[];
  /** Only the facets on which *every* instance agrees. Often empty. */
  shared: Partial<Record<'position' | 'depth' | 'handClass' | 'boardType', string>>;
}

/** Bigger than the pot. §6's size tree has nothing between 75% and 150%. */
const OVERBET = 1;

/**
 * Every label the code can emit. Exported because three places need to agree
 * on it — `--label` validates against it, `doc.test.ts` pins it to the names
 * §4 documents, and a name only one of them knows is a name the agent will
 * either invent or never see.
 */
export const LABELS = [
  'pfa-check-flop',
  'pfa-check-turn',
  'barrel-abandon',
  'cbet-multiway-air',
  'check-draw',
  'donk-bet',
  'turn-probe',
  'check-raise-flop',
  'overbet-strong',
  'river-bluff-with-blocker',
  'river-bluff-no-blocker',
  'river-call-marginal',
  'river-check-value',
  'river-raise-value',
  'river-raise-bluff',
  'fold-to-turn-barrel',
  'fold-to-river-barrel',
  'fold-to-raise',
] as const;

export type Label = (typeof LABELS)[number];

/**
 * The vocabulary. Board texture and hand class are *not* spelled into most of
 * these names, because both are grouping facets — a name carries one only where
 * the facet is the whole event: checking is unremarkable, checking a *draw* is
 * a decision. Section numbers below are `docs/strategy-notes.md`.
 */
/**
 * The per-decision line facts each predicate reads, all booleans and all derived
 * once per hand in `labelledDecisions`. Named rather than positional because
 * nine same-typed flags in a row is a transposition waiting to type-check.
 */
interface LabelFlags {
  checkRaised: boolean;
  checkedThrough: boolean;
  checkedGaveUp: boolean;
  betFlop: boolean;
  betTurn: boolean;
  multiwayFlop: boolean;
  pfaCheckedFlop: boolean;
  pfaYetToActFlop: boolean;
  heroAggressed: boolean;
  villainBetFlop: boolean;
  villainBetTurn: boolean;
  /**
   * A shove's size as a fraction of the pot, at what an opponent can call
   * (`sizing` in decisions.ts). `Decision.sizing` is null on a shove (the stack
   * chose it), but "bigger than the pot" is still a fact about a jam, so
   * `overbet-strong` reads this when `sizing` is null — and a jam bigger than
   * the villain's stack is only as big as the part the villain could call.
   */
  shoveSizing: number | null;
}

function labelsFor(d: Decision, hand: HandClass, rem: Removal[], f: LabelFlags): string[] {
  const {
    checkRaised,
    checkedThrough,
    checkedGaveUp,
    betFlop,
    betTurn,
    multiwayFlop,
    pfaCheckedFlop,
    pfaYetToActFlop,
    heroAggressed,
    villainBetFlop,
    villainBetTurn,
    shoveSizing,
  } = f;
  const out: string[] = [];

  // §2 stage 1: the board picks the c-bet frequency, from ~90% on A-7-2r to
  // ~25% on T-9-7, so the finding is the *named* checks with their textures
  // attached rather than a rate. A check that became a check-raise is excluded
  // — that is not declining the c-bet, it is a different line (§3).
  if (d.pfa && d.street === 'flop' && d.kind === 'check' && !checkRaised) out.push('pfa-check-flop');

  // §2 stage 1, one street later: Hero kept the initiative on the flop (bet it)
  // and then checked the turn. Gated on `betFlop` because a turn check after a
  // flop check is not surrendering initiative — that was already gone, and the
  // flop check is `pfa-check-flop`'s to name. A check that became a turn
  // check-raise is excluded for the same reason it is on the flop: that is a
  // different line, not a declined barrel.
  if (d.pfa && d.street === 'turn' && d.kind === 'check' && betFlop && !checkRaised)
    out.push('pfa-check-turn');

  // §2 stage 1, the line played out to its end: Hero fired the flop AND the turn
  // (`betFlop && betTurn`) and then gave up the river with air — two barrels, then
  // a give-up on the last card the bluff had to be told on. Unlike `pfa-check-turn`
  // this is not a preflop-earned initiative surrendered but a *held* barrel line
  // abandoned, which is why it wants both prior bets in the gate. `hand === 'air'`
  // keeps it off the showdown-value check-back, which is `river-check-value`'s
  // (`strong`/`marginal-made`) to name — so the two cannot co-fire. `checkedGaveUp`
  // is the give-up: the river check went to showdown or folded to a bet, never a
  // check-then-call — a check-then-call after two barrels is a bluff-catch, not an
  // abandoned line, exactly as `river-check-value` keeps the checked-through case
  // apart from the call. A candidate, never a verdict: a third barrel with no fold
  // equity on a bricked board can be the correct give-up, and it names no frequency.
  if (
    d.pfa &&
    d.street === 'river' &&
    d.kind === 'check' &&
    hand === 'air' &&
    betFlop &&
    betTurn &&
    checkedGaveUp
  )
    out.push('barrel-abandon');

  // §2: the aggressor c-bets the flop with air into 3+ players. Heads-up an air
  // c-bet on a dry board is standard, so no bare `cbet-air` label exists — but
  // multiway the fold equity that a bluff-c-bet lives on has to clear *every*
  // villain, and each extra player behind is another range that has to fold.
  // `!d.facedBet` states the contract: a bet after the caller donked and Hero
  // raised is a different line, not a c-bet. A candidate, never a verdict —
  // backdoor equity or a coherent barrel plan can make this fine, and it never
  // implies a frequency, so `multiwayFlop` is a per-decision fact, not a rate.
  if (d.pfa && d.street === 'flop' && d.kind === 'bet' && !d.facedBet && hand === 'air' && multiwayFlop)
    out.push('cbet-multiway-air');

  // §2 stage 2: the table says bet a draw often, not always — checking a nut
  // flush draw on a monotone flop is standard — so this is a label, not a flag.
  // A check Hero went on to check-raise is the aggressive line, not a passive
  // one, so it is left out, as `pfa-check-flop` and `pfa-check-turn` leave it.
  if (d.kind === 'check' && hand === 'draw' && !checkRaised) out.push('check-draw');

  // §3: leading into the preflop aggressor as the caller. Mostly dominated —
  // the caller's range is capped and the PFR keeps the top — but correct on low
  // connected boards (6-5-4), where the caller owns the straights and sets. A
  // fact either way; `shared.boardType` is what tells a good lead from a leak.
  // `pfaYetToActFlop` is what makes it a lead *into* the raiser: a bet after the
  // raiser checked is a stab at a declined c-bet, not a donk.
  if (d.street === 'flop' && !d.pfa && d.kind === 'bet' && !d.facedBet && pfaYetToActFlop)
    out.push('donk-bet');

  // §3: the caller bets the turn after the preflop raiser CHECKED BACK the flop
  // — betting into a *declined* c-bet, which is the strict meaning of "probe".
  // Gated on `pfaCheckedFlop` (the flop went check-check, so the only other
  // aggressor declined it), never on any turn lead: a turn bet after Hero faced
  // and called a flop c-bet is a different line, not a probe. `pfaYetToActFlop`
  // makes the check a check *back*: Hero acted first on the flop, into a raiser
  // who then declined. Without it a limped pot (no raiser) or Hero in position
  // (the raiser checked to Hero, Hero checked behind) would borrow the name for
  // what is a stab. `pfaCheckedFlop` is a clean heads-up read; multiway it can
  // misattribute the declined bet, so the rubric carries that as an `unless`.
  if (!d.pfa && d.street === 'turn' && d.kind === 'bet' && pfaCheckedFlop && pfaYetToActFlop)
    out.push('turn-probe');

  // §3: check-raising the flop as the caller — "correct and underused". Built
  // from equity-when-called (sets, two pair, combo draws), and its frequency
  // swings hard with texture, so the board it happened on is the read, not the
  // raise. Gated on the check-then-raise flag so an IP raise-over-a-lead — which
  // is not a check-raise — does not borrow the name.
  if (d.street === 'flop' && !d.pfa && d.kind === 'raise' && checkRaised) out.push('check-raise-flop');

  // §6: a size above the pot is gated on nut advantage, and the same fact reads
  // as the recommended line or as an instantly readable value bet depending on
  // hand and board, so both live in one label.
  //
  // Named `overbet-strong`, not PLAN §3's illustrative `overbet-with-nuts`,
  // because read.ts's `strong` admits an overpair and top pair with a Q kicker.
  // Those are not the nuts, and a label may not assert what nothing computed.
  //
  // A shove counts at its pot fraction: an all-in for several pots with a
  // strong hand is the overbet, whatever chose the size.
  const size = d.sizing ?? shoveSizing;
  if (size !== null && size > OVERBET && hand === 'strong') out.push('overbet-strong');

  // §5: on the river every bet is a pure bluff; `air` is the first selection
  // filter, no showdown value, and the split is the second, blockers.
  //
  // Which *way* a blocker points is deliberately not decided here: it reverses
  // with the board (§4) and pinning it down needs a villain range, which PLAN
  // §3 forbids. The label reports the removal and stops.
  if (d.street === 'river' && d.kind === 'bet' && hand === 'air') {
    out.push(rem.length ? 'river-bluff-with-blocker' : 'river-bluff-no-blocker');
  }

  // §4: a marginal made hand facing a river bet is the call/fold boundary, and
  // the decision this repo is named after. Hero's removals come attached.
  if (d.street === 'river' && d.kind === 'call' && d.facedBet && hand === 'marginal-made') {
    out.push('river-call-marginal');
  }

  // §6: the value-side mirror of `overbet-strong`. Only when the river checked
  // *through* — a check that then called or raised a bet is a bluff-catch
  // (`river-call-marginal`), not a bet declined — so this is the checked-back
  // made hand, the one place value quietly goes missing. §6's amateur adjustment
  // is to value-bet thinner against pools that don't fold, which is exactly what
  // a check here forgoes. States only that Hero checked a made hand to showdown;
  // whether value was there is the reader's call from the board and the pool.
  if (
    d.street === 'river' &&
    d.kind === 'check' &&
    checkedThrough &&
    (hand === 'strong' || hand === 'marginal-made')
  ) {
    out.push('river-check-value');
  }

  // §4/§5: raising over a river bet — the one river action no label modelled.
  // Split by hand class the same way the river bet is: a made hand raises for
  // value, air raises as a bluff. `facedBet` is kept explicit and consistent
  // with `river-call-marginal` — a raise implies a bet was faced, but the guard
  // states the contract rather than leaning on `kind` alone.
  if (d.street === 'river' && d.kind === 'raise' && d.facedBet) {
    if (hand === 'strong' || hand === 'marginal-made') out.push('river-raise-value');
    // Which way a blocker points is not decided here, exactly as the river-bet
    // bluff labels leave it: that reverses with the board and needs a villain
    // range PLAN §3 forbids. The label reports the raise-as-bluff and stops.
    else if (hand === 'air') out.push('river-raise-bluff');
  }

  // Facing aggression (over-folding), folds only. "Barrel" is load-bearing: the
  // villain must have ALSO bet the previous street (a continued bet), not merely
  // bet this one. `villainBetFlop`/`villainBetTurn` assert exactly that from the
  // prior street's play; a fold to a lone bet with no prior aggression carries
  // no label, so the name does not lie. `d.facedBet` reads the street as printed
  // (decisions.ts) and catches the check-then-fold that is the commonest way to
  // face a barrel. `!heroAggressed` keeps out the fold to a raise of Hero's own
  // bet or raise this street: the villain then raised a lead, and a raise of
  // Hero's bet is not a continued barrel — that fold is `fold-to-raise`. The
  // label is a candidate — whether the fold was an over-fold is the reader's
  // call from the price and hand class, never a verdict here.
  if (d.street === 'turn' && d.kind === 'fold' && d.facedBet && !heroAggressed && villainBetFlop)
    out.push('fold-to-turn-barrel');
  if (d.street === 'river' && d.kind === 'fold' && d.facedBet && !heroAggressed && villainBetTurn)
    out.push('fold-to-river-barrel');
  // The fold the barrel labels leave out: Hero bet or raised this street, was
  // raised, and let it go. Mutually exclusive with them by `heroAggressed`. A
  // candidate like them — small-stakes raises are value-heavy, so the fold is
  // often right; the price and hand class decide, never the label.
  if (d.street !== 'preflop' && d.kind === 'fold' && d.facedBet && heroAggressed) out.push('fold-to-raise');

  return out;
}

/** Every labelled postflop decision in one hand, in the order Hero made them. */
export function labelledDecisions(h: HeroHand): LabelledDecision[] {
  const cards = h.cards;
  if (!cards) return [];

  const texture = boardType(h.board);
  const flop = h.streets.find((s) => s.street === 'flop');
  const playersToFlop = h.playersToFlop;
  // 3+ players saw the flop: an air c-bet now needs every one of them to fold,
  // not just one. Threaded into `labelsFor` like `betFlop`; the count itself
  // rides on each LabelledDecision as a grouping facet.
  const multiwayFlop = playersToFlop > 2;
  const checkRaised = new Set(h.streets.filter((s) => s.checkRaised).map((s) => s.street));
  // Hero checked and the street ended there — no later call, raise or fold to a
  // bet. This is the checked-through line `river-check-value` wants, kept apart
  // from a check that became a bluff-catch or a check-raise.
  const checkedThrough = new Set(
    h.streets
      .filter((s) => s.checked && !s.called && !s.raised && !s.folded)
      .map((s) => s.street),
  );
  // Hero checked and then gave the street up — the check went to showdown or
  // folded to a bet, but never became a call or a raise. `barrel-abandon` reads
  // this to keep a river check-then-call (a bluff-catch, not an abandoned line)
  // out, the same way `checkedThrough` keeps it out of `river-check-value`; this
  // one also admits the check-then-fold, which is a give-up too.
  const checkedGaveUp = new Set(
    h.streets.filter((s) => s.checked && !s.called && !s.raised).map((s) => s.street),
  );
  const turn = h.streets.find((s) => s.street === 'turn');
  // Hero bet the flop. `pfa-check-turn` reads this — Hero took the c-bet, so a
  // later turn check is a barrel declined and not a pot already surrendered on
  // the flop.
  const betFlop = Boolean(flop && flop.bet);
  // Hero bet the turn. `barrel-abandon` reads this alongside `betFlop` — two
  // barrels fired — so a river check with air is a barrel line given up, not a
  // pot that was never contested. Exact copy of the `betFlop` pattern, reusing
  // the `turn` binding above.
  const betTurn = Boolean(turn && turn.bet);
  // The flop went check-check: Hero checked, never faced a bet and never bet
  // it, so the preflop aggressor (the only other range that could c-bet)
  // declined it. This is what `turn-probe` bets into. Read heads-up; multiway a
  // third player could be the one who checked, hence the rubric caveat.
  const pfaCheckedFlop = Boolean(flop && flop.checked && !flop.bet && !flop.facedBetEver);
  // The preflop raiser had not acted on the flop when Hero first did — Hero was
  // leading into them. False in a limped pot (no raiser to lead into) and when
  // the raiser already checked, which turns a caller's bet into a stab.
  const pfaPlayer = h.preflopRaiser;
  const pfaYetToActFlop = Boolean(
    flop &&
      pfaPlayer &&
      !flop.allActions
        .slice(0, flop.allActions.indexOf(flop.actions[0]))
        .some((a) => a.player === pfaPlayer),
  );
  // A villain barrelled a street: a villain bet or raised on it, read off the
  // street as printed (`actions` is Hero's own, so anything else is a villain's).
  // A raise of Hero's own bet counts — it is the villain's aggression on that
  // street, the strongest kind, so calling it and folding to the next bet is a
  // fold to a continued barrel. This is the prior-street aggression
  // `fold-to-*-barrel` requires — a continued bet, not a lone stab. Multiway
  // the two bets can come from different villains, hence the rubric caveat.
  const villainBarrelled = (s?: StreetPlay) =>
    Boolean(s?.allActions.some((a) => !s.actions.includes(a) && (a.kind === 'bet' || a.kind === 'raise')));
  const villainBetFlop = villainBarrelled(flop);
  const villainBetTurn = villainBarrelled(turn);
  // Hero bet or raised a street. The fold-to-barrel labels read it so a fold to
  // a raise of Hero's own lead is not called a fold to a barrel.
  const heroAggressed = new Set(h.streets.filter((s) => s.bet || s.raised).map((s) => s.street));

  // Each decision beside the action it came from, so the shove size below reads
  // the action itself rather than a position in a parallel list.
  const pairs = h.streets.flatMap((s) => s.actions.map((a) => [decisionOf(h, s, a), a] as const));

  return pairs.flatMap(([d, a]) => {
    if (d.street === 'preflop') return [];
    const board = h.board.slice(0, BOARD_SEEN[d.street]);
    const hand = handClass(cards, board);
    const rem = removals(cards, board);
    const labels = labelsFor(d, hand, rem, {
      checkRaised: checkRaised.has(d.street),
      checkedThrough: checkedThrough.has(d.street),
      checkedGaveUp: checkedGaveUp.has(d.street),
      betFlop,
      betTurn,
      multiwayFlop,
      pfaCheckedFlop,
      pfaYetToActFlop,
      heroAggressed: heroAggressed.has(d.street),
      villainBetFlop,
      villainBetTurn,
      shoveSizing: d.allIn ? sizing(a) : null,
    });
    if (!labels.length) return [];
    return [
      {
        ...d,
        id: h.id,
        cards,
        board,
        handClass: hand,
        boardType: texture,
        depth: chartKeyForHand(h),
        removals: rem,
        playersToFlop,
        line: actionLine(h, d.street),
        labels,
      },
    ];
  });
}

export const FACETS = ['position', 'depth', 'handClass', 'boardType'] as const;

/**
 * The facets every instance agrees on — the finding itself. "Three offsuit-ace
 * folds, all cutoff, all 45–55bb" is a rule the player is carrying; scattered
 * instances agree on nothing and `shared` comes back empty, which reads as "no
 * pattern here" with no denominator, minimum sample or interval in it.
 *
 * Sayable at n = 2, but not at n = 1, which is why one instance shares nothing:
 * a lone decision trivially "agrees" with itself on all four facets, and a full
 * `shared` block would hand the agent a rule built from one hand.
 */
function sharedFacets(ds: LabelledDecision[]): LabelGroup['shared'] {
  const shared: LabelGroup['shared'] = {};
  if (ds.length < 2) return shared;
  for (const facet of FACETS) {
    const first = ds[0][facet];
    // Every cash hand reads the one cash chart, so 'cash' is the variant, not
    // a fact the instances agree on — sharing it made every cash group a pattern.
    if (facet === 'depth' && first === 'cash') continue;
    if (first !== null && ds.every((d) => d[facet] === first)) shared[facet] = first;
  }
  return shared;
}

export function labelGroups(hands: HeroHand[]): LabelGroup[] {
  const byLabel = new Map<string, LabelledDecision[]>();
  for (const h of hands) {
    for (const d of labelledDecisions(h)) {
      for (const label of d.labels) byLabel.set(label, [...(byLabel.get(label) ?? []), d]);
    }
  }
  return [...byLabel].map(([label, decisions]) => ({
    label,
    decisions,
    shared: sharedFacets(decisions),
  }));
}
