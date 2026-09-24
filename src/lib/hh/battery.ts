/**
 * PLAN-coach.md §4, layer 3: per-label verification batteries. Each is a handful
 * of *closed* questions a judge answers from the enriched named fields — the
 * argument itself stays free prose and is deliberately not templated here.
 *
 * These are data, not calls: model-neutral `Question`s (judge.ts) that any
 * backend can answer. Instructions name the field they read so a weak model
 * looks it up rather than recomputing it.
 */

import type { QuestionSet } from './judge.ts';
import { type Label } from './labels.ts';

const BATTERIES: Record<Label, QuestionSet> = {
  'pfa-check-flop': {
    textureFavoursPfa: {
      kind: 'noul',
      instructions: 'The flop favours the preflop raiser’s range (read boardFavoursPfa).',
    },
    cbetEdge: {
      kind: 'score',
      instructions: 'How much a c-bet beats checking in this spot.',
      levels: ['checking is fine', 'close', 'betting is clearly better'],
    },
  },
  'check-draw': {
    drawBetStandard: {
      kind: 'noul',
      instructions: 'The draw (handClass, board) is strong enough that betting is standard.',
    },
    checkGiveup: {
      kind: 'score',
      instructions: 'How much checking the draw gives up versus betting it.',
      levels: ['nothing', 'a little', 'a lot'],
    },
  },
  'donk-bet': {
    textureSupportsLead: {
      kind: 'noul',
      instructions: 'This board (boardType) is one where the caller can lead.',
    },
    leadQuality: {
      kind: 'score',
      instructions: 'How defensible leading is here versus checking to the raiser.',
      levels: ['a clear leak', 'marginal', 'a good lead'],
    },
  },
  'check-raise-flop': {
    equityWhenCalled: {
      kind: 'noul',
      instructions: 'The hand (handClass) has enough equity-when-called to check-raise.',
    },
    textureFit: {
      kind: 'score',
      instructions: 'How well the texture (boardType) supports a check-raise.',
      levels: ['poorly', 'neutral', 'well'],
    },
  },
  'overbet-strong': {
    nutAdvantage: {
      kind: 'noul',
      instructions: 'Hero’s range has the nut advantage the overbet needs (handClass, board).',
    },
    sizeFit: {
      kind: 'score',
      instructions: 'Whether the chosen size (sizing) fits the spot.',
      levels: ['too big for the spot', 'about right', 'could go bigger'],
    },
  },
  'river-bluff-with-blocker': {
    blockerHelps: {
      kind: 'noul',
      instructions: 'The blocker (removals) meaningfully removes value from calling hands.',
    },
    bluffQuality: {
      kind: 'score',
      instructions: 'How good a bluffing candidate this hand is.',
      levels: ['poor', 'ok', 'ideal'],
    },
  },
  'river-bluff-no-blocker': {
    bluffJustified: {
      kind: 'noul',
      instructions: 'Bluffing is justified here despite holding no board-relevant blocker.',
    },
    missingBlockerPenalty: {
      kind: 'score',
      instructions: 'How much holding no blocker hurts the bluff.',
      levels: ['not at all', 'somewhat', 'a lot'],
    },
  },
  'river-call-marginal': {
    priceToCall: {
      kind: 'noul',
      instructions: 'Hero is getting the price to call (compare requiredEquity).',
    },
    catcherQuality: {
      kind: 'score',
      instructions: 'How good a bluff-catcher this hand is against the line.',
      levels: ['a fold', 'close', 'a clear call'],
    },
  },
  'river-check-value': {
    thinValueAvailable: {
      kind: 'noul',
      instructions: 'A thin value bet was available against a pool that does not fold enough.',
    },
    valueForgone: {
      kind: 'score',
      instructions: 'How much value checking through gave up.',
      levels: ['none', 'some', 'a lot'],
    },
  },
};

/** The closed questions for a label. Every label in LABELS has a non-empty set. */
export function batteryFor(label: Label): QuestionSet {
  return BATTERIES[label];
}
