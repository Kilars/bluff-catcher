/**
 * Test the odds engine against the ten verified fixtures.
 * Asserts:
 * 1. Every fixture returns the expected outs and total percentage (±0.05).
 * 2. Backdoor path returns outs: 0 and total ≈ 4.2.
 * 3. Zero-outs guard on mis-specified non-backdoor spots.
 * 4. quick equals outs × 4 on flop fixtures and outs × 2 on turn fixture.
 */

import { describe, it, expect, vi } from 'vitest';
import { analyse, hasFlush, hasStraight, pairsUp, type Card } from './odds';
import { fixtures } from './fixtures';

describe('odds engine', () => {
  describe('every fixture', () => {
    fixtures.forEach((fixture) => {
      it(`${fixture.id}: outs and total match expected`, () => {
        const result = analyse(fixture.spot);
        expect(result.outs).toBe(fixture.expected.outs);
        expect(Math.abs(result.total - fixture.expected.total)).toBeLessThanOrEqual(0.05);
      });

      it(`${fixture.id}: quick is outs × multiplier`, () => {
        const result = analyse(fixture.spot);
        const multiplier = result.streets === 2 ? 4 : 2;
        if (fixture.category === 'backdoor') {
          expect(result.quick).toBeNull();
        } else {
          expect(result.quick).toBe(result.outs * multiplier);
        }
      });
    });
  });

  describe('backdoor path', () => {
    it('backdoor fixture returns outs: 0', () => {
      const backdoor = fixtures.find((f) => f.id === 'backdoor')!;
      const result = analyse(backdoor.spot);
      expect(result.outs).toBe(0);
    });

    it('backdoor fixture returns total ≈ 4.2', () => {
      const backdoor = fixtures.find((f) => f.id === 'backdoor')!;
      const result = analyse(backdoor.spot);
      expect(Math.abs(result.total - 4.2)).toBeLessThanOrEqual(0.05);
    });

    it('backdoor fixture returns quick: null', () => {
      const backdoor = fixtures.find((f) => f.id === 'backdoor')!;
      const result = analyse(backdoor.spot);
      expect(result.quick).toBeNull();
    });

    it('backdoor fixture includes suitLeft', () => {
      const backdoor = fixtures.find((f) => f.id === 'backdoor')!;
      const result = analyse(backdoor.spot);
      expect(result.suitLeft).toBeDefined();
    });
  });

  describe('zero-outs guard', () => {
    it('logs console.error on mis-specified non-backdoor spot with 0 outs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Q♣ 9♣ on J♦ 7♠ 2♥ is a double gutshot needing two cards (no one-card outs)
      const misspecifiedSpot = {
        hero: ['Qc' as Card, '9c' as Card],
        board: ['Jd' as Card, '7s' as Card, '2h' as Card],
        hits: () => false, // no hits
      };

      const result = analyse(misspecifiedSpot);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Spot has no single-card outs — mis-specified hand:',
        ['Qc', '9c'],
        ['Jd', '7s', '2h']
      );
      expect(result.outs).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('does NOT log error on backdoor spot with 0 outs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const backdoor = fixtures.find((f) => f.id === 'backdoor')!;
      analyse(backdoor.spot);

      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('flop vs turn multiplier', () => {
    it('flop fixture (3 board cards) uses ×4 multiplier', () => {
      const flushDraw = fixtures.find((f) => f.id === 'flushDraw')!;
      const result = analyse(flushDraw.spot);
      expect(result.streets).toBe(2);
      expect(result.quick).toBe(result.outs * 4);
    });

    it('turn fixture (4 board cards) uses ×2 multiplier', () => {
      const flushDrawTurn = fixtures.find((f) => f.id === 'flushDrawTurn')!;
      const result = analyse(flushDrawTurn.spot);
      expect(result.streets).toBe(1);
      expect(result.quick).toBe(result.outs * 2);
    });
  });

  describe('mathematical formulas', () => {
    it('flop: total uses "at least one out" formula', () => {
      const flushDraw = fixtures.find((f) => f.id === 'flushDraw')!;
      const result = analyse(flushDraw.spot);
      const known = flushDraw.hero.concat(flushDraw.board);
      const n = 52 - known.length;
      const o = result.outs;
      // (1 - ((n - o) * (n - o - 1)) / (n * (n - 1))) * 100
      const expected =
        (1 - ((n - o) * (n - o - 1)) / (n * (n - 1))) * 100;
      const rounded = Math.round(expected * 10) / 10;
      expect(result.total).toBe(rounded);
    });

    it('turn: total uses simple ratio formula', () => {
      const flushDrawTurn = fixtures.find((f) => f.id === 'flushDrawTurn')!;
      const result = analyse(flushDrawTurn.spot);
      const known = flushDrawTurn.hero.concat(flushDrawTurn.board);
      const n = 52 - known.length;
      const o = result.outs;
      // (o / n) * 100
      const expected = (o / n) * 100;
      const rounded = Math.round(expected * 10) / 10;
      expect(result.total).toBe(rounded);
    });
  });

  describe('helpers', () => {
    it('hasFlush detects a flush', () => {
      // 5 spades = flush
      expect(
        hasFlush(['As' as Card, '7s' as Card, 'Ks' as Card, '4s' as Card, '9s' as Card])
      ).toBe(true);
      // 4 spades = no flush
      expect(hasFlush(['As' as Card, '7s' as Card, 'Ks' as Card, '4s' as Card])).toBe(false);
    });

    it('hasStraight detects a straight', () => {
      // 9-8-7-6-K = no straight
      expect(
        hasStraight(['9h' as Card, '8c' as Card, '7d' as Card, '6s' as Card, 'Kc' as Card])
      ).toBe(false);
      // 9-8-7-6-5 = straight
      expect(
        hasStraight(['9h' as Card, '8c' as Card, '7d' as Card, '6s' as Card, '5c' as Card])
      ).toBe(true);
    });

    it('hasStraight handles ace-low straight', () => {
      // A-5-4-3-2 = straight (ace low)
      expect(
        hasStraight(['5c' as Card, '4d' as Card, '3h' as Card, '2s' as Card, 'As' as Card])
      ).toBe(true);
    });

    it('pairsUp detects pair improving', () => {
      const hero: Card[] = ['Ah' as Card, '9c' as Card];
      // Cards: A♥ 9♣ 9♦ 5♠ 2♥ (7 cards total when 2 more come)
      const allCards: Card[] = ['Ah' as Card, '9c' as Card, '9d' as Card, '5s' as Card, '2h' as Card];
      expect(pairsUp(hero, allCards, 2)).toBe(true); // 9 appears twice (9c and 9d)
      expect(pairsUp(hero, allCards, 3)).toBe(false); // 9 only appears twice, not thrice
    });
  });
});
