/**
 * Header — brand + hamburger menu + mode-specific stats slot.
 * 54px fixed, 1px bottom divider.
 *
 * The left side now hosts the Menu (hamburger) beside the brand.
 * The right-side content slot is mode-aware:
 *   mode='odds'    → shows odds stat pairs
 *   mode='preflop' → shows preflop RFI stat pairs (hands/streak/accuracy)
 *   mode='facing' / 'bbdefend' → that drill's stat pairs, same shape as
 *                    preflop's, fed through `facingStats` from the drill's
 *                    own `usePreflopStats()` instance
 *
 * Every mode branch below is a `switch`/lookup on `mode`, deliberately, rather
 * than a two-way `mode === 'odds' ? … : …` check — the latter silently treats
 * 'facing' as 'preflop' (see docs/PLAN-3bet.md, phase F2).
 */

import Menu from './Menu';
import { FACING_DRILL_OF, type AppMode } from '../hooks/useAppPrefs';
import { CHART_META, chartKeyFor, type Depth, type Format } from '../lib/preflop/ranges';
import type { Opponents } from '../lib/preflop/lowStakes';
import { BB_CONTEXT_LABEL, BTN4_CONTEXT_LABEL, FACING_CONTEXT_LABEL, OPEN4_CONTEXT_LABEL } from '../lib/facingMeta';
import styles from './Header.module.css';

interface OddsStatsProps {
  hands: number;
  streak: number;
  errors: number[];
  bands: { green: number; amber: number; red: number };
  onResetStats?: () => void;
}

/** Same shape for the preflop RFI drill and the facing-open drill. */
interface PreflopLikeStatsProps {
  hands: number;
  streak: number;
  accuracy: number;
  onResetStats?: () => void;
}

interface HeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  /** Stack tier the preflop trainer is drilling; switched from the menu. */
  depth: Depth;
  onDepthChange: (depth: Depth) => void;
  /** Tournament or cash, for both preflop drills; switched from the menu. */
  format: Format;
  onFormatChange: (format: Format) => void;
  opponents: Opponents;
  onOpponentsChange: (opponents: Opponents) => void;
  /** Odds drill: name the draw before the commit. Toggled from the menu. */
  showDraw: boolean;
  onShowDrawChange: (next: boolean) => void;
  oddsStats?: OddsStatsProps;
  preflopStats?: PreflopLikeStatsProps;
  /** The active facing drill's stats (BTN or BB) — its own `usePreflopStats()` instance. */
  facingStats?: PreflopLikeStatsProps;
  /** Opens the standalone RFI range-chart browser from the menu. */
  onOpenRanges: () => void;
}

function brandSub(mode: AppMode, depth: Depth, format: Format): string {
  switch (mode) {
    case 'odds':
      return 'Odds trainer';
    case 'preflop':
      return `Preflop RFI · ${CHART_META[chartKeyFor(format, depth)].label}`;
    case 'facing':
      return `Facing open · ${FACING_CONTEXT_LABEL[format]}`;
    case 'bbdefend':
      return BB_CONTEXT_LABEL[format];
    case 'btn4bet':
      return BTN4_CONTEXT_LABEL[format];
    case 'open4bet':
      return OPEN4_CONTEXT_LABEL[format];
  }
}

export default function Header({
  mode,
  onModeChange,
  depth,
  onDepthChange,
  format,
  onFormatChange,
  opponents,
  onOpponentsChange,
  showDraw,
  onShowDrawChange,
  oddsStats,
  preflopStats,
  facingStats,
  onOpenRanges,
}: HeaderProps) {
  // 'preflop' and both facing drills render an identical stat block
  // (hands/streak/accuracy); this picks which props feed it.
  const isFacingDrill = FACING_DRILL_OF[mode] !== undefined;
  const preflopLikeStats = mode === 'preflop' ? preflopStats : isFacingDrill ? facingStats : undefined;
  const preflopLikeLabel =
    mode === 'bbdefend'
      ? 'BB defend'
      : mode === 'btn4bet' || mode === 'open4bet'
        ? 'vs 3-bet'
        : isFacingDrill
          ? 'facing'
          : 'preflop';
  const avgError =
    oddsStats && oddsStats.errors.length > 0
      ? `±${(oddsStats.errors.reduce((a, b) => a + b, 0) / oddsStats.errors.length).toFixed(1)}`
      : '—';

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Menu
          currentMode={mode}
          onModeChange={onModeChange}
          currentDepth={depth}
          onDepthChange={onDepthChange}
          currentFormat={format}
          onFormatChange={onFormatChange}
          opponents={opponents}
          onOpponentsChange={onOpponentsChange}
          showDraw={showDraw}
          onShowDrawChange={onShowDrawChange}
          onOpenRanges={onOpenRanges}
        />
        <div className={styles.brand}>
          <span className={styles.brandName}>RUNOUT</span>
          <span className={styles.brandSub}>{brandSub(mode, depth, format)}</span>
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
        {mode !== 'odds' && preflopLikeStats && (
          <>
            <div className={styles.statPair}>
              <span>Hands</span>
              <span className={styles.statValue}>{preflopLikeStats.hands}</span>
            </div>
            <div className={styles.statPair}>
              <span>Streak</span>
              <span className={styles.statValueAccent}>{preflopLikeStats.streak}</span>
            </div>
            <div className={styles.statPair}>
              <span>Accuracy</span>
              <span className={styles.statValue}>
                {preflopLikeStats.hands === 0 ? '—' : `${preflopLikeStats.accuracy.toFixed(0)}%`}
              </span>
            </div>
            {preflopLikeStats.onResetStats && (
              <button
                className={styles.resetButton}
                onClick={preflopLikeStats.onResetStats}
                title={`Reset ${preflopLikeLabel} stats`}
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
