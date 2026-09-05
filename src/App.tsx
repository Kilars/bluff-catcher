/**
 * App — root shell. Holds mode state and routes to the active mode.
 *
 * mode: 'odds' | 'preflop'
 *   Persisted to localStorage key bluff-catcher:mode:v1.
 *   Default 'odds' on first load or corrupt value.
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState<AppMode>(() => loadMode());
  const stats = useStats();
  const preflopStats = usePreflopStats();

  const handleModeChange = useCallback((next: AppMode) => {
    setMode(next);
    saveMode(next);
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

      {mode === 'preflop' && (
        <PreflopTrainer onRecord={preflopStats.record} />
      )}
    </div>
  );
}
