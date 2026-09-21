/**
 * PLAN-coach.md §3: the axes crossed into labels, and the grouping that
 * replaces counting.
 *
 * **A label states a fact and never a verdict.** An earlier draft made a label
 * *be* a mistake — prescription versus action, tag fires on mismatch — and
 * three of the five labels it produced then fired on lines
 * `docs/strategy-notes.md` recommends outright. So nothing here decides whether
 * a decision was wrong. `overbet-strong` is true of the best bet in the game
 * and of the worst one, and telling those apart is the agent's job, with the
 * hand in front of it.
 *
 * **Nothing here counts.** A leak is not a sampling question: folding AJo from
 * the cutoff once may be a misclick, fifteen times is a rule being carried
 * around, and no confidence interval separates those — what separates them is
 * whether the instances *look alike*. So a label carries its instances and the
 * facets they all agree on, and the payload hands both to the agent.
 *
 * Preflop decisions are deliberately unlabelled. `rfiFolds` already says the
 * one per-hand preflop thing this repo can say soundly, `byRole` says how Hero
 * entered, and `handClass` here is the postflop taxonomy — running it against
 * an empty board would be a category error wearing a real-looking answer.
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
 * would need to grade the result instead.
 *
 * `board` is cut at the street Hero acted on, so a river card Hero never saw
 * cannot leak backwards into a read of a turn decision.
 */
export interface LabelledDecision extends Decision {
  /** The hand id, so the user can find the hand in the client. */
  id: string;
  cards: Card[];
  board: Card[];
  handClass: HandClass;
  /**
   * The *flop's* texture, on every street. Turn and river cards change what is
   * possible, but they do not change which range the flop handed the initiative
   * to, and that is what the five buckets describe — it is also the cut
   * `byBoard` already uses, so the two agree.
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
 * The vocabulary. Six labels, each argued for below; a label that cannot be
 * argued for is a label nobody can act on, and twenty of those are worse than
 * none. Board texture and hand class are *not* spelled into most of these
 * names, because both are grouping facets — a group whose instances share a
 * texture says so itself, and one whose instances do not has said something
 * too, namely that there is no pattern there.
 *
 * Where a name does carry a facet it is because the facet is the whole event:
 * checking is unremarkable, checking a *draw* is a decision; and splitting the
 * river bluffs by hand class up front makes two groups that can each agree on
 * a texture instead of one mixed group that agrees on nothing.
 */
function labelsFor(
  d: Decision,
  hand: HandClass,
  rem: Removal[],
  checkRaised: boolean,
): string[] {
  const out: string[] = [];

  // §2 stage 1: the board picks the c-bet frequency, and it runs from ~90% on
  // A-7-2r to ~25% on T-9-7. A flat percentage is correct at neither, so the
  // interesting object is the *named* checks with their textures attached —
  // all five on `middling-theirs` is the discipline §2 asks for, all five on
  // `dry-high-mine` is giving back what the raise bought. The group's
  // `shared.boardType` is that finding, and the code does not pick a side.
  //
  // A check that became a check-raise is excluded: that is not declining the
  // c-bet, it is a different and, per strategy-notes §3, underused line.
  if (d.pfa && d.street === 'flop' && d.kind === 'check' && !checkRaised) out.push('pfa-check-flop');

  // §2 stage 2: for a draw a fold is *great* — 35% equity became 100% — so the
  // table says bet often. It does not say always, and PLAN §3 names checking a
  // nut flush draw on a monotone flop as standard, which is exactly why this
  // is a label and not a flag.
  if (d.kind === 'check' && hand === 'draw') out.push('check-draw');

  // §6: the gate for a size above the pot is nut advantage, and 150% with a
  // hand that still beats most of what calls is the recommended line, the
  // workhorse against amateurs. The same section says most players' overbets
  // are pure value and instantly readable. One fact, two readings, and which
  // one applies needs the hand and the board — so both live in one label.
  //
  // Named `overbet-strong`, not §3's illustrative `overbet-with-nuts`, because
  // read.ts's `strong` admits an overpair and top pair with a Q kicker. Those
  // are not the nuts, and a label may not assert what nothing computed.
  if (d.sizing !== null && d.sizing > OVERBET && hand === 'strong') out.push('overbet-strong');

  // §5: on the river there are no cards to come, so every bet is a pure bluff
  // and the selection filters are, in order, no showdown value and blockers.
  // `air` on a five-card board is filter one, literally: read.ts has already
  // ruled out a pair and a playable board. The split is filter two.
  //
  // Which way a blocker points is deliberately not decided here. §4's worked
  // example is the reason: on Q♥-7♥-3♦-8♠-2♣ the hand holding *nothing* is the
  // good bluff and A♥K♥ is the bad one, because it blocks the folds. Reverse
  // the board and it reverses with it. That direction needs a villain range,
  // which §3 forbids, so the label reports the removal and stops.
  if (d.street === 'river' && d.kind === 'bet' && hand === 'air') {
    out.push(rem.length ? 'river-bluff-with-blocker' : 'river-bluff-no-blocker');
  }

  // §4: blockers concentrate on rivers, where ranges are narrow and the
  // call/fold boundary is sharp — and a marginal made hand facing a river bet
  // is that boundary. It is also the single decision this repo is named after.
  // Hero's own removals come attached, which is the whole input to the call.
  if (d.street === 'river' && d.kind === 'call' && d.facedBet && hand === 'marginal-made') {
    out.push('river-call-marginal');
  }

  return out;
}

/** Every labelled postflop decision in one hand, in the order Hero made them. */
export function labelledDecisions(h: HeroHand): LabelledDecision[] {
  const cards = h.cards;
  if (!cards) return [];

  const texture = boardType(h.board);
  const checkRaised = new Set(h.streets.filter((s) => s.checkRaised).map((s) => s.street));

  return decisionsOf(h).flatMap((d) => {
    if (d.street === 'preflop') return [];
    const board = h.board.slice(0, BOARD_SEEN[d.street]);
    const hand = handClass(cards, board);
    const rem = removals(cards, board);
    const labels = labelsFor(d, hand, rem, checkRaised.has(d.street));
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

const FACETS = ['position', 'depth', 'handClass', 'boardType'] as const;

/**
 * The facets every instance agrees on — the finding itself.
 *
 * "Three offsuit-ace folds, all cutoff, all 45–55bb" is a rule the player is
 * carrying. Two scattered instances agree on nothing, `shared` comes back
 * empty, and that reads as "no pattern here" without a denominator, a minimum
 * sample or an interval anywhere in it. It is sayable at n = 2, which is the
 * point: waiting for significance means waiting thousands of hands to say what
 * the third instance already said.
 *
 * At n = 1 it is not sayable at all, which is why one instance shares nothing:
 * a lone decision trivially "agrees" with itself on all four facets, and a full
 * `shared` block would hand the agent a rule built from one hand. The facets
 * are still on the decision; they are just not a pattern yet.
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
