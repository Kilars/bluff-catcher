/**
 * Table — the felt with villain backs, board cards, hero cards, street line.
 * Villain backs are always shown (they never reveal in this drill).
 */

import Card from './Card';
import styles from './Table.module.css';
import type { Card as CardCode } from '../lib/odds';

interface TableProps {
  hero: CardCode[];
  board: CardCode[];
  street: 'flop' | 'turn';
}

export default function Table({ hero, board, street }: TableProps) {
  const twoCards = street === 'flop'; // 2 to come on flop, 1 on turn
  const blanks = twoCards
    ? [{ label: 'Turn' }, { label: 'River' }]
    : [{ label: 'River' }];

  return (
    <section className={styles.table}>
      <div className={styles.felt}>
        {/* Inner accent ring */}
        <div className={styles.accentRing} />

        {/* Villain */}
        <div className={styles.villain}>
          <div className={styles.villainCards}>
            <Card variant="villainBack" />
            <Card variant="villainBack" />
          </div>
          <span className={styles.villainLabel}>Villain</span>
        </div>

        {/* Street line */}
        <div className={styles.streetLine}>
          <span>{twoCards ? 'Flop' : 'Turn'}</span>
          <span className={styles.streetDot}>·</span>
          <span>{twoCards ? 'Two cards to come' : 'One card to come'}</span>
        </div>

        {/* Board cards + blank placeholders */}
        <div className={styles.boardRow}>
          {board.map((code) => (
            <Card key={code} code={code} variant="board" />
          ))}
          {blanks.map((b) => (
            <div key={b.label} className={styles.blankCard}>
              <span className={styles.blankLabel}>{b.label}</span>
            </div>
          ))}
        </div>

        {/* Hero cards — overhanging felt bottom */}
        <div className={styles.heroRow}>
          {hero.map((code) => (
            <Card key={code} code={code} variant="hero" />
          ))}
        </div>
      </div>
    </section>
  );
}
