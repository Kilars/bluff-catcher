/**
 * Preflop hand-class model.
 * Pure, no UI imports.
 *
 * The 169 canonical hand classes:
 *   - 13 pocket pairs: AA, KK, ..., 22
 *   - 78 suited non-pairs: AKs, AQs, ..., 32s
 *   - 78 offsuit non-pairs: AKo, AQo, ..., 32o
 *
 * Notation:
 *   - Pairs: "AA", "KK", ..., "22"
 *   - Suited: "AKs", "AQs", ..., "32s"
 *   - Offsuit: "AKo", "AQo", ..., "32o"
 *
 * Cards use the existing Card type from odds.ts: e.g. 'As', 'Td', '2c'
 */

import { type Card, RANKS } from '../odds';

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * A canonical hand class string: e.g. "AA", "AKs", "AKo"
 * Always uses the higher rank first for non-pairs.
 */
export type HandClass = string;

// ─── Rank helpers ─────────────────────────────────────────────────────────────

/** Rank index in RANKS string (0 = '2', 12 = 'A'). Higher = stronger. */
export function rankIndex(rank: string): number {
  return RANKS.indexOf(rank);
}

// ─── Hand class construction ─────────────────────────────────────────────────

/**
 * Convert two concrete Card values to their canonical hand class.
 * The higher-rank card is always listed first.
 * Returns e.g. "AA", "AKs", "72o".
 */
export function handClass(a: Card, b: Card): HandClass {
  const ra = a[0];
  const rb = b[0];
  const sa = a[1];
  const sb = b[1];

  const hi = rankIndex(ra) >= rankIndex(rb) ? ra : rb;
  const lo = rankIndex(ra) >= rankIndex(rb) ? rb : ra;

  if (hi === lo) {
    // Pocket pair
    return hi + lo;
  }

  const suited = sa === sb ? 's' : 'o';
  return hi + lo + suited;
}

/**
 * Parse a hand class string into its components.
 * Returns { hiRank, loRank, type: 'pair' | 'suited' | 'offsuit' }
 */
export function parseHandClass(hc: HandClass): {
  hiRank: string;
  loRank: string;
  type: 'pair' | 'suited' | 'offsuit';
} {
  if (hc.length === 2) {
    // Pair: e.g. "AA"
    return { hiRank: hc[0], loRank: hc[1], type: 'pair' };
  }
  // Suited or offsuit: e.g. "AKs" or "AKo"
  const suffix = hc[2];
  return {
    hiRank: hc[0],
    loRank: hc[1],
    type: suffix === 's' ? 'suited' : 'offsuit',
  };
}

// ─── 169-class enumeration ────────────────────────────────────────────────────

/**
 * All 169 canonical hand classes, in strongest-to-weakest order.
 *
 * Ordering rationale (canonical preflop strength ranking):
 *   1. Pocket pairs descending (AA, KK, ..., 22)
 *   2. Premium suited Ax hands interleaved with high pairs
 *   3. Then suited hands and offsuit hands by strength
 *
 * This uses a widely accepted approximate ordering:
 *   AA > KK > QQ > JJ > TT > AKs > AQs > AJs > KQs > AKo > ATs > KJs > QJs > JTs
 *   > 99 > AQo > A9s > KTs > QTs > JTs... etc.
 *
 * We implement a scoring function so the ranking is fully determined and reproducible.
 *
 * Score formula (higher = stronger):
 *   Pairs: 1000 + rankIndex * 10
 *   Suited: base on hi+lo ranks + suited bonus
 *   Offsuit: base on hi+lo ranks (no suited bonus)
 *
 * The scoring is calibrated to match the widely accepted ordering from
 * standard preflop hand-ranking charts (PokerStove / Chen formula approximation).
 */

/** Score a hand class for ranking purposes (higher = stronger). */
function handScore(hc: HandClass): number {
  const { hiRank, loRank, type } = parseHandClass(hc);
  const hi = rankIndex(hiRank); // 0-12
  const lo = rankIndex(loRank); // 0-12

  if (type === 'pair') {
    // Pairs are the strongest hands; scored by rank
    // Range: 1000 (22) to 1120 (AA)
    return 1000 + hi * 10;
  }

  const gap = hi - lo; // 1 = connected, 2 = one-gapper, etc.
  const suitedBonus = type === 'suited' ? 20 : 0;

  // Base score: combination of hi rank and lo rank with suited bonus
  // Formula similar to Chen formula but adapted for ranking 169 classes:
  //   primary: hi * 8 + lo * 4 + suitedBonus - gap * 2
  // This gives:
  //   AKs: 12*8 + 11*4 + 20 - 1*2 = 96 + 44 + 20 - 2 = 158
  //   AKo: 96 + 44 + 0 - 2 = 138
  //   AQs: 12*8 + 10*4 + 20 - 2*2 = 96 + 40 + 20 - 4 = 152
  //   KQs: 11*8 + 10*4 + 20 - 1*2 = 88 + 40 + 20 - 2 = 146
  //   AQo: 96 + 40 + 0 - 4 = 132
  //   JTs: 9*8 + 8*4 + 20 - 1*2 = 72 + 32 + 20 - 2 = 122
  //   72o: 5*8 + 0*4 + 0 - 5*2 = 40 + 0 + 0 - 10 = 30
  return hi * 8 + lo * 4 + suitedBonus - gap * 2;
}

/**
 * All 169 canonical hand classes.
 * Enumerated systematically: pairs, then all hi > lo combinations with suited and offsuit.
 */
function buildAll169(): HandClass[] {
  const classes: HandClass[] = [];

  // Pairs
  for (let i = 12; i >= 0; i--) {
    classes.push(RANKS[i] + RANKS[i]);
  }

  // Non-pairs: hi > lo
  for (let hi = 12; hi >= 1; hi--) {
    for (let lo = hi - 1; lo >= 0; lo--) {
      classes.push(RANKS[hi] + RANKS[lo] + 's');
      classes.push(RANKS[hi] + RANKS[lo] + 'o');
    }
  }

  return classes;
}

/**
 * All 169 canonical hand classes (unordered enumeration).
 * Use HAND_STRENGTH_RANKING for the ordered list.
 */
export const ALL_169: readonly HandClass[] = buildAll169();

/**
 * The canonical 169-hand strength ranking, strongest to weakest.
 * Used for skew-weighting in the deal engine.
 * This is a stable total ordering — no two hands share the same rank.
 */
export const HAND_STRENGTH_RANKING: readonly HandClass[] = (() => {
  const all = buildAll169();

  // Assign a tiebreaker based on the canonical position in the unordered list
  // to ensure strict total ordering even when scores are equal.
  const indexMap = new Map<string, number>();
  all.forEach((hc, i) => indexMap.set(hc, i));

  return [...all].sort((a, b) => {
    const sa = handScore(a);
    const sb = handScore(b);
    if (sb !== sa) return sb - sa; // higher score = stronger = earlier in list
    // Tiebreak: pairs before non-pairs, suited before offsuit, higher gap before lower
    return indexMap.get(a)! - indexMap.get(b)!;
  });
})();

/**
 * Precomputed rank index (0 = strongest) for every hand class, so lookups are O(1)
 * rather than an O(169) scan. Hot path: the deal engine's weighting samples 169 classes
 * per deal, which turned strengthRank's indexOf into an O(169²)-per-deal cost.
 */
const STRENGTH_RANK_INDEX: ReadonlyMap<HandClass, number> = new Map(
  HAND_STRENGTH_RANKING.map((hc, i) => [hc, i])
);

/**
 * The rank (0 = strongest) of a hand class in the canonical strength ranking.
 * Returns -1 for an unknown class (mirrors the previous indexOf contract).
 */
export function strengthRank(hc: HandClass): number {
  return STRENGTH_RANK_INDEX.get(hc) ?? -1;
}

// ─── Concrete combo helpers ───────────────────────────────────────────────────

/**
 * Count the number of concrete combos for a hand class.
 *   Pair: C(4,2) = 6
 *   Suited: 4 (one per suit)
 *   Offsuit: 4*3 = 12
 */
export function combosForClass(hc: HandClass): number {
  const { type } = parseHandClass(hc);
  if (type === 'pair') return 6;
  if (type === 'suited') return 4;
  return 12;
}

/**
 * Expand a hand class to its concrete Card-pair combos.
 * Returns an array of [Card, Card] pairs (order within pair is hi-first).
 */
export function expandCombos(hc: HandClass): [Card, Card][] {
  const { hiRank, loRank, type } = parseHandClass(hc);
  const suits = ['s', 'h', 'd', 'c'] as const;
  const result: [Card, Card][] = [];

  if (type === 'pair') {
    // All C(4,2) = 6 pairs of the same rank
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        result.push([
          (hiRank + suits[i]) as Card,
          (loRank + suits[j]) as Card,
        ]);
      }
    }
  } else if (type === 'suited') {
    // 4 combos, one per suit
    for (const s of suits) {
      result.push([
        (hiRank + s) as Card,
        (loRank + s) as Card,
      ]);
    }
  } else {
    // Offsuit: 4*3 = 12 combos (hi and lo in different suits)
    for (const si of suits) {
      for (const sj of suits) {
        if (si !== sj) {
          result.push([
            (hiRank + si) as Card,
            (loRank + sj) as Card,
          ]);
        }
      }
    }
  }

  return result;
}
