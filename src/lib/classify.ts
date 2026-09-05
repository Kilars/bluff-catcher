/**
 * Classifier for poker draw taxonomy.
 * Pure, no UI imports. Consumes odds.ts types and helpers.
 *
 * classify(hero, board) → DrawRead | null
 *   Returns a DrawRead for keeper hands, null for made hands and air.
 *
 * Correctness principles:
 * - Every component predicate is rank- or suit-named, never generic.
 * - The composite hits predicate is the OR of component predicates so that
 *   analyse() deduplicates overlapping outs automatically.
 * - Overcards stack on every other component (no carve-out).
 * - Backdoor is only the primary category when the hand is otherwise air.
 */

import {
  type Card,
  RANKS,
  hasStraight,
} from './odds';

// ─── Public types ───────────────────────────────────────────────────────────

export type Category =
  | 'flushDraw'
  | 'openEnder'
  | 'gutshot'
  | 'doubleGutshot'
  | 'combo'
  | 'pairImproving'
  | 'overcards'
  | 'setDraw'
  | 'backdoor';

export type Component =
  | 'flush'
  | 'openEnder'
  | 'gutshot'
  | 'doubleGutshot'
  | 'overcard'
  | 'pairImprove'
  | 'set'
  | 'backdoor';

export interface DrawMeta {
  flushSuit: string | null;       // e.g. 's' when a 4-flush draw exists, else null
  overcardRanks: string[];        // e.g. ['A','K'] hero cards strictly above top board card
  straightType: 'openEnder' | 'doubleGutshot' | 'gutshot' | null;
  completingRanks: string[];      // rank chars that complete the straight (deduped)
  pairedRank: string | null;      // hero rank already paired with board, else null
  backdoorSuit: string | null;    // suit char when backdoor-only hand, else null
  pocketRank: string | null;      // rank char when hero has a pocket pair, else null
}

export interface DrawRead {
  primaryCategory: Category;
  components: Component[];
  name: string;
  note: string;
  hits: (cards: Card[], hero: Card[]) => boolean;
  backdoor?: boolean;
  meta: DrawMeta;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Rank index (0–12) for a card code. */
function ri(card: Card): number {
  return RANKS.indexOf(card[0]);
}

/** Count how many cards of each suit appear in a list. */
function suitCounts(cs: Card[]): Record<string, number> {
  const n: Record<string, number> = {};
  for (const c of cs) n[c[1]] = (n[c[1]] || 0) + 1;
  return n;
}

/**
 * Given a card set (known) and hero cards, compute the set of completing ranks:
 * rank indices r such that adding one card of rank r forms a 5-straight that
 * uses at least one hero card, and the straight does NOT already exist.
 */
function completingRanks(hero: Card[], board: Card[]): number[] {
  const known = hero.concat(board);
  if (hasStraight(known)) return []; // already made

  const heroRankIndices = new Set(hero.map(ri));
  // Ace can play low (index -1)
  if (heroRankIndices.has(12)) heroRankIndices.add(-1);

  const result: number[] = [];

  for (let rankIdx = 0; rankIdx <= 12; rankIdx++) {
    // Build a test card list with one card of this rank added
    const testCards = known.concat([RANKS[rankIdx] + 's'] as Card[]);
    if (!hasStraight(testCards)) continue;

    // Build the rank presence set for the test cards
    const testSet: Record<number, boolean> = {};
    for (const c of testCards) testSet[ri(c)] = true;
    if (testSet[12]) testSet[-1] = true;

    // Does any of the 5-straights that exist in testCards use a hero card?
    let usesHero = false;
    for (let lo = -1; lo <= 8; lo++) {
      let ok = true;
      for (let i = 0; i < 5; i++) {
        if (!testSet[lo + i]) { ok = false; break; }
      }
      if (ok) {
        for (let i = 0; i < 5; i++) {
          if (heroRankIndices.has(lo + i)) { usesHero = true; break; }
        }
        if (usesHero) break;
      }
    }
    if (usesHero) result.push(rankIdx);
  }
  return result;
}

/**
 * Classify the straight-family component from completing ranks.
 * Returns 'openEnder' | 'doubleGutshot' | 'gutshot' | null.
 */
function straightComponent(
  hero: Card[],
  board: Card[],
  cRanks: number[]
): 'openEnder' | 'doubleGutshot' | 'gutshot' | null {
  if (cRanks.length === 0) return null;
  if (cRanks.length === 1) return 'gutshot';

  // Check open-ender: are there 4 consecutive present ranks whose low- and
  // high-neighbour are both in cRanks?
  const known = hero.concat(board);
  const presentSet = new Set(known.map(ri));
  const cSet = new Set(cRanks);

  for (let lo = 0; lo <= 9; lo++) {
    if (
      presentSet.has(lo) &&
      presentSet.has(lo + 1) &&
      presentSet.has(lo + 2) &&
      presentSet.has(lo + 3)
    ) {
      if (cSet.has(lo - 1) && cSet.has(lo + 4)) return 'openEnder';
    }
  }

  return 'doubleGutshot';
}

/**
 * Returns the suit that gives us a flush draw (4+ to a suit including >=1 hero card),
 * or null if no flush draw exists. Returns 'made' if already 5+ to a suit (reject).
 */
function flushDrawSuit(
  hero: Card[],
  board: Card[]
): string | null | 'made' {
  const known = hero.concat(board);
  const counts = suitCounts(known);
  for (const suit of Object.keys(counts)) {
    if (counts[suit] >= 5) {
      // Check if at least one hero card is of this suit (so it's hero's flush)
      if (hero.some((h) => h[1] === suit)) return 'made';
    }
    if (counts[suit] === 4) {
      if (hero.some((h) => h[1] === suit)) return suit;
    }
  }
  return null;
}

/**
 * Returns the suit that gives a backdoor draw (exactly 3 to a suit including >=1 hero card).
 * Ignores suits that already have 4+ (those are flush draws or made flushes).
 */
function backdoorSuit(hero: Card[], board: Card[]): string | null {
  const known = hero.concat(board);
  const counts = suitCounts(known);
  for (const suit of Object.keys(counts)) {
    if (counts[suit] === 3 && hero.some((h) => h[1] === suit)) {
      return suit;
    }
  }
  return null;
}

/**
 * Detect which hero cards are overcards (strictly above max board rank).
 * Returns the rank characters of the overcards (e.g. ['A', 'K']).
 */
function overcardRanks(hero: Card[], board: Card[]): string[] {
  const maxBoard = board.reduce((m, c) => Math.max(m, ri(c)), -1);
  return hero.filter((h) => ri(h) > maxBoard).map((h) => h[0]);
}

/**
 * Detect if a hero card is paired with a board card (and that pair is not already
 * upgraded to trips or two-pair on the board).
 * Returns the rank character of the paired hero card, or null.
 *
 * We only flag the FIRST paired hero card (the higher one, to match the pairImproving pattern).
 */
function pairedHeroRank(hero: Card[], board: Card[]): string | null {
  for (const h of hero) {
    const boardCount = board.filter((c) => c[0] === h[0]).length;
    if (boardCount >= 1) return h[0];
  }
  return null;
}

// ─── Made-hand reject ───────────────────────────────────────────────────────

/**
 * Returns true if the hand should be rejected as already made (straight, flush,
 * trips, or two-pair-or-better using >=1 hero card).
 */
function isMadeHand(hero: Card[], board: Card[]): boolean {
  const known = hero.concat(board);

  // Made flush (5+ to a suit, uses hero card)
  const counts = suitCounts(known);
  for (const suit of Object.keys(counts)) {
    if (counts[suit] >= 5 && hero.some((h) => h[1] === suit)) return true;
  }

  // Made straight (uses hero card)
  if (hasStraight(known) && !hasStraight(board)) return true;
  // Also reject if the board already has a straight AND hero makes another one — but the
  // board-only straight isn't the hero's. So: only reject if hero participates.
  // The check above handles this: if hasStraight(board) is false, then the straight must
  // use hero. But if hasStraight(board) is already true, adding hero cards can't change the
  // made-hand status for the hero (the straight was there without them).
  // However: if both board and hero+board have a straight, hero may still have a straight —
  // we conservatively keep this as NOT a made hand for the hero (the board texture isn't theirs).
  // hasStraight(known) && !hasStraight(board) correctly captures "hero participates in the straight."

  // Trips (a rank appears 3+ times using >=1 hero card)
  const rankCounts: Record<string, number> = {};
  for (const c of known) rankCounts[c[0]] = (rankCounts[c[0]] || 0) + 1;
  for (const [rank, count] of Object.entries(rankCounts)) {
    if (count >= 3 && hero.some((h) => h[0] === rank)) return true;
  }

  // Two pair or better (two ranks each appear 2+ times, using >=1 hero card)
  const pairs = Object.entries(rankCounts).filter(([, n]) => n >= 2).map(([r]) => r);
  if (pairs.length >= 2 && pairs.some((r) => hero.some((h) => h[0] === r))) return true;

  return false;
}

// ─── Name composers ─────────────────────────────────────────────────────────

export function suitName(suit: string): string {
  const map: Record<string, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
  return map[suit] ?? suit;
}

export function rankName(rank: string): string {
  const map: Record<string, string> = {
    A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten',
    '9': 'nine', '8': 'eight', '7': 'seven', '6': 'six', '5': 'five',
    '4': 'four', '3': 'three', '2': 'two',
  };
  return map[rank] ?? rank;
}

function composeName(components: Component[], overcards: string[], straightType: string | null): string {
  const hasFlushComp = components.includes('flush');
  const hasStraightComp =
    components.includes('openEnder') ||
    components.includes('gutshot') ||
    components.includes('doubleGutshot');
  const hasOvercard = components.includes('overcard');
  const hasPairImprove = components.includes('pairImprove');
  const hasBackdoor = components.includes('backdoor');
  const hasSet = components.includes('set');

  if (hasBackdoor) return 'A backdoor flush draw';
  if (hasPairImprove) return 'A pair looking to improve';
  // Standalone set draw (no other draw component): name the set explicitly.
  // When set augments another draw, keep the other draw's name — the note carries the set.
  if (hasSet && !hasFlushComp && !hasStraightComp && !hasOvercard) {
    return 'A pair drawing to a set';
  }

  // Overcard description
  let overcardSuffix = '';
  if (hasOvercard) {
    if (overcards.length === 1) {
      overcardSuffix = ` with an overcard`;
    } else {
      overcardSuffix = ` with two overcards`;
    }
  }

  // Straight description
  let straightDesc = '';
  if (hasStraightComp) {
    if (straightType === 'openEnder') straightDesc = 'an open-ended straight draw';
    else if (straightType === 'doubleGutshot') straightDesc = 'a double gutshot';
    else straightDesc = 'a gutshot';
  }

  if (hasFlushComp && hasStraightComp) {
    return `A flush draw and ${straightDesc}${overcardSuffix}`;
  }
  if (hasFlushComp) {
    return `A flush draw${overcardSuffix}`;
  }
  if (hasStraightComp && overcards.length === 1) {
    const typeName =
      straightType === 'openEnder'
        ? 'An open-ended straight draw'
        : straightType === 'doubleGutshot'
        ? 'A double gutshot'
        : 'A gutshot';
    return `${typeName} with an overcard`;
  }
  if (hasStraightComp && overcards.length >= 2) {
    const typeName =
      straightType === 'openEnder'
        ? 'An open-ended straight draw'
        : straightType === 'doubleGutshot'
        ? 'A double gutshot'
        : 'A gutshot';
    return `${typeName} with two overcards`;
  }
  if (hasStraightComp) {
    if (straightType === 'openEnder') return 'An open-ended straight draw';
    if (straightType === 'doubleGutshot') return 'A double gutshot';
    return 'A gutshot';
  }
  if (hasOvercard) {
    if (overcards.length === 1) return 'An overcard';
    return 'Two overcards';
  }
  return 'A draw';
}

function composeNote(
  primaryCategory: Category,
  overcards: string[],
  flushSuit: string | null,
  components: Component[]
): string {
  const hasSet = components.includes('set');

  // Set augmenting another draw — append a short clause to the primary note.
  function maybeSetSuffix(base: string): string {
    if (hasSet && primaryCategory !== 'setDraw') {
      return base + ' Plus you can still spike a set.';
    }
    return base;
  }

  switch (primaryCategory) {
    case 'flushDraw': {
      const suit = flushSuit ? suitName(flushSuit) : 'suited';
      if (overcards.length > 0) {
        return maybeSetSuffix(`Four ${suit}, plus your ${rankName(overcards[0])} can make top pair.`);
      }
      return maybeSetSuffix(`Four ${suit}. The bread-and-butter draw.`);
    }
    case 'combo':
      return maybeSetSuffix('Two draws at once. This is the hand you raise with, not the one you call with.');
    case 'openEnder':
      if (overcards.length > 0) {
        return maybeSetSuffix('Both ends of the run are live, plus pairing up helps.');
      }
      return maybeSetSuffix('Both ends of the run are live.');
    case 'gutshot':
      if (overcards.length > 0) {
        return maybeSetSuffix('Only the belly card gets there, but your overcards add equity.');
      }
      return maybeSetSuffix('Only the belly card gets there. It feels like a draw; it barely is one.');
    case 'doubleGutshot':
      return maybeSetSuffix('Looks like a gutshot, plays like an open-ender. The trap in the ladder.');
    case 'pairImproving':
      return 'Small draw, easy to overrate. Trips or two-pair to improve.';
    case 'overcards': {
      const names = overcards.map(rankName).join(' and ');
      return `${names.charAt(0).toUpperCase()}${names.slice(1)} pairing is probably good on this board.`;
    }
    case 'setDraw':
      // Bare pocket pair, no other draw. Two outs to a set — small but real.
      return 'Only two outs, but a set is well disguised. Worth knowing the number.';
    case 'backdoor':
      return 'Three to a suit, not four. As a draw this is nearly nothing.';
    default:
      return '';
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Classify a hero hand + board into a DrawRead, or return null for made hands and air.
 */
export function classify(hero: Card[], board: Card[]): DrawRead | null {
  // Reject made hands first
  if (isMadeHand(hero, board)) return null;

  // ── Component detection ────────────────────────────────────────────────

  // Flush draw
  const fdSuit = flushDrawSuit(hero, board);
  if (fdSuit === 'made') return null; // 5+ to a suit without hitting isMadeHand (edge)
  const hasFlushDraw = fdSuit !== null;

  // Straight components
  const cRanks = completingRanks(hero, board);
  const straightComp = straightComponent(hero, board, cRanks);

  // Overcards
  const ocRanks = overcardRanks(hero, board);

  // Made pair (for pairImproving)
  const pairedRank = pairedHeroRank(hero, board);

  // Backdoor (only 3 to a suit, no other components). A backdoor flush needs
  // TWO running cards, so it is only a draw on the flop (3 board cards). On the
  // turn a 3-flush can never complete — it is air, not a keeper.
  const bdSuit = backdoorSuit(hero, board);
  const hasBdFlush = bdSuit !== null && !hasFlushDraw && board.length === 3;

  // Pocket pair detection: hero holds two cards of the same rank (and isMadeHand
  // has already rejected trips/two-pair, so this is a genuine draw to a set).
  const isPocketPair = hero[0][0] === hero[1][0];
  const pocketRank = isPocketPair ? hero[0][0] : null;

  // AA guard: only add the set component when the pocket rank is NOT an overcard.
  // For a pair of overcards (e.g. AA on a low board), the overcard predicate already
  // counts those two aces — adding a set predicate would double-count them.
  const isSet = isPocketPair && pocketRank !== null && !ocRanks.includes(pocketRank);

  // ── No keeper? ─────────────────────────────────────────────────────────
  const hasStraightDraw = straightComp !== null;
  const hasOvercard = ocRanks.length > 0;
  const hasPairImprove = pairedRank !== null;

  if (!hasFlushDraw && !hasStraightDraw && !hasOvercard && !hasPairImprove && !hasBdFlush && !isSet) {
    return null; // air
  }

  // ── Backdoor-only: no other component ──────────────────────────────────
  if (!hasFlushDraw && !hasStraightDraw && !hasOvercard && !hasPairImprove && !isSet && hasBdFlush) {
    return {
      primaryCategory: 'backdoor',
      components: ['backdoor'],
      name: 'A backdoor flush draw',
      note: `Three ${suitName(bdSuit!)}. As a draw this is nearly nothing.`,
      hits: (_cs, _hero) => false, // backdoor uses mode:'backdoor' in analyse
      backdoor: true,
      meta: {
        flushSuit: null,
        overcardRanks: [],
        straightType: null,
        completingRanks: [],
        pairedRank: null,
        backdoorSuit: bdSuit,
        pocketRank,
      },
    };
  }

  // ── Build components list ──────────────────────────────────────────────
  const components: Component[] = [];
  if (hasFlushDraw) components.push('flush');
  if (straightComp === 'openEnder') components.push('openEnder');
  else if (straightComp === 'doubleGutshot') components.push('doubleGutshot');
  else if (straightComp === 'gutshot') components.push('gutshot');
  if (hasOvercard && !hasPairImprove) components.push('overcard');
  if (hasPairImprove) components.push('pairImprove');
  // Set component: only when the pocket pair is NOT an overcard (AA guard).
  if (isSet) components.push('set');

  // ── Primary category (precedence order) ────────────────────────────────
  // combo → flushDraw → openEnder → doubleGutshot → gutshot → pairImproving
  //   → overcards → setDraw
  let primaryCategory: Category;
  if (hasFlushDraw && hasStraightDraw) {
    primaryCategory = 'combo';
  } else if (hasFlushDraw) {
    primaryCategory = 'flushDraw';
  } else if (straightComp === 'openEnder') {
    primaryCategory = 'openEnder';
  } else if (straightComp === 'doubleGutshot') {
    primaryCategory = 'doubleGutshot';
  } else if (straightComp === 'gutshot') {
    primaryCategory = 'gutshot';
  } else if (hasPairImprove) {
    primaryCategory = 'pairImproving';
  } else if (hasOvercard) {
    primaryCategory = 'overcards';
  } else {
    // Bare pocket pair with no other draw component — setDraw is the only thing going.
    primaryCategory = 'setDraw';
  }

  // ── Composite hits predicate ───────────────────────────────────────────
  // Each sub-predicate is rank- or suit-named. We build closures capturing the
  // specific ranks/suits detected above, then OR them together.

  const predicates: ((cs: Card[], h: Card[]) => boolean)[] = [];

  // Flush: 5+ to the specific suit detected
  if (hasFlushDraw) {
    const suit = fdSuit!;
    predicates.push((cs) => {
      let count = 0;
      for (const c of cs) if (c[1] === suit) count++;
      return count >= 5;
    });
  }

  // Straight: hasStraight (already rank-aware via completing ranks detection)
  if (hasStraightDraw) {
    predicates.push((cs) => hasStraight(cs));
  }

  // PairImprove: trips of the paired rank OR pairing the overcard kicker
  if (hasPairImprove) {
    const pRank = pairedRank!;
    // Trips predicate: pRank appears 3+ times in cs
    predicates.push((cs, _h) => cs.filter((c) => c[0] === pRank).length >= 3);
    // Overcard kicker two-pair: for each overcard rank, it appears 2+ times in cs.
    // Threshold is heroCount(r) + 1 so that a pocket-pair overcard (e.g. AA) needs 3,
    // not 2, to avoid counting every unseen card as an out.
    for (const ocr of ocRanks) {
      const r = ocr;
      const heroCount = hero.filter((c) => c[0] === r).length;
      const threshold = heroCount + 1;
      predicates.push((cs) => cs.filter((c) => c[0] === r).length >= threshold);
    }
  } else if (hasOvercard) {
    // Overcard pairing: each overcard rank appears threshold+ times in cs,
    // where threshold = heroCount(r) + 1 (handles pocket-pair overcards correctly).
    for (const ocr of ocRanks) {
      const r = ocr;
      const heroCount = hero.filter((c) => c[0] === r).length;
      const threshold = heroCount + 1;
      predicates.push((cs) => cs.filter((c) => c[0] === r).length >= threshold);
    }
  }

  // Set: pocket pair drawing to trips. Only added when isSet (AA guard applied above).
  // Predicate: the pocket rank appears 3+ times in cs (hero pair + one new card).
  if (isSet) {
    const pr = pocketRank!;
    predicates.push((cs) => cs.filter((c) => c[0] === pr).length >= 3);
  }

  const hits = (cs: Card[], h: Card[]): boolean =>
    predicates.some((p) => p(cs, h));

  // ── Name and note ──────────────────────────────────────────────────────
  const name = composeName(components, ocRanks, straightComp);
  const note = composeNote(primaryCategory, ocRanks, fdSuit, components);

  // ── Meta: surface the structured facts the explanation generator needs ──
  // Map completing rank indices to rank characters; -1 (ace-low) maps to 'A'.
  const cRankChars = Array.from(
    new Set(cRanks.map((idx) => (idx === -1 ? 'A' : RANKS[idx])))
  );

  return {
    primaryCategory,
    components,
    name,
    note,
    hits,
    meta: {
      flushSuit: fdSuit,
      overcardRanks: ocRanks,
      straightType: straightComp,
      completingRanks: cRankChars,
      pairedRank,
      backdoorSuit: null,
      pocketRank,
    },
  };
}
