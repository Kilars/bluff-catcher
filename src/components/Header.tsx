/**
 * Header — brand + hamburger menu + mode-specific stats slot.
 * 54px fixed, 1px bottom divider.
 *
 * The left side now hosts the Menu (hamburger) beside the brand.
 * The right-side content slot is mode-aware:
 *   mode='odds'    → shows odds stat pairs (as before)
 *   mode='preflop' → placeholder for Phase P3
 */

import Menu from './Menu';
import type { AppMode } from '../App';
import styles from './Header.module.css';

interface OddsStatsProps {
  hands: number;
  streak: number;
  errors: number[];
  bands: { green: number; amber: number; red: number };
  onResetStats?: () => void;
}

interface PreflopStatsProps {
  hands: number;
  streak: number;
  accuracy: number;
  onResetStats?: () => void;
}

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  oddsStats?: OddsStatsProps;
  preflopStats?: PreflopStatsProps;
}

export default function Header({ mode, onModeChange, oddsStats, preflopStats }: HeaderProps) {
  const avgError =
    oddsStats && oddsStats.errors.length > 0
      ? `±${(oddsStats.errors.reduce((a, b) => a + b, 0) / oddsStats.errors.length).toFixed(1)}`
      : '—';

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Menu currentMode={mode} onModeChange={onModeChange} />
        <div className={styles.brand}>
          <span className={styles.brandName}>RUNOUT</span>
          <span className={styles.brandSub}>
            {mode === 'odds' ? 'Odds trainer' : 'Preflop RFI'}
          </span>
        </div>
      </div>

      <div className={styles.right}>
        {mode === 'odds' && oddsStats && (
          <>
            <div className={styles.statPair}>
              <span>Hands</span>
              <span className={styles.statValue}>{oddsStats.hands}</span>
            </div>
            <div className={styles.statPair}>
              <span>Streak</span>
              <span className={styles.statValueAccent}>{oddsStats.streak}</span>
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
              <span className={styles.bandCount}>{oddsStats.bands.green}</span>
              <span
                className={`${styles.bandDot} ${styles.bandSpacer}`}
                style={{ background: 'var(--band-amber)' }}
              />
              <span className={styles.bandCount}>{oddsStats.bands.amber}</span>
              <span
                className={`${styles.bandDot} ${styles.bandSpacer}`}
                style={{ background: 'var(--band-red)' }}
              />
              <span className={styles.bandCount}>{oddsStats.bands.red}</span>
            </div>

            {oddsStats.onResetStats && (
              <button
                className={styles.resetButton}
                onClick={oddsStats.onResetStats}
                title="Reset all stats"
              >
                Reset
              </button>
            )}
          </>
        )}
        {mode === 'preflop' && preflopStats && (
          <>
            <div className={styles.statPair}>
              <span>Hands</span>
              <span className={styles.statValue}>{preflopStats.hands}</span>
            </div>
            <div className={styles.statPair}>
              <span>Streak</span>
              <span className={styles.statValueAccent}>{preflopStats.streak}</span>
            </div>
            <div className={styles.statPair}>
              <span>Accuracy</span>
              <span className={styles.statValue}>
                {preflopStats.hands === 0 ? '—' : `${preflopStats.accuracy.toFixed(0)}%`}
              </span>
            </div>
            {preflopStats.onResetStats && (
              <button
                className={styles.resetButton}
                onClick={preflopStats.onResetStats}
                title="Reset preflop stats"
              >
                Reset
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
