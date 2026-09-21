/**
 * Each row below pins a decision that was argued somewhere — in PLAN-coach.md
 * §3, in strategy-notes §4, or in the comments of read.ts. Rows that only
 * demonstrate that the code runs are left out on purpose; the suite is already
 * long enough that an extra green test costs more than it pays.
 */

import { describe, expect, it } from 'vitest';

import { handClass, removals, type HandClass } from './read.ts';
import type { Card } from './odds.ts';

describe('handClass()', () => {
  const cases: [string, Card[], Card[], HandClass][] = [
    // The precedence call: a made hand that also draws is named by the made
    // half. Trip nines with four spades is strong, not draw.
    ['set with a flush draw', ['9s', '9h'], ['9d', 'As', '2s'], 'strong'],
    ['overpair', ['Qh', 'Qd'], ['Jc', '7s', '2d'], 'strong'],
    ['top pair, Q kicker', ['Ah', 'Qs'], ['Ad', '8c', '3h'], 'strong'],
    ['two pair using a hole card', ['Ks', '7h'], ['Kd', '7c', '2d'], 'strong'],
    // The kicker is the only difference from the row above it.
    ['top pair, weak kicker', ['Ah', '5s'], ['Ad', '8c', '3h'], 'marginal-made'],
    ['underpair', ['8h', '8d'], ['Ac', 'Kd', '2s'], 'marginal-made'],
    // Two pair on the board, nothing of Hero's in it: showdown value that
    // owes nothing to his cards.
    ['playing the board', ['7h', '2c'], ['Ad', 'Ah', 'Ks', 'Kd', '9c'], 'marginal-made'],
    ['flush draw, nine outs', ['7s', '5s'], ['Ks', '4s', '9d'], 'draw'],
    // classify() calls this one a draw. §3 does not: four outs is not eight.
    ['bare gutshot', ['8c', '7d'], ['Jh', '5s', '4c'], 'air'],
    ['two overcards, six outs', ['Ah', 'Kd'], ['9c', '5s', '2d'], 'air'],
    // Eight outs on the flop, none of them left to come.
    ['open-ender on the river', ['9c', '8d'], ['Jh', 'Ts', '4c', '2h', '3d'], 'air'],
  ];

  for (const [name, hole, board, want] of cases) {
    it(`${name} → ${want}`, () => {
      expect(handClass(hole, board)).toBe(want);
    });
  }
});

describe('removals()', () => {
  const say = (hole: Card[], board: Card[]) =>
    removals(hole, board).map((r) => `${r.card} removes ${r.removes}`);

  /**
   * strategy-notes §4, with one heart added to the board so that a flush is
   * possible on it. Same strength, opposite meaning — which is the whole
   * reason removals are computed at all.
   */
  it('separates AK of the board suit from AK of a brick suit', () => {
    const board: Card[] = ['Qh', '7h', '3d', '8s', '2h'];
    expect(say(['Ah', 'Kh'], board)).toEqual([
      'Ah removes flushes in hearts, the nut flush included',
      'Kh removes flushes in hearts',
    ]);
    expect(say(['Ad', 'Kd'], board)).toEqual([]);
  });

  /**
   * §4's board as written holds two hearts, so no flush can be made on it and
   * the board-derived rules have nothing to say about either hand. The
   * asymmetry there comes from villain's busted heart draws, and reading those
   * is the range modelling §3 forbids. This test exists to pin the silence.
   */
  it('says nothing about a flush that the board cannot make', () => {
    const board: Card[] = ['Qh', '7h', '3d', '8s', '2c'];
    expect(say(['Ah', 'Kh'], board)).toEqual([]);
    expect(say(['Ad', 'Kd'], board)).toEqual([]);
  });

  /** Overlapping windows name the 6 three times over; the card speaks once. */
  it('reports a straight card once however many windows want it', () => {
    expect(say(['Js', '6c'], ['9h', '8d', '7c'])).toEqual([
      '6c removes straights that need the 6',
      'Js removes straights that need the J',
    ]);
  });

  /** The boat and the top pair are separate facts about the same board. */
  it('reads the paired rank and the highest card apart', () => {
    expect(say(['Qs', '7s'], ['Qc', '7h', '7d'])).toEqual([
      '7s removes full houses with 7s',
      'Qs removes top pair of Qs',
    ]);
  });

  /** On QQ4 a queen is trips, so there is no top pair left to remove. */
  it('drops the top-pair rule when the top card is the paired one', () => {
    expect(say(['Qs', 'Jd'], ['Qc', 'Qh', '4d'])).toEqual([
      'Qs removes full houses with Qs',
    ]);
  });
});
