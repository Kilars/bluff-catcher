/**
 * Card — renders a single playing card face or villain back.
 * Size variant is set via the `variant` prop.
 */

import styles from './Card.module.css';

const SUIT_GLYPHS: Record<string, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

function pipColor(suit: string): string {
  return suit === 'h' || suit === 'd' ? 'var(--pip-red)' : 'var(--pip-black)';
}

function displayRank(rankChar: string): string {
  return rankChar === 'T' ? '10' : rankChar;
}

type CardVariant = 'board' | 'hero' | 'out' | 'villainBack';

interface CardProps {
  /** Card code e.g. 'As', 'Td'. Not needed for villainBack. */
  code?: string;
  variant: CardVariant;
}

export default function Card({ code, variant }: CardProps) {
  if (variant === 'villainBack') {
    return <div className={`${styles.card} ${styles.villainBack}`} />;
  }

  if (!code) return null;

  const rank = code[0];
  const suit = code[1];
  const color = pipColor(suit);
  const glyph = SUIT_GLYPHS[suit] ?? suit;
  const displayR = displayRank(rank);

  const sizeClass = styles[variant]; // 'board' | 'hero' | 'out'
  const rankClass = styles[`rank${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as keyof typeof styles];
  const suitClass = styles[`suit${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as keyof typeof styles];

  return (
    <div className={`${styles.card} ${sizeClass}`}>
      <span className={rankClass} style={{ color }}>{displayR}</span>
      <span className={suitClass} style={{ color }}>{glyph}</span>
    </div>
  );
}
