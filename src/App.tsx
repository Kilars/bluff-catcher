/**
 * App — root shell. Holds mode state and routes to the active mode.
 *
 * mode: 'odds' | 'preflop'
 *   Persisted to localStorage key bluff-catcher:mode:v1.
 *   Default 'odds' on first load or corrupt value.
 *
 * depth: 'deep' | 'mid' | 'short'   (40bb+ / 20bb / 10bb jam)
 *   The stack tier the preflop trainer drills. Persisted to
 *   bluff-catcher:preflop-depth:v1, default 'deep'. Lives here rather than in
 *   PreflopTrainer because the header menu owns the switch and the standalone
 *   range browser opens on the same tier.
 *
 * Structure (odds mode):
 *   <div.frame>
 *     <Header>   ← shared, with hamburger menu + odds stats
 *     <OddsTrainer>  ← Table + Dock + ExplainSheet (no inner frame)
 *   </div.frame>
 *
 * Structure (preflop mode):
 *   <div.frame>
 *     <Header>   ← shared, with hamburger menu (stats slot reserved for P3)
 *     <preflop placeholder>
 *   </div.frame>
 */

import { useCallback, useEffect, useState } from 'react';
import { useStats } from './hooks/useStats';
import { usePreflopStats } from './hooks/usePreflopStats';
import Header from './components/Header';
import RangeSheet from './components/RangeSheet';
import { DEFAULT_DEPTH, DEPTHS, type Depth } from './lib/preflop/ranges';
import OddsTrainer from './modes/OddsTrainer';
import PreflopTrainer from './modes/PreflopTrainer';
import styles from './App.module.css';

// ─── Mode type ────────────────────────────────────────────────────────────────

export type AppMode = 'odds' | 'preflop';

// ─── Mode persistence ─────────────────────────────────────────────────────────

const MODE_KEY = 'bluff-catcher:mode:v1';

function loadMode(): AppMode {
  try {
    if (typeof window === 'undefined') return 'odds';
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === 'odds' || raw === 'preflop') return raw;
    return 'odds';
  } catch {
    return 'odds';
  }
}

function saveMode(mode: AppMode): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // localStorage might be disabled — silently fail
  }
}

// ─── Stack-depth persistence ──────────────────────────────────────────────────

const DEPTH_KEY = 'bluff-catcher:preflop-depth:v1';

function loadDepth(): Depth {
  try {
    if (typeof window === 'undefined') return DEFAULT_DEPTH;
    const raw = localStorage.getItem(DEPTH_KEY);
    return (DEPTHS as readonly string[]).includes(raw ?? '')
      ? (raw as Depth)
      : DEFAULT_DEPTH;
  } catch {
    return DEFAULT_DEPTH;
  }
}

function saveDepth(depth: Depth): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DEPTH_KEY, depth);
  } catch {
    // localStorage might be disabled — silently fail
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState<AppMode>(() => loadMode());
  const [depth, setDepth] = useState<Depth>(() => loadDepth());

  // Standalone RFI range-chart browser, opened from the header menu.
  // Independent of the trainer's own range sheet: it always opens on UTG and
  // is browsable from any mode, without a hand in play.
  const [rangesOpen, setRangesOpen] = useState(false);
  const stats = useStats();
  const preflopStats = usePreflopStats();

  const handleModeChange = useCallback((next: AppMode) => {
    setMode(next);
    saveMode(next);
  }, []);

  const handleDepthChange = useCallback((next: Depth) => {
    setDepth(next);
    saveDepth(next);
  }, []);

  // ── Phone felt scale ──────────────────────────────────────────────────────
  // The felt (both modes) is a fixed 820 px design; on phone it is scaled to
  // fit the viewport via CSS transform.  CSS calc cannot divide length by
  // length to produce a unitless scale factor, so we compute the ratio in JS
  // and expose it as --felt-scale on :root.  Both Table and PreflopTable
  // consume it.  Runs once here so it covers both modes (not per-mode).
  useEffect(() => {
    const setScale = () => {
      const scale = Math.min(1, (window.innerWidth * 0.96) / 820);
      document.documentElement.style.setProperty('--felt-scale', String(scale));
    };
    setScale();
    window.addEventListener('resize', setScale);
    return () => window.removeEventListener('resize', setScale);
  }, []);

  return (
    <div className={styles.frame}>
      <Header
        mode={mode}
        onModeChange={handleModeChange}
        depth={depth}
        onDepthChange={handleDepthChange}
        onOpenRanges={() => setRangesOpen(true)}
        oddsStats={
          mode === 'odds'
            ? {
                hands: stats.hands,
                streak: stats.streak,
                errors: stats.errors,
                bands: stats.bands,
                onResetStats: stats.reset,
              }
            : undefined
        }
        preflopStats={
          mode === 'preflop'
            ? {
                hands: preflopStats.hands,
                streak: preflopStats.streak,
                accuracy: preflopStats.accuracy,
                onResetStats: preflopStats.reset,
              }
            : undefined
        }
      />

      {mode === 'odds' && <OddsTrainer stats={stats} />}

      {/* key={depth}: changing tier re-deals and re-shows the briefing, rather
          than leaving a 40bb+ spot on screen labelled 10bb. */}
      {mode === 'preflop' && (
        <PreflopTrainer
          key={depth}
          depth={depth}
          onRecord={preflopStats.record}
          keysSuspended={rangesOpen}
        />
      )}

      {rangesOpen && (
        <RangeSheet
          position="UTG"
          depth={depth}
          onClose={() => setRangesOpen(false)}
        />
      )}
    </div>
  );
}
