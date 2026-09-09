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

// ─── Viewport scaling constants ───────────────────────────────────────────────

/** Below this the layout reflows into the phone column (see App.module.css). */
const PHONE_MAX_WIDTH = 820;
/** The canvas the desktop layout was designed against. */
const DESIGN_WIDTH = 1280;
const DESIGN_HEIGHT = 860;
/** Fixed chrome heights, in logical px (Header.module.css / Dock.module.css). */
const HEADER_HEIGHT = 54;
const DOCK_HEIGHT = 226;
/** Felt is 820 × 380; hero cards overhang 32 px, and it wants breathing room. */
const FELT_WIDTH = 820;
const FELT_BLOCK_HEIGHT = 500;
/** Past this the UI is simply large, not more readable. */
const MAX_UI_SCALE = 1.6;
const MAX_FELT_SCALE = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

  // ── Viewport scaling ──────────────────────────────────────────────────────
  // Two unitless factors, both computed here because CSS calc cannot divide a
  // length by a length to produce a plain number:
  //
  //   --ui-scale    how much the whole frame is magnified (App.module.css).
  //                 The frame is laid out at viewport / ui-scale and then
  //                 transform-scaled back up, so a large monitor gets a large
  //                 UI while the layout itself stays fluid. 1 on phone.
  //   --felt-scale  how much the 820 × 380 felt is scaled inside the table
  //                 region — down to fit a phone, up to claim the leftover
  //                 desktop height. Consumed by Table and PreflopTable.
  //
  // Runs once here so it covers both modes (not per-mode).
  useEffect(() => {
    const setScale = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const root = document.documentElement.style;

      if (w <= PHONE_MAX_WIDTH) {
        root.setProperty('--ui-scale', '1');
        root.setProperty('--felt-scale', String(Math.min(1, (w * 0.96) / FELT_WIDTH)));
        return;
      }

      // Never shrink the chrome below the design size; cap the magnification so
      // a 4K panel does not end up with 40 px body text.
      const ui = clamp(Math.min(w / DESIGN_WIDTH, h / DESIGN_HEIGHT), 1, MAX_UI_SCALE);
      const logicalW = w / ui;
      const logicalH = h / ui;

      // Height left for the felt once header and dock have taken their cut.
      const feltRegionH = logicalH - HEADER_HEIGHT - DOCK_HEIGHT;
      const felt = clamp(
        Math.min((logicalW - 64) / FELT_WIDTH, feltRegionH / FELT_BLOCK_HEIGHT),
        0.4,
        MAX_FELT_SCALE
      );

      root.setProperty('--ui-scale', ui.toFixed(4));
      root.setProperty('--felt-scale', felt.toFixed(4));
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
