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
 *
 * layout: 'phone' | 'compact' | 'desktop'
 *   From useLayoutMode(), which is the app's only viewport read and publishes
 *   its answer as data-layout on <html> for the stylesheets. App consumes it for
 *   one thing: the --ui-scale / --felt-scale arithmetic below is desktop-tree
 *   work and must not run on a phone. See src/lib/breakpoints.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLayoutMode } from './hooks/useLayoutMode';
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
//
// Every number below belongs to the *desktop* tree. There is deliberately no
// phone breakpoint here any more: which tree runs is useLayoutMode()'s single
// decision, and the widths behind it live in src/lib/breakpoints.ts.

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

  // Which component tree we are. Also stamps data-layout on <html>, which is
  // what every stylesheet keys off — see useLayoutMode for why this is a
  // matchMedia subscription and not a resize listener.
  const layout = useLayoutMode();

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

  // ── Viewport scaling — desktop tree only ──────────────────────────────────
  // Two unitless factors, both computed here because CSS calc cannot divide a
  // length by a length to produce a plain number:
  //
  //   --ui-scale    how much the whole frame is magnified (App.module.css).
  //                 The frame is laid out at viewport / ui-scale and then
  //                 transform-scaled back up, so a large monitor gets a large
  //                 UI while the layout itself stays fluid.
  //   --felt-scale  how much the 820 × 380 felt is scaled inside the table
  //                 region, to claim the leftover desktop height. Consumed by
  //                 Table and PreflopTable.
  //
  // Both belong to the desktop tree and only to it. The phone tree draws no
  // felt and carries no scale transform anywhere (PLAN-phone §4.2), so on
  // 'phone' this pins --ui-scale to 1, leaves --felt-scale to the constant in
  // App.module.css, and does not attach a listener at all — which is also what
  // keeps an iOS URL-bar scroll from running this arithmetic sixty times a
  // second on the device least able to afford it.
  //
  // The resize listener stays for the desktop branch: unlike the tree choice,
  // the scale genuinely is a continuous function of the viewport, and there is
  // no media query that returns a number.
  //
  // Runs once here so it covers both app modes (not per-mode).
  useEffect(() => {
    const root = document.documentElement.style;

    if (layout === 'phone') {
      root.setProperty('--ui-scale', '1');
      root.removeProperty('--felt-scale');
      return;
    }

    const setScale = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

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
  }, [layout]);

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
