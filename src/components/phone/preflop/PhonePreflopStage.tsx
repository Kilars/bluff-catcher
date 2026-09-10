/**
 * PhonePreflopStage — the two hero cards, big, and the hand class under them.
 *
 * PLAN-phone §5.2 spends the 144px reclaimed from the felt here: the desktop
 * hero card is 82×116, and ×1.45 lands on **120×170**, whose rank and suit fall
 * on 44px and 40px — both already on the DECISIONS.md type scale. On phone
 * these cards are the flashcard; everything else on the screen is a caption.
 *
 *   hero cards   170px   120 × 170, rank 44 / suit 40
 *   hand class    52px   11px kicker + 28px class
 *
 * Why the card face is drawn here rather than by `components/Card.tsx`: Card's
 * sizes are fixed in its own module (82×116 for `hero`), and the phone tree
 * carries **no scale transform anywhere** (§4.2), so there is no honest way to
 * get 120×170 out of it without editing a shared desktop stylesheet. What is
 * duplicated is nine lines of glyph-and-colour presentation, not behaviour.
 */

import type { Card as CardCode } from '../../../lib/odds';
import type { HandClass } from '../../../lib/preflop/hands';
import styles from './PhonePreflopStage.module.css';

// ─── Card face ────────────────────────────────────────────────────────────────

const SUIT_GLYPHS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

const SUIT_NAMES: Record<string, string> = {
  s: 'spades',
  h: 'hearts',
  d: 'diamonds',
  c: 'clubs',
};

function pipColor(suit: string): string {
  return suit === 'h' || suit === 'd' ? 'var(--pip-red)' : 'var(--pip-black)';
}

function displayRank(rankChar: string): string {
  return rankChar === 'T' ? '10' : rankChar;
}

function PhoneHeroCard({ code }: { code: CardCode }) {
  const rank = code[0];
  const suit = code[1];
  const color = pipColor(suit);

  return (
    <div
      className={styles.card}
      data-testid="phone-hero-card"
      data-card={code}
      aria-label={`${displayRank(rank)} of ${SUIT_NAMES[suit] ?? suit}`}
    >
      <span className={styles.rank} style={{ color }}>
        {displayRank(rank)}
      </span>
      <span className={styles.suit} style={{ color }} aria-hidden="true">
        {SUIT_GLYPHS[suit] ?? suit}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PhonePreflopStageProps {
  /** Hero's two cards, as dealt. */
  cards: [CardCode, CardCode];
  /** The canonical class of those two cards, e.g. "A5s". */
  handClass: HandClass;
}

export default function PhonePreflopStage({ cards, handClass }: PhonePreflopStageProps) {
  return (
    <div className={styles.stage}>
      <div className={styles.cards}>
        {cards.map((code) => (
          <PhoneHeroCard key={code} code={code} />
        ))}
      </div>
      <div className={styles.classBlock}>
        <span className={styles.kicker}>Your hand</span>
        <span className={styles.handClass} data-testid="hand-class">
          {handClass}
        </span>
      </div>
    </div>
  );
}
