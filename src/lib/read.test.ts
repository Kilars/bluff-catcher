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

    // A board pair beside one pair of Hero's is still one pair: the board's
    // pair is everyone's. RC4857718435, RC4857719169 and the rest of the
    // archive's misreads, then the hands that must stay strong on paired boards.
    ['pocket pair under a board pair, turn', ['4h', '4s'], ['3c', '5d', '9s', '9d'], 'marginal-made'],
    ['pocket pair under a board pair, river', ['4h', '4s'], ['3c', '5d', '9s', '9d', 'Qd'], 'marginal-made'],
    ['pocket pair under a board pair, flop', ['5s', '5h'], ['8h', 'Qs', '8c'], 'marginal-made'],
    ['counterfeited pocket pair', ['4d', '4h'], ['6d', '9s', '7c', '6h', '7s'], 'marginal-made'],
    ['underpair beside a board pair, river', ['Jc', 'Jd'], ['3c', 'Ah', '2d', '7h', '7c'], 'marginal-made'],
    ['top pair, weak kicker, board pair', ['Kd', 'Jh'], ['Qc', '8c', '3h', '8h', 'Kc'], 'marginal-made'],
    ['bottom pair beside a board pair', ['9d', '3d'], ['8s', '8d', '3s'], 'marginal-made'],
    ['pocket pair under the top card of a paired board', ['Qs', 'Qh'], ['Kc', '9d', '9h'], 'marginal-made'],
    ['overpair on a paired board', ['Ks', 'Kh'], ['9c', '9d', '2s'], 'strong'],
    ['top pair, Q kicker, on a paired board', ['Ks', 'Qh'], ['Kd', '8c', '8s'], 'strong'],
    ['trips through a board pair', ['8s', '2h'], ['8d', '8c', 'Ks'], 'strong'],
    // Two pair counts only when both hole cards pair the board and no board
    // pair sits above the lower of them — otherwise it plays the board's pair.
    ['two pair, board pair below both', ['Ks', '7h'], ['Kd', '7c', '2d', '2s'], 'strong'],
    ['two pair counterfeited by a board pair', ['Ks', '7h'], ['Kd', '7c', '9d', '9s'], 'marginal-made'],
    ['two pair counterfeited by a higher board pair', ['5s', '4h'], ['5d', '4c', 'Qs', 'Qd', 'Kc'], 'marginal-made'],
    // A full house counts when a hole card is in the trips or in the pair.
    ['full house: pocket pair under board trips', ['4s', '4h'], ['9c', '9d', '9s'], 'strong'],
    ['full house: board trips and a hole pair', ['7h', '5h'], ['8c', '8s', '5d', '6c', '8d'], 'strong'],
    ['full house: pocket pair under board trips, river', ['2s', '2h'], ['9c', '9d', '9s', 'Kd', '4c'], 'strong'],
    ['board full house, pocket pair too small', ['2s', '2h'], ['Kc', 'Kd', 'Ks', 'Qd', 'Qc'], 'marginal-made'],
    ['board full house over a pocket pair', ['4s', '4h'], ['9c', '9d', '9s', 'Kd', 'Kc'], 'marginal-made'],
    ['kicker only on board quads', ['Ks', 'Js'], ['8h', '8d', '8c', '4c', '8s'], 'marginal-made'],
    ['pocket pair under board quads', ['3h', '3s'], ['5d', '7s', '7h', '7d', '7c'], 'marginal-made'],
    ['top pair beside board quads', ['Ks', '7d'], ['Kh', '2s', '2c', '2h', '2d'], 'marginal-made'],
    ['overpair on board quads', ['As', 'Ah'], ['2s', '2c', '2h', '2d', 'Kd'], 'marginal-made'],
    ['top pair, ace kicker, on board quads', ['Ah', 'Kh'], ['2s', '2c', '2h', '2d', 'Kd'], 'marginal-made'],
    ['full house beside board trips, turn', ['Ks', '7d'], ['Kh', '2s', '2c', '2h'], 'strong'],
    ['nothing on board quads, turn', ['Ks', '4d'], ['8h', '8d', '8c', '8s'], 'air'],
    ['quads with a hole card', ['7h', '2c'], ['7s', '7d', '7c', 'Kd'], 'strong'],
    // A hole card that only repeats the board's boat does not improve it.
    ['board boat, hole card of its pair rank', ['Qh', '2c'], ['Kc', 'Kd', 'Ks', 'Qd', 'Qc'], 'marginal-made'],
    ['board boat, hole card of its lower trips', ['9h', '2c'], ['9c', '9d', 'Ks', 'Kd', 'Kc'], 'marginal-made'],
    ['board boat, hole card that upgrades it', ['Ah', 'Ac'], ['Kc', 'Kd', 'Ks', 'Qd', 'Qc'], 'strong'],
    ['quads over a board boat', ['Kh', '2c'], ['Kc', 'Kd', 'Ks', 'Qd', 'Qc'], 'strong'],
    ['straight', ['9c', '8d'], ['Jh', 'Ts', '7c'], 'strong'],

    // A straight or flush on the board is everyone's: Hero's cards count only
    // when they improve the board's flush. Everything else plays the board.
    ['flush that beats the board flush', ['7s', '5s'], ['Ks', '4s', '9d', '2s', '3c'], 'strong'],
    ['low card of the board flush suit', ['2h', '3c'], ['Ah', 'Kh', 'Qh', '9h', '8h'], 'marginal-made'],
    ['pair under a board straight', ['Ad', 'Qs'], ['8h', '9h', 'Ts', 'Jc', 'Qc'], 'marginal-made'],
    ['overpair under a board straight', ['As', 'Ah'], ['5c', '6d', '7h', '8s', '9c'], 'marginal-made'],
    ['set under a board wheel', ['3s', '3d'], ['Ac', '3h', '4d', '2s', '5c'], 'marginal-made'],
    ['straight under a board flush', ['Ts', '7h'], ['5d', 'Qd', '6d', '3d', '4d'], 'marginal-made'],
    // The deliberate under-call the handClass docstring explains.
    ['higher straight over a board straight', ['Th', '2c'], ['5c', '6d', '7h', '8s', '9c'], 'marginal-made'],
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

  /**
   * At the ends of the rank line there is one window, so a straight one card
   * short shows up nowhere else: the A on 2-3-4-5 and on T-J-Q-K.
   */
  it('names the one card a four-to-a-straight board needs', () => {
    expect(say(['As', '7c'], ['2d', '3h', '4s', '5c', '9d'])).toContain(
      'As removes straights that need the A',
    );
    expect(say(['As', '7c'], ['Td', 'Jh', 'Qs', 'Kc', '3d'])).toContain(
      'As removes straights that need the A',
    );
  });

  /** Below a straight the board already shows, the card makes nothing that beats it. */
  it('names no straight card under the board straight', () => {
    expect(say(['4c', '2d'], ['5d', '6h', '7s', '8c', '9d'])).toEqual([]);
    expect(say(['Tc', '2d'], ['5d', '6h', '7s', '8c', '9d'])).toContain(
      'Tc removes straights that need the T',
    );
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
