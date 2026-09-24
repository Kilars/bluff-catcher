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
import type { Depth } from '../preflop/ranges.ts';
import { BOARD_SEEN, boardType, type BoardType } from './board.ts';
import { decisionsOf, type Decision } from './decisions.ts';
import type { HeroHand } from './hero.ts';
import { depthFor } from './rfi.ts';

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
  /** The stack-depth bucket `rfi.ts` already reads charts by. */
  depth: Depth;
  removals: Removal[];
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
  'check-draw',
  'donk-bet',
  'check-raise-flop',
  'overbet-strong',
  'river-bluff-with-blocker',
  'river-bluff-no-blocker',
  'river-call-marginal',
  'river-check-value',
] as const;

export type Label = (typeof LABELS)[number];

/**
 * The vocabulary. Board texture and hand class are *not* spelled into most of
 * these names, because both are grouping facets — a name carries one only where
 * the facet is the whole event: checking is unremarkable, checking a *draw* is
 * a decision. Section numbers below are `docs/strategy-notes.md`.
 */
function labelsFor(
  d: Decision,
  hand: HandClass,
  rem: Removal[],
  checkRaised: boolean,
  checkedThrough: boolean,
): string[] {
  const out: string[] = [];

  // §2 stage 1: the board picks the c-bet frequency, from ~90% on A-7-2r to
  // ~25% on T-9-7, so the finding is the *named* checks with their textures
  // attached rather than a rate. A check that became a check-raise is excluded
  // — that is not declining the c-bet, it is a different line (§3).
  if (d.pfa && d.street === 'flop' && d.kind === 'check' && !checkRaised) out.push('pfa-check-flop');

  // §2 stage 2: the table says bet a draw often, not always — checking a nut
  // flush draw on a monotone flop is standard — so this is a label, not a flag.
  if (d.kind === 'check' && hand === 'draw') out.push('check-draw');

  // §3: leading into the preflop aggressor as the caller. Mostly dominated —
  // the caller's range is capped and the PFR keeps the top — but correct on low
  // connected boards (6-5-4), where the caller owns the straights and sets. A
  // fact either way; `shared.boardType` is what tells a good lead from a leak.
  if (d.street === 'flop' && !d.pfa && d.kind === 'bet' && !d.facedBet) out.push('donk-bet');

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
  if (d.sizing !== null && d.sizing > OVERBET && hand === 'strong') out.push('overbet-strong');

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

  return out;
}

/** Every labelled postflop decision in one hand, in the order Hero made them. */
export function labelledDecisions(h: HeroHand): LabelledDecision[] {
  const cards = h.cards;
  if (!cards) return [];

  const texture = boardType(h.board);
  const checkRaised = new Set(h.streets.filter((s) => s.checkRaised).map((s) => s.street));
  // Hero checked and the street ended there — no later call, raise or fold to a
  // bet. This is the checked-through line `river-check-value` wants, kept apart
  // from a check that became a bluff-catch or a check-raise.
  const checkedThrough = new Set(
    h.streets
      .filter((s) => s.checked && !s.called && !s.raised && !s.folded)
      .map((s) => s.street),
  );

  return decisionsOf(h).flatMap((d) => {
    if (d.street === 'preflop') return [];
    const board = h.board.slice(0, BOARD_SEEN[d.street]);
    const hand = handClass(cards, board);
    const rem = removals(cards, board);
    const labels = labelsFor(d, hand, rem, checkRaised.has(d.street), checkedThrough.has(d.street));
    if (!labels.length) return [];
    return [
      {
        ...d,
        id: h.id,
        cards,
        board,
        handClass: hand,
        boardType: texture,
        depth: depthFor(d.stackBB),
        removals: rem,
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
