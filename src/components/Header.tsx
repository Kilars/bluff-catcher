/**
 * Header — brand + stats + band tally.
 * 54px fixed, 1px bottom divider.
 */

import styles from './Header.module.css';

interface HeaderProps {
  hands: number;
  streak: number;
  errors: number[];
  bands: { green: number; amber: number; red: number };
  onResetStats?: () => void;
}

export default function Header({ hands, streak, errors, bands, onResetStats }: HeaderProps) {
  const avgError =
    errors.length > 0
      ? `±${(errors.reduce((a, b) => a + b, 0) / errors.length).toFixed(1)}`
      : '—';

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandName}>RUNOUT</span>
        <span className={styles.brandSub}>Odds trainer</span>
      </div>

      <div className={styles.right}>
        <div className={styles.statPair}>
          <span>Hands</span>
          <span className={styles.statValue}>{hands}</span>
        </div>
        <div className={styles.statPair}>
          <span>Streak</span>
          <span className={styles.statValueAccent}>{streak}</span>
        </div>
        <div className={styles.statPair}>
          <span>Avg error</span>
          <span className={styles.statValue}>{avgError}</span>
        </div>

        <div className={styles.bandTally}>
          <span
            className={styles.bandDot}
            style={{ background: 'var(--band-green)' }}
          />
          <span className={styles.bandCount}>{bands.green}</span>
          <span
            className={`${styles.bandDot} ${styles.bandSpacer}`}
            style={{ background: 'var(--band-amber)' }}
          />
          <span className={styles.bandCount}>{bands.amber}</span>
          <span
            className={`${styles.bandDot} ${styles.bandSpacer}`}
            style={{ background: 'var(--band-red)' }}
          />
          <span className={styles.bandCount}>{bands.red}</span>
        </div>

        {onResetStats && (
          <button
            className={styles.resetButton}
            onClick={onResetStats}
            title="Reset all stats"
          >
            Reset
          </button>
        )}
      </div>
    </header>
  );
}
