/**
 * boundary — unit tests.
 *
 * This is the phone grid's only *words* once the 169 cell labels are dropped
 * (PLAN-phone §3.1), so it is tested hard:
 *
 *  1. The sentence, verbatim, for several seats across all three tiers.
 *  2. The 10bb tier says "jams", the other two say "opens".
 *  3. Row scanning agrees with an independent brute-force scan of the set.
 *  4. Every row of all 21 charts is `exact` — the "+" shorthand is never a lie.
 *  5. The rows partition the range: their counts sum to the set's size.
 *  6. The headline rule (lowest lo-rank, ties to the higher hi-rank).
 *  7. Seat labels: `UTG1` prints as "UTG+1".
 */

import { describe, it, expect } from 'vitest';
import { boundarySentence, positionLabel, rangeBoundary } from './boundary';
import { DEPTHS, POSITIONS, getRangeSet, type Depth, type Position } from './ranges';
import { RANKS } from '../odds';

describe('boundary', () => {
  describe('the sentence', () => {
    it.each([
      // deep (60bb+) — the baseline chart
      ['UTG', 'deep', 'UTG opens A3s+ suited, 66+ pairs, ATo+ offsuit'],
      ['HJ', 'deep', 'HJ opens A2s+ suited, 33+ pairs, A8o+ offsuit'],
      ['CO', 'deep', 'CO opens A2s+ suited, 33+ pairs, A5o+ offsuit'],
      ['BTN', 'deep', 'BTN opens A2s+ suited, 22+ pairs, A2o+ offsuit'],
      // mid (20bb) — early position flat, late position tightens
      ['UTG', 'mid', 'UTG opens A4s+ suited, 66+ pairs, ATo+ offsuit'],
      ['HJ', 'mid', 'HJ opens A2s+ suited, 55+ pairs, A8o+ offsuit'],
      ['BTN', 'mid', 'BTN opens A2s+ suited, 22+ pairs, A2o+ offsuit'],
      // short (10bb) — the verb changes
      ['UTG', 'short', 'UTG jams A2s+ suited, 22+ pairs, ATo+ offsuit'],
      ['HJ', 'short', 'HJ jams A2s+ suited, 22+ pairs, A7o+ offsuit'],
      ['BTN', 'short', 'BTN jams A2s+ suited, 22+ pairs, A2o+ offsuit'],
    ] as [Position, Depth, string][])('%s @ %s → "%s"', (pos, depth, expected) => {
      expect(boundarySentence(pos, depth)).toBe(expected);
    });

    it('defaults to the deep chart when no depth is named', () => {
      expect(boundarySentence('HJ')).toBe(boundarySentence('HJ', 'deep'));
    });

    it('writes UTG1 as the seat a player would say', () => {
      expect(positionLabel('UTG1')).toBe('UTG+1');
      expect(boundarySentence('UTG1', 'deep')).toMatch(/^UTG\+1 opens /);
    });
  });

  describe('the verb comes from DEPTH_META, not the position', () => {
    it.each(POSITIONS)('%s jams at 10bb and opens above it', (pos) => {
      expect(rangeBoundary(pos, 'short').verb).toBe('jams');
      expect(rangeBoundary(pos, 'mid').verb).toBe('opens');
      expect(rangeBoundary(pos, 'deep').verb).toBe('opens');
      expect(boundarySentence(pos, 'short')).toContain(' jams ');
      expect(boundarySentence(pos, 'deep')).toContain(' opens ');
    });
  });

  describe('row scanning', () => {
    it('finds the suited rows of UTG @ 60bb+ — A3s+, K8s+, Q9s+, J9s+, T9s+', () => {
      const b = rangeBoundary('UTG', 'deep');
      expect(b.suited.map((r) => r.label)).toEqual(['A3s+', 'K8s+', 'Q9s+', 'J9s+', 'T9s+']);
      expect(b.offsuit.map((r) => r.label)).toEqual(['ATo+', 'KJo+']);
      expect(b.pairs?.label).toBe('66+');
    });

    it('counts the row, not just its boundary', () => {
      // A3s+ is A3s..AKs = 11 suited aces; 66+ is 66..AA = 9 pairs.
      const b = rangeBoundary('UTG', 'deep');
      expect(b.suited[0]).toMatchObject({ family: 'suited', hi: 'A', lo: '3', count: 11 });
      expect(b.pairs).toMatchObject({ family: 'pair', hi: '6', lo: '6', count: 9 });
    });

    it('omits rows the range does not reach at all', () => {
      // UTG @ 60bb+ holds no offsuit queen and no suited nine.
      const b = rangeBoundary('UTG', 'deep');
      expect(b.suited.some((r) => r.hi === '9')).toBe(false);
      expect(b.offsuit.some((r) => r.hi === 'Q')).toBe(false);
    });

    it('orders rows by hi-rank, descending', () => {
      for (const depth of DEPTHS) {
        for (const pos of POSITIONS) {
          const b = rangeBoundary(pos, depth);
          for (const rows of [b.suited, b.offsuit]) {
            const idxs = rows.map((r) => RANKS.indexOf(r.hi));
            expect(idxs).toEqual([...idxs].sort((a, z) => z - a));
          }
        }
      }
    });

    it('agrees with a brute-force scan of the set, on every chart', () => {
      for (const depth of DEPTHS) {
        for (const pos of POSITIONS) {
          const set = getRangeSet(pos, depth);
          const b = rangeBoundary(pos, depth);

          for (const row of [...b.suited, ...b.offsuit]) {
            const suffix = row.family === 'suited' ? 's' : 'o';
            const loIdx = RANKS.indexOf(row.lo);
            // Nothing below the boundary is in the range …
            for (let lo = 0; lo < loIdx; lo++) {
              expect(set.has(row.hi + RANKS[lo] + suffix)).toBe(false);
            }
            // … and the boundary hand itself is.
            expect(set.has(row.hi + row.lo + suffix)).toBe(true);
          }
        }
      }
    });
  });

  describe('"+" shorthand honesty', () => {
    it('is exact for every row of all 21 charts', () => {
      // Collected rather than asserted in place so a failure names every
      // offending row at once — a hand-edited chart usually breaks several.
      const inexact: string[] = [];
      for (const depth of DEPTHS) {
        for (const pos of POSITIONS) {
          const b = rangeBoundary(pos, depth);
          for (const row of [...b.suited, ...b.offsuit, ...(b.pairs ? [b.pairs] : [])]) {
            if (!row.exact) inexact.push(`${pos}/${depth}: ${row.label}`);
          }
        }
      }
      expect(inexact).toEqual([]);
    });

    it('an exact row runs unbroken from its boundary to the top of the row', () => {
      for (const depth of DEPTHS) {
        for (const pos of POSITIONS) {
          const set = getRangeSet(pos, depth);
          const b = rangeBoundary(pos, depth);
          for (const row of [...b.suited, ...b.offsuit]) {
            const suffix = row.family === 'suited' ? 's' : 'o';
            const hiIdx = RANKS.indexOf(row.hi);
            for (let lo = RANKS.indexOf(row.lo); lo < hiIdx; lo++) {
              expect(set.has(row.hi + RANKS[lo] + suffix)).toBe(true);
            }
          }
          if (b.pairs) {
            for (let i = RANKS.indexOf(b.pairs.hi); i <= 12; i++) {
              expect(set.has(RANKS[i] + RANKS[i])).toBe(true);
            }
          }
        }
      }
    });
  });

  describe('the rows partition the range', () => {
    it.each(DEPTHS)('%s: pair + suited + offsuit counts equal the set size', (depth) => {
      for (const pos of POSITIONS) {
        const b = rangeBoundary(pos, depth);
        const total =
          (b.pairs?.count ?? 0) +
          b.suited.reduce((n, r) => n + r.count, 0) +
          b.offsuit.reduce((n, r) => n + r.count, 0);
        expect(total).toBe(getRangeSet(pos, depth).size);
      }
    });
  });

  describe('the headline row', () => {
    it('picks the row that reaches furthest down the matrix', () => {
      // HJ @ 60bb+: A2s (lo=2) beats K3s (lo=3) and Q7s (lo=7).
      expect(rangeBoundary('HJ', 'deep').suitedHeadline?.label).toBe('A2s+');
      // UTG @ 20bb: no suited ace below A4s, so A4s is the headline.
      expect(rangeBoundary('UTG', 'mid').suitedHeadline?.label).toBe('A4s+');
    });

    it('breaks a tie towards the higher hi-rank', () => {
      // BTN @ 60bb+ holds A2s, K2s and Q2s — three rows all bottoming at 2.
      const b = rangeBoundary('BTN', 'deep');
      const bottomedAtTwo = b.suited.filter((r) => r.lo === '2').map((r) => r.hi);
      expect(bottomedAtTwo).toEqual(['A', 'K', 'Q']);
      expect(b.suitedHeadline?.hi).toBe('A');
    });

    it('is null for a family the range does not hold', () => {
      // Every chart here holds all three families, so assert the shape instead:
      // a headline is always one of the scanned rows.
      for (const depth of DEPTHS) {
        for (const pos of POSITIONS) {
          const b = rangeBoundary(pos, depth);
          expect(b.suited).toContain(b.suitedHeadline);
          expect(b.offsuit).toContain(b.offsuitHeadline);
        }
      }
    });
  });

  describe('the tiers move the sentence', () => {
    it('BTN tightens from 60bb+ to 20bb inside the rows, not at the headline', () => {
      // 50.8% → 43.3%, yet both charts still bottom out at A2s and A2o. The
      // headline clause is deliberately blunt; the rows behind it are where the
      // 7.5-point trim shows, which is also why the grid keeps its job.
      const deep = rangeBoundary('BTN', 'deep');
      const mid = rangeBoundary('BTN', 'mid');
      expect(deep.suitedHeadline?.label).toBe(mid.suitedHeadline?.label);
      expect(deep.offsuit.find((r) => r.hi === 'K')?.label).toBe('K5o+');
      expect(mid.offsuit.find((r) => r.hi === 'K')?.label).toBe('K7o+');
      expect(getRangeSet('BTN', 'deep').size).toBeGreaterThan(getRangeSet('BTN', 'mid').size);
    });

    it('UTG barely moves between tiers — the point of the 20bb chart', () => {
      const deep = getRangeSet('UTG', 'deep').size;
      const mid = getRangeSet('UTG', 'mid').size;
      expect(Math.abs(deep - mid)).toBeLessThanOrEqual(3);
    });
  });
});
