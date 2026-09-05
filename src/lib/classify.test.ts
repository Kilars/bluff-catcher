/**
 * Tests for classify() — the draw taxonomy classifier.
 *
 * Ground-truth cases are verified against analyse() to ensure the composite hits
 * predicate yields the correct union-deduplicated out count.
 *
 * Note on divergence from the spec table:
 *   Kc 9d / Jh Td 7s: the spec table lists outs=8 but the correctly-built composite hits
 *   (doubleGutshot + overcard K) yields 11 outs. K > J (max board), so K IS an overcard
 *   per DECISIONS rules ("EACH hole card strictly greater than the max board rank").
 *   We trust analyse() and the DECISIONS rules; the test asserts 11 outs.
 */

import { describe, it, expect, vi } from 'vitest';
import { classify } from './classify';
import { analyse, type Card } from './odds';

// Helper: run analyse with classify's composite hits and verify outs.
function analyseWith(hero: Card[], board: Card[]) {
  const read = classify(hero, board);
  if (!read) return null;

  if (read.backdoor) {
    // Backdoor uses mode:'backdoor' in analyse — 0 one-card outs by design.
    return analyse({ hero, board, mode: 'backdoor' });
  }

  return analyse({ hero, board, hits: read.hits });
}

describe('classify()', () => {
  // ─── Ground-truth table (from spec + DECISIONS) ──────────────────────────

  describe('ground-truth cases', () => {
    it('As 7s / Ks 4s 9d → flushDraw, 12 outs', () => {
      const hero: Card[] = ['As', '7s'];
      const board: Card[] = ['Ks', '4s', '9d'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('flushDraw');
      expect(read!.components).toContain('flush');
      expect(read!.components).toContain('overcard');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(12);
    });

    it('7s 5s / Ks 4s 9d → flushDraw, 9 outs (no overcard)', () => {
      const hero: Card[] = ['7s', '5s'];
      const board: Card[] = ['Ks', '4s', '9d'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('flushDraw');
      expect(read!.components).toContain('flush');
      expect(read!.components).not.toContain('overcard');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(9);
    });

    it('Ah Kc / 9d 7s 2h → overcards, 6 outs', () => {
      const hero: Card[] = ['Ah', 'Kc'];
      const board: Card[] = ['9d', '7s', '2h'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('overcards');
      expect(read!.components).toContain('overcard');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(6);
    });

    it('Qc Js / Th 8d 2c → gutshot, 10 outs (overcards stack)', () => {
      const hero: Card[] = ['Qc', 'Js'];
      const board: Card[] = ['Th', '8d', '2c'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('gutshot');
      expect(read!.components).toContain('gutshot');
      expect(read!.components).toContain('overcard');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(10);
    });

    it('6c 5s / 9h 8d 2c → gutshot, 4 outs (no overcard)', () => {
      const hero: Card[] = ['6c', '5s'];
      const board: Card[] = ['9h', '8d', '2c'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('gutshot');
      expect(read!.components).not.toContain('overcard');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(4);
    });

    it('9h 8c / 7d 6s Kc → openEnder, 8 outs', () => {
      const hero: Card[] = ['9h', '8c'];
      const board: Card[] = ['7d', '6s', 'Kc'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('openEnder');
      expect(read!.components).toContain('openEnder');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(8);
    });

    it('Jd Td / 9d 8c 2d → combo, 21 outs (flush + open-ender + overcards)', () => {
      const hero: Card[] = ['Jd', 'Td'];
      const board: Card[] = ['9d', '8c', '2d'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('combo');
      expect(read!.components).toContain('flush');
      expect(read!.components).toContain('openEnder');
      expect(read!.components).toContain('overcard');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(21);
    });

    it('Ah 9c / 9d 5s 2h → pairImproving, 5 outs', () => {
      const hero: Card[] = ['Ah', '9c'];
      const board: Card[] = ['9d', '5s', '2h'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('pairImproving');
      expect(read!.components).toContain('pairImprove');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(5);
    });

    it('Kc 9d / Jh Td 7s → doubleGutshot, 11 outs (K is overcard, diverges from spec table)', () => {
      // The spec table lists 8, but K > J (max board) → K is an overcard per DECISIONS rules.
      // Correct composite outs = 8 (straight) + 3 (K overcards) = 11.
      const hero: Card[] = ['Kc', '9d'];
      const board: Card[] = ['Jh', 'Td', '7s'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('doubleGutshot');
      expect(read!.components).toContain('doubleGutshot');
      expect(read!.components).toContain('overcard'); // K is an overcard
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(11); // 8 straight + 3 K overcards
    });

    it('8h 6d / Ah Kh 2c → backdoor, 0 one-card outs', () => {
      const hero: Card[] = ['8h', '6d'];
      const board: Card[] = ['Ah', 'Kh', '2c'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('backdoor');
      expect(read!.backdoor).toBe(true);
      // Backdoor: 0 one-card outs (the ~4% math uses a two-card formula)
      const result = analyse({ hero, board, mode: 'backdoor' });
      expect(result.outs).toBe(0);
    });
  });

  // ─── Reject cases ────────────────────────────────────────────────────────

  describe('made hand → null', () => {
    it('9h 8c / 7d 6s 5c — made straight → null', () => {
      expect(classify(['9h', '8c'], ['7d', '6s', '5c'])).toBeNull();
    });

    it('As 7s / Ks 4s 9s Qs — made flush (5 spades) → null', () => {
      // As 7s hero + Ks 4s 9s board = 4 spades; add Qs on turn = 5 spades = flush
      expect(classify(['As', '7s'] as Card[], ['Ks', '4s', '9s', 'Qs'] as Card[])).toBeNull();
    });

    it('Ah 9c / 9d 9s 2h — trips already → null', () => {
      expect(classify(['Ah', '9c'] as Card[], ['9d', '9s', '2h'] as Card[])).toBeNull();
    });

    it('Ah Ac / 9d 9s 2h — two pair (AA + 99) → null', () => {
      expect(classify(['Ah', 'Ac'] as Card[], ['9d', '9s', '2h'] as Card[])).toBeNull();
    });
  });

  describe('air → null', () => {
    it('7c 4d / Kh 9s 2d — no draw component at all → null', () => {
      // 7 < K, 4 < K — no overcard. No flush draw (mixed suits). No straight draw.
      expect(classify(['7c', '4d'] as Card[], ['Kh', '9s', '2d'] as Card[])).toBeNull();
    });

    it('Tc 3d / Kh 9s 2d — T is below K, no draw → null', () => {
      // T(8) < K(11), 3 < K. No flush draw. No straight draw.
      expect(classify(['Tc', '3d'] as Card[], ['Kh', '9s', '2d'] as Card[])).toBeNull();
    });
  });

  // ─── DECISIONS special cases ─────────────────────────────────────────────

  describe('J9 on QT7 → openEnder (not doubleGutshot)', () => {
    it('Jh 9c / Qd Ts 7s → openEnder (four consecutive Q-J-T-9, both ends live)', () => {
      const hero: Card[] = ['Jh', '9c'];
      const board: Card[] = ['Qd', 'Ts', '7s'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('openEnder');
    });
  });

  describe('genuine doubleGutshot', () => {
    it('Kc 9d / Jh Td 7s → doubleGutshot (two inside gaps: Q and 8)', () => {
      const read = classify(['Kc', '9d'] as Card[], ['Jh', 'Td', '7s'] as Card[]);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('doubleGutshot');
    });
  });

  describe('board-only straight draw excluded', () => {
    it('Ah Kd / 5d 6s 7h 8c — board draws to straight, hero has no part → no straight component', () => {
      // 5-6-7-8 on board needs 4 or 9, but the straight wouldn't use A or K.
      // A and K are overcards (both > 8 max board). Should classify as overcards.
      const read = classify(['Ah', 'Kd'] as Card[], ['5d', '6s', '7h', '8c'] as Card[]);
      expect(read).not.toBeNull();
      expect(read!.components).not.toContain('openEnder');
      expect(read!.components).not.toContain('gutshot');
      expect(read!.components).not.toContain('doubleGutshot');
      expect(read!.primaryCategory).toBe('overcards');
    });
  });

  describe('bottom/middle pair kicker — not an out (trap #1)', () => {
    it('classify never uses a generic pairs predicate (test for 12 vs 15 outs)', () => {
      // A♠ 7♠ on K♠ 4♠ 9♦ — the 7 is not an overcard (7 < K).
      // With a WRONG generic pairsUp(hero, cs, 2), the 7 would add 3 outs → 15.
      // With the correct rank-named predicate (only A is overcard), we get 12.
      const hero: Card[] = ['As', '7s'];
      const board: Card[] = ['Ks', '4s', '9d'];
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(12); // NOT 15
    });
  });

  // ─── zero-outs guard — classify must never produce 0 outs on non-backdoor ─

  describe('zero-outs guard', () => {
    it('classify never hands analyse a non-backdoor spot with 0 outs', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Run a sample of known keepers and verify no zero-outs error fires.
      const keepers: [Card[], Card[]][] = [
        [['As', '7s'], ['Ks', '4s', '9d']],     // flushDraw + overcard
        [['Ah', 'Kc'], ['9d', '7s', '2h']],      // overcards
        [['Qc', 'Js'], ['Th', '8d', '2c']],      // gutshot + overcards
        [['9h', '8c'], ['7d', '6s', 'Kc']],      // openEnder
        [['Jd', 'Td'], ['9d', '8c', '2d']],      // combo
        [['Ah', '9c'], ['9d', '5s', '2h']],      // pairImproving
        [['Kc', '9d'], ['Jh', 'Td', '7s']],      // doubleGutshot + overcard
      ];

      for (const [hero, board] of keepers) {
        const read = classify(hero, board);
        expect(read).not.toBeNull();
        if (!read!.backdoor) {
          analyse({ hero, board, hits: read!.hits });
        }
      }

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // ─── Naming sanity checks ────────────────────────────────────────────────

  describe('name composition', () => {
    it('flush-only has name "A flush draw"', () => {
      const read = classify(['7s', '5s'] as Card[], ['Ks', '4s', '9d'] as Card[]);
      expect(read!.name).toBe('A flush draw');
    });

    it('flush + overcard has name "A flush draw with an overcard"', () => {
      const read = classify(['As', '7s'] as Card[], ['Ks', '4s', '9d'] as Card[]);
      expect(read!.name).toBe('A flush draw with an overcard');
    });

    it('overcards hand has name "Two overcards"', () => {
      const read = classify(['Ah', 'Kc'] as Card[], ['9d', '7s', '2h'] as Card[]);
      expect(read!.name).toBe('Two overcards');
    });

    it('pairImproving has name "A pair looking to improve"', () => {
      const read = classify(['Ah', '9c'] as Card[], ['9d', '5s', '2h'] as Card[]);
      expect(read!.name).toBe('A pair looking to improve');
    });

    it('backdoor has name "A backdoor flush draw"', () => {
      const read = classify(['8h', '6d'] as Card[], ['Ah', 'Kh', '2c'] as Card[]);
      expect(read!.name).toBe('A backdoor flush draw');
    });

    it('combo (flush + openEnder) has name "A flush draw and an open-ended straight draw"', () => {
      const read = classify(['Jd', 'Td'] as Card[], ['9d', '8c', '2d'] as Card[]);
      expect(read!.name).toContain('flush draw');
      expect(read!.name).toContain('open-ended');
    });
  });

  // ─── Set draw (pocket pair) cases ────────────────────────────────────────

  describe('set draw — pocket pair', () => {
    it('55 on 6-7-8: openEnder primary, set component present, 10 outs (8 straight + 2 set)', () => {
      const hero: Card[] = ['5s', '5d'];
      const board: Card[] = ['6h', '7c', '8d'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('openEnder');
      expect(read!.components).toContain('openEnder');
      expect(read!.components).toContain('set');
      expect(read!.meta.pocketRank).toBe('5');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(10); // 8 straight + 2 set (no overlap)
    });

    it('55 on K-Q-8: setDraw primary, components [set], 2 outs, ~8% over two streets', () => {
      const hero: Card[] = ['5s', '5d'];
      const board: Card[] = ['Kh', 'Qc', '8d'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('setDraw');
      expect(read!.components).toEqual(['set']);
      expect(read!.meta.pocketRank).toBe('5');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(2);
      // ~8% over two streets: 1 - (45/47)*(44/46) ≈ 8.4%
      expect(result.total).toBeGreaterThan(7);
      expect(result.total).toBeLessThan(10);
    });

    it('AA on low board (7-2-3): NO set component (AA guard), overcards primary, 2 outs — no double-count', () => {
      const hero: Card[] = ['As', 'Ad'];
      const board: Card[] = ['7h', '2c', '3d'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('overcards');
      expect(read!.components).not.toContain('set'); // AA guard: overcard predicate covers the 2 aces
      expect(read!.components).toContain('overcard');
      expect(read!.meta.pocketRank).toBe('A');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(2); // exactly 2 aces — no double-count
    });
  });

  // ─── Turn vs flop — classifier is street-agnostic ────────────────────────

  describe('turn board', () => {
    it('As 7s / Ks 4s 9d 2c → flushDraw on turn, 12 outs', () => {
      const hero: Card[] = ['As', '7s'];
      const board: Card[] = ['Ks', '4s', '9d', '2c'];
      const read = classify(hero, board);
      expect(read).not.toBeNull();
      expect(read!.primaryCategory).toBe('flushDraw');
      const result = analyseWith(hero, board)!;
      expect(result.outs).toBe(12);
      expect(result.streets).toBe(1);
    });
  });
});
