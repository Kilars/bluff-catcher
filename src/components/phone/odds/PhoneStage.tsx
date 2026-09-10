/**
 * PhoneStage — the read zone of the phone odds drill.
 *
 * This is the flashcard half of "a flashcard and a dial" (PLAN-phone §5.1).
 * It is deliberately **pixel-identical before and after a commit**: comparing
 * the answer *to the cards* is the learning act, so nothing here may move when
 * the guess lands. The structural guarantee is that this component takes no
 * commit-related prop at all — there is no `guess`, no `band`, no way for it to
 * know which state the drill is in.
 *
 * Deleting the 820 × 380 felt is what makes the phone layout work. There are
 * always exactly five board slots (3 cards + 2 blanks on the flop, 4 + 1 on the
 * turn) and
 *
 *     5 × 66px + 4 × 8.4px = 363.6px   which fits 366px (390 − 2 × 12 gutters)
 *
 * so board cards render at their **exact desktop size, unscaled**, and the hero
 * cards get *bigger* than desktop (96 × 136 against 82 × 116). No transform is
 * involved anywhere in this tree — the felt was the only thing forcing one.
 *
 * The dashed Turn/River blanks are kept 1:1 from the felt. They were the most
 * useful thing on it: "how many cards to come", made visual, which is exactly
 * the ×4 / ×2 distinction the drill teaches.
 *
 * A 360px-wide Android is the case that breaks the arithmetic first (336px
 * usable against 363.6px of row), so the slot width is a clamp rather than a
 * constant — see PhoneStage.module.css.
 */

import Card from '../../Card';
import styles from './PhoneStage.module.css';
import type { Card as CardCode } from '../../../lib/odds';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Board slots on screen at all times — 3 or 4 cards, the rest blanks. */
const BOARD_SLOTS = 5;

/** Blank labels in board order; the tail of this list is what is still to come. */
const TO_COME = ['Turn', 'River'] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhoneStageProps {
  hero: CardCode[];
  board: CardCode[];
  street: 'flop' | 'turn';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PhoneStage({ hero, board, street }: PhoneStageProps) {
  const flop = street === 'flop';

  // 2 blanks on the flop, 1 on the turn — derived from the board itself so the
  // row is always five wide even if a caller hands over an odd board.
  const missing = Math.max(0, Math.min(TO_COME.length, BOARD_SLOTS - board.length));
  const blanks = TO_COME.slice(TO_COME.length - missing);

  return (
    <section className={styles.stage} data-testid="phone-stage">
      {/* Street chip — load-bearing copy: it is how the learner knows whether
          the shortcut is ×4 or ×2. */}
      <div className={styles.streetChip} data-testid="phone-street-chip">
        {flop ? 'Flop · 2 to come' : 'Turn · 1 to come'}
      </div>

      {/* Board row — five slots, always. */}
      <div className={styles.boardRow} data-testid="phone-board-row">
        {board.map((code) => (
          <div key={code} className={styles.boardSlot} data-testid="phone-board-slot">
            <Card code={code} variant="board" />
          </div>
        ))}
        {blanks.map((label) => (
          <div key={label} className={styles.boardSlot} data-testid="phone-board-slot">
            <div className={styles.blank} data-testid="phone-board-blank">
              <span className={styles.blankLabel}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.gapBoardToHero} aria-hidden="true" />

      {/* Hero row — larger than desktop, because there is no felt to fit into. */}
      <div className={styles.heroRow} data-testid="phone-hero-row">
        {hero.map((code) => (
          <div key={code} className={styles.heroSlot}>
            <Card code={code} variant="hero" />
          </div>
        ))}
      </div>

      <div className={styles.gapHeroToSwap} aria-hidden="true" />
    </section>
  );
}
