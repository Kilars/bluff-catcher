/**
 * Explanation generator — produces structured copy for the ExplainSheet
 * from a classified DrawRead + its Analysis. Pure, no UI imports.
 */

import type { Card, Analysis } from './odds';
import { type DrawRead, rankName, suitName } from './classify';

// ─── Public types ────────────────────────────────────────────────────────────

export interface ExplainStep {
  index: string;
  title: string;
  body: string;
}

export interface Explanation {
  title: string;
  subline: string;
  outsList: Card[];
  step1: ExplainStep;
  step2: ExplainStep;
  step3: ExplainStep | null;
  headMaths: {
    quickSum: string;
    quickNote: string;
    trueNumber: string;
    trueNote: string;
  };
  memorise: { label: string; value: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<number, string> = {
  0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
  6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
  11: 'Eleven', 12: 'Twelve', 13: 'Thirteen', 14: 'Fourteen', 15: 'Fifteen',
  16: 'Sixteen', 17: 'Seventeen', 18: 'Eighteen', 19: 'Nineteen',
  20: 'Twenty', 21: 'Twenty-one',
};

function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** Lowercase word form, e.g. 'nine', 'ace'. Delegates to rankName. */
function rankWord(rank: string): string {
  return rankName(rank);
}

/** Plural form of a rank word, e.g. 'nines', 'aces', 'sixes'. */
function rankWordPlural(rank: string): string {
  const word = rankWord(rank);
  // Words ending in 'e' that need 's' only (ace, nine, five, etc.)
  if (word === 'six') return 'sixes';
  if (word.endsWith('e')) return word + 's'; // ace→aces, nine→nines, five→fives
  if (word.endsWith('n')) return word + 's'; // ten→tens, seven→sevens
  if (word.endsWith('g')) return word + 's'; // king→kings
  if (word.endsWith('r')) return word + 's'; // four→fours
  if (word.endsWith('o')) return word + 's'; // two→twos
  // jack, queen → jacks, queens
  return word + 's';
}

/** Full suit name, plural: 'spades', 'hearts', 'diamonds', 'clubs'. */
function suitWord(suit: string): string {
  return suitName(suit);
}

/** Full suit name, singular: 'spade', 'heart', 'diamond', 'club'. */
function suitWordSingular(suit: string): string {
  const map: Record<string, string> = { s: 'spade', h: 'heart', d: 'diamond', c: 'club' };
  return map[suit] ?? suitName(suit);
}

/** Count of a given suit among a card list. */
function suitCount(cards: Card[], suit: string): number {
  let n = 0;
  for (const c of cards) if (c[1] === suit) n++;
  return n;
}

// ─── Step 1 generators ───────────────────────────────────────────────────────

function step1Flush(
  suit: string,
  hero: Card[],
  board: Card[],
  analysis: Analysis
): ExplainStep {
  const known = hero.concat(board);
  const knownOfSuit = suitCount(known, suit);
  const remaining = 13 - knownOfSuit;
  const outs = analysis.outs;
  const suitW = suitWord(suit);
  return {
    index: '01',
    title: `${numberWord(outs)} ${suitW} are still live`,
    body: `Thirteen ${suitW} exist. ${knownOfSuit === 4 ? 'Four' : knownOfSuit} are face up. ${numberWord(remaining)} are still in the deck, and any one makes your flush.`,
  };
}

function step1OpenEnder(
  completingRanks: string[],
  analysis: Analysis
): ExplainStep {
  const outs = analysis.outs;
  // Open-ender has exactly 2 completing ranks
  const [r1, r2] = completingRanks;
  const r1w = r1 ? rankWordPlural(r1) : 'cards';
  const r2w = r2 ? rankWordPlural(r2) : 'cards';
  return {
    index: '01',
    title: `${numberWord(outs)} cards finish the run`,
    body: `Four ${r1w} make the low end, four ${r2w} make the high end. Both ends are live.`,
  };
}

function step1Gutshot(completingRanks: string[]): ExplainStep {
  const rank = completingRanks[0] ?? '?';
  const rankW = rankWord(rank);
  const rankWPlural = rankWordPlural(rank);
  return {
    index: '01',
    title: `Four ${rankWPlural} and nothing else`,
    body: `You need a ${rankW} — and no other rank helps. Four ${rankWPlural}. Four outs.`,
  };
}

function step1DoubleGutshot(
  completingRanks: string[],
  analysis: Analysis
): ExplainStep {
  const outs = analysis.outs;
  const [r1, r2] = completingRanks;
  const r1w = r1 ? rankWord(r1) : 'card';
  const r2w = r2 ? rankWord(r2) : 'card';
  return {
    index: '01',
    title: 'Two belly cards, eight outs',
    body: `A ${r1w} makes one straight, a ${r2w} makes another. Two separate inside draws — ${numberWord(outs).toLowerCase()} outs, not four.`,
  };
}

function step1FlushOvercard(
  suit: string,
  overcardRanks: string[],
  hero: Card[],
  board: Card[],
  analysis: Analysis
): ExplainStep {
  const known = hero.concat(board);
  const knownOfSuit = suitCount(known, suit);
  const flushOuts = 13 - knownOfSuit;
  const ocRank = overcardRanks[0];
  const ocRankW = ocRank ? rankWordPlural(ocRank) : 'overcards';
  const suitW = suitWord(suit);
  const pairingOuts = analysis.outs - flushOuts;
  const pairingOutsWord = pairingOuts > 0 ? numberWord(pairingOuts) : 'Three';
  return {
    index: '01',
    title: `${numberWord(flushOuts)} ${suitW} plus ${pairingOutsWord.toLowerCase()} ${ocRankW}`,
    body: `${numberWord(flushOuts)} ${suitW} finish the flush. ${pairingOutsWord} more ${ocRankW} give you top pair. ${numberWord(analysis.outs)} outs.`,
  };
}

function step1ComboFlushStraight(
  suit: string,
  hero: Card[],
  board: Card[],
  overcardRanks: string[],
  analysis: Analysis
): ExplainStep {
  const outs = analysis.outs;
  const suitW = suitWord(suit);
  const flushOuts = 13 - suitCount(hero.concat(board), suit);
  const overlapLine = `The ${suitW} that also complete the straight are counted once.`;

  // The classic teaching case: flush + straight and nothing else = 15, not 17.
  if (overcardRanks.length === 0) {
    return {
      index: '01',
      title: `${numberWord(outs)} outs, not seventeen`,
      body: `${numberWord(flushOuts)} ${suitW} make the flush, eight cards make the straight. ${overlapLine} ${numberWord(outs)} outs.`,
    };
  }

  // Combo that also has overcards — the outs stack past 15, so name them.
  const ocWords = overcardRanks.map((r) => rankWordPlural(r)).join(' and ');
  return {
    index: '01',
    title: `${numberWord(outs)} outs — flush, straight, overcards`,
    body: `${numberWord(flushOuts)} ${suitW} make the flush, eight cards make the straight, and your ${ocWords} pair for top pair on top. ${overlapLine} ${numberWord(outs)} outs.`,
  };
}

function step1PairImproving(
  pairedRank: string,
  overcardRanks: string[],
  analysis: Analysis
): ExplainStep {
  const pRankPlural = rankWordPlural(pairedRank);
  const pRank = rankWord(pairedRank);
  const ocRank = overcardRanks[0];
  if (ocRank) {
    const ocRankPlural = rankWordPlural(ocRank);
    return {
      index: '01',
      title: `Two ${pRankPlural} and three ${ocRankPlural}`,
      body: `Two more ${pRankPlural} give you trips. Three ${ocRankPlural} pair your ${rankWord(ocRank)} — two pair. Five outs.`,
    };
  }
  return {
    index: '01',
    title: `Two ${pRankPlural} and three kickers`,
    body: `Two more ${pRankPlural} give you trips. Three kicker cards give two pair. Your ${pRank} is already on the board — ${numberWord(analysis.outs)} outs.`,
  };
}

function step1Overcards(
  overcardRanks: string[],
  analysis: Analysis
): ExplainStep {
  const [r1, r2] = overcardRanks;
  if (r1 && r2) {
    const r1Plural = rankWordPlural(r1);
    const r2Plural = rankWordPlural(r2);
    return {
      index: '01',
      title: `Three ${r1Plural}, three ${r2Plural}`,
      body: `Both hole cards beat every card on this board. Three ${r1Plural} pair your ${rankWord(r1)}, three ${r2Plural} pair your ${rankWord(r2)}. Either makes top pair. ${numberWord(analysis.outs)} outs.`,
    };
  }
  const r1Plural = r1 ? rankWordPlural(r1) : 'overcards';
  return {
    index: '01',
    title: `Three ${r1Plural}`,
    body: `Your ${r1 ? rankWord(r1) : 'overcard'} beats the whole board. Three ${r1Plural} pair it up. ${numberWord(analysis.outs)} outs.`,
  };
}

function step1Backdoor(
  backdoorSuit: string,
  hero: Card[],
  board: Card[]
): ExplainStep {
  const known = hero.concat(board);
  const knownOfSuit = suitCount(known, backdoorSuit);
  const remaining = 13 - knownOfSuit;
  const suitW = suitWord(backdoorSuit);
  const suitSingular = suitWordSingular(backdoorSuit);
  return {
    index: '01',
    title: 'Zero outs — you need both cards',
    body: `You hold one ${suitSingular} and the board brought two, so three of five. ${numberWord(remaining)} ${suitW} remain, but no single card gets you there.`,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function explain(
  read: DrawRead,
  analysis: Analysis,
  hero: Card[],
  board: Card[]
): Explanation {
  const { meta, name, backdoor } = read;
  const { outs, streets, total, quick } = analysis;

  const isBackdoor = backdoor === true;
  const mult = streets === 2 ? 4 : 2;
  const street = streets === 2 ? 'Flop' : 'Turn';
  const toCome = streets === 2 ? 'two cards to come' : 'one card to come';

  // ── title ──────────────────────────────────────────────────────────────
  const title = isBackdoor
    ? 'Roughly 4%, and no shortcut'
    : `${outs} outs → ${Math.round(total)}%`;

  // ── subline ────────────────────────────────────────────────────────────
  const subline = `${name} · ${street} · ${toCome}`;

  // ── step1 ──────────────────────────────────────────────────────────────
  let step1: ExplainStep;

  if (isBackdoor) {
    const bdSuit = meta.backdoorSuit ?? meta.flushSuit ?? 'h';
    step1 = step1Backdoor(bdSuit, hero, board);
  } else if (read.components.includes('flush') && read.components.includes('overcard') && !read.components.some(c => c === 'openEnder' || c === 'gutshot' || c === 'doubleGutshot')) {
    // flush + overcard (no straight component)
    step1 = step1FlushOvercard(meta.flushSuit!, meta.overcardRanks, hero, board, analysis);
  } else if (read.components.includes('flush') && read.components.some(c => c === 'openEnder' || c === 'gutshot' || c === 'doubleGutshot')) {
    // combo: flush + straight
    step1 = step1ComboFlushStraight(meta.flushSuit!, hero, board, meta.overcardRanks, analysis);
  } else if (read.components.includes('flush')) {
    // pure flush draw (no overcard, no straight)
    step1 = step1Flush(meta.flushSuit!, hero, board, analysis);
  } else if (read.components.includes('openEnder')) {
    step1 = step1OpenEnder(meta.completingRanks, analysis);
  } else if (read.components.includes('doubleGutshot')) {
    step1 = step1DoubleGutshot(meta.completingRanks, analysis);
  } else if (read.components.includes('gutshot')) {
    step1 = step1Gutshot(meta.completingRanks);
  } else if (read.components.includes('pairImprove')) {
    step1 = step1PairImproving(meta.pairedRank!, meta.overcardRanks, analysis);
  } else {
    // overcards-only
    step1 = step1Overcards(meta.overcardRanks, analysis);
  }

  // ── step2 ──────────────────────────────────────────────────────────────
  let step2: ExplainStep;

  if (isBackdoor) {
    const bdSuitName = suitWord(meta.backdoorSuit ?? 'hearts');
    step2 = {
      index: '02',
      title: 'The rule of 4 does not apply',
      body: `There is nothing to multiply — zero outs times four is still zero. Both remaining cards have to be ${bdSuitName}, and two things that both must happen are much rarer than one thing that might. Treat a backdoor as a bonus attached to whatever else your hand is doing, never as a reason to call.`,
    };
  } else if (streets === 2) {
    step2 = {
      index: '02',
      title: 'Two cards to come, so multiply by 4',
      body: 'Each remaining card is roughly a 2% shot per out, and you get two of them. So outs × 4 is your chance of getting there by the river — the only arithmetic you need at the table.',
    };
  } else {
    step2 = {
      index: '02',
      title: 'One card to come, so multiply by 2',
      body: 'One card left means one chance, so the multiplier halves: outs × 2.',
    };
  }

  // ── step3 ──────────────────────────────────────────────────────────────
  let step3: ExplainStep | null = null;

  if (!isBackdoor && quick !== null) {
    const truePct = Math.round(total);
    const drift = quick - total;

    if (streets === 2 && outs > 8) {
      step3 = {
        index: '03',
        title: 'Where the shortcut drifts',
        body: `Past eight outs the ×4 runs hot: ${outs} × 4 says ${quick}%, the deck says ${truePct}%. The fix is one subtraction — take off the outs above eight. ${outs} × 4 = ${quick}, minus ${outs - 8} = ${quick - (outs - 8)}%. Within a point.`,
      };
    } else if (Math.abs(drift) > 0.9) {
      step3 = {
        index: '03',
        title: 'Where the shortcut drifts',
        body: `×${mult} says ${quick}%, the deck says ${truePct}% — ${Math.abs(drift).toFixed(1)} of a point out. Ignore it. What actually costs you money is an out that is not clean: a card that fills your flush and also fills villain’s straight is worth less than one out.`,
      };
    }
  }

  // ── headMaths ──────────────────────────────────────────────────────────
  let headMaths: Explanation['headMaths'];

  if (isBackdoor) {
    const bdSuitName = suitWord(meta.backdoorSuit ?? 'hearts');
    headMaths = {
      quickSum: 'No outs to multiply',
      quickNote: 'Memorise the number instead',
      trueNumber: total.toFixed(1),
      trueNote: `Both cards must come ${bdSuitName}`,
    };
  } else {
    headMaths = {
      quickSum: `${outs} × ${mult} = ${quick}%`,
      quickNote: `outs × ${mult}, done in your head`,
      trueNumber: total.toFixed(1),
      trueNote: 'What the deck actually does',
    };
  }

  // ── memorise (fixed six rows) ──────────────────────────────────────────
  const memorise: Explanation['memorise'] = [
    { label: '15 outs', value: '54%' },
    { label: '8 · open-ender', value: '31%' },
    { label: '12 outs', value: '45%' },
    { label: '6 · overcards', value: '24%' },
    { label: '9 · flush draw', value: '35%' },
    { label: '4 · gutshot', value: '17%' },
  ];

  return {
    title,
    subline,
    outsList: analysis.outsList,
    step1,
    step2,
    step3,
    headMaths,
    memorise,
  };
}
