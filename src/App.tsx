/**
 * App — root shell. Holds mode state and routes to the active mode.
 *
 * mode: 'odds' | 'preflop' | 'facing'
 *   Persisted to localStorage key bluff-catcher:mode:v1.
 *   Default 'odds' on first load or corrupt value.
 *
 * depth: 'deep' | 'mid' | 'short'   (60bb+ / 20bb / 10bb jam)
 *   The stack tier the preflop trainer drills. Persisted to
 *   bluff-catcher:preflop-depth:v1, default 'deep'. Lives here rather than in
 *   PreflopTrainer because the header menu owns the switch and the standalone
 *   range browser opens on the same tier. Facing mode has no depth picker (its
 *   source chart is one span, 50bb+ — see docs/PLAN-3bet.md, "Depth caveat"),
 *   so this is simply unused while mode === 'facing'.
 *
 * format: 'mtt' | 'cash'   (docs/PLAN-cash.md)
 *   Tournament or cash, for both preflop drills. Persisted to
 *   bluff-catcher:format:v1, default 'mtt'. With `depth` it resolves to one
 *   `chartKey` ('deep' | 'mid' | 'short' | 'cash'); cash keeps the stored tier
 *   for the return to tournament.
 *
 * Structure (odds mode):
 *   <div.frame>
 *     <Header>   ← shared, with hamburger menu + odds stats
 *     <OddsTrainer>  ← Table + Dock + ExplainSheet (no inner frame)
 *   </div.frame>
 *
 * Structure (preflop / facing mode):
 *   <div.frame>
 *     <Header>   ← shared, with hamburger menu + that mode's own stats
 *     <PreflopTrainer> / <FacingTrainer>
 *   </div.frame>
 *
 * RFI and facing share `usePreflopStats()` — same shape (hands/streak/accuracy)
 * — as separate instances per drill and per format, each with its own storage
 * key, so no numbers ever mix. See `STATS_KEY` below.
 *
 * layout: 'phone' | 'compact' | 'desktop'
 *   From useLayoutMode(), which is the app's only viewport read and publishes
 *   its answer as data-layout on <html> for the stylesheets. App consumes it for
 *   one thing: the --ui-scale / --felt-scale arithmetic below is desktop-tree
 *   work and must not run on a phone. See src/lib/breakpoints.ts.
 */

import { useEffect, useState } from 'react';
import { useLayoutMode } from './hooks/useLayoutMode';
import { useStats } from './hooks/useStats';
import { usePreflopStats } from './hooks/usePreflopStats';
import Header from './components/Header';
import RangeSheet from './components/RangeSheet';
import { CHART_META, chartKeyFor, type Format } from './lib/preflop/ranges';
import { FACING_CHIP_LABEL } from './lib/facingMeta';
import { useAppPrefs } from './hooks/useAppPrefs';
import PhoneTopBar from './components/phone/PhoneTopBar';
import PhoneMenuSheet from './components/phone/PhoneMenuSheet';
import PhoneStatsPill, { type PhoneStatsPillProps } from './components/phone/PhoneStatsPill';
import PhoneStatsSheet from './components/phone/PhoneStatsSheet';
import PhoneSheet from './components/phone/PhoneSheet';
import PhoneRangeView from './components/phone/range/PhoneRangeView';
import OddsTrainer from './modes/OddsTrainer';
import PreflopTrainer from './modes/PreflopTrainer';
import FacingTrainer from './modes/FacingTrainer';
import styles from './App.module.css';

/**
 * Stats keys per drill and format. RFI's tournament key predates the format
 * (it is usePreflopStats' default); cash stats never mix with tournament ones.
 */
const STATS_KEY = {
  preflop: { mtt: 'bluff-catcher:preflop:v1', cash: 'bluff-catcher:preflop-cash:v1' },
  facing: { mtt: 'bluff-catcher:facing:v1', cash: 'bluff-catcher:facing-cash:v1' },
} as const;

/** The context-chip / brand-sub label for each mode, so no call site special-cases 'odds'. */
function contextLabelFor(
  mode: ReturnType<typeof useAppPrefs>['mode'],
  depthLabel: string,
  format: Format
): string {
  switch (mode) {
    case 'odds':
      return 'Odds';
    case 'preflop':
      return depthLabel;
    case 'facing':
      return FACING_CHIP_LABEL[format];
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
  const { mode, setMode, depth, setDepth, format, setFormat, showDraw, setShowDraw } =
    useAppPrefs();
  // The RFI chart in play: the stored tier, or 'cash' (which ignores the tier
  // but keeps it for the return to tournament).
  const chartKey = chartKeyFor(format, depth);

  // Which component tree we are. Also stamps data-layout on <html>, which is
  // what every stylesheet keys off — see useLayoutMode for why this is a
  // matchMedia subscription and not a resize listener.
  const layout = useLayoutMode();

  // Standalone RFI range-chart browser, opened from the header menu.
  // Independent of the trainer's own range sheet: it opens on the first seat
  // of the chart in play and is browsable from any mode, without a hand in play.
  const [rangesOpen, setRangesOpen] = useState(false);

  // Which phone chrome overlay is up, if any. One at a time: the top bar has
  // three entry points (context chip, stats pill, ⋯) and they all land in a
  // full-screen sheet, so a single slot is the whole state machine.
  const [phoneSheet, setPhoneSheet] = useState<'menu' | 'context' | 'stats' | null>(null);
  const stats = useStats();
  // One instance per drill × format, picked below. Four instances rather than
  // one with a changing key: usePreflopStats reads storage only on mount, so
  // switching one instance's key would copy the tournament numbers into the
  // cash key on its next save.
  const preflopStatsByFormat = {
    mtt: usePreflopStats(STATS_KEY.preflop.mtt),
    cash: usePreflopStats(STATS_KEY.preflop.cash),
  };
  const facingStatsByFormat = {
    mtt: usePreflopStats(STATS_KEY.facing.mtt),
    cash: usePreflopStats(STATS_KEY.facing.cash),
  };
  const preflopStats = preflopStatsByFormat[format];
  const facingStats = facingStatsByFormat[format];

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

  const isPhone = layout === 'phone';

  // The drill keys (F/J/R/I/Space) must go inert behind any full-screen
  // overlay, not just the range browser — on phone the chrome sheets cover the
  // felt completely.
  const keysSuspended = rangesOpen || phoneSheet !== null;

  // RFI and facing share a stats shape (hands / streak / accuracy), so the
  // phone chrome only has to tell odds apart from "an accuracy drill".
  const accuracyStats = mode === 'facing' ? facingStats : preflopStats;
  const resetActiveStats = mode === 'odds' ? stats.reset : accuracyStats.reset;

  const phoneStats: PhoneStatsPillProps =
    mode === 'odds'
      ? { mode, streak: stats.streak, bands: stats.bands, onPress: () => setPhoneSheet('stats') }
      : {
          mode,
          streak: accuracyStats.streak,
          accuracy: accuracyStats.accuracy,
          hands: accuracyStats.hands,
          onPress: () => setPhoneSheet('stats'),
        };

  const phoneStatsSheet =
    mode === 'odds'
      ? ({
          mode,
          hands: stats.hands,
          streak: stats.streak,
          bestStreak: stats.bestStreak,
          errors: stats.errors,
          bands: stats.bands,
          perCategory: stats.perCategory,
        } as const)
      : ({
          mode,
          hands: accuracyStats.hands,
          correct: accuracyStats.correct,
          streak: accuracyStats.streak,
          bestStreak: accuracyStats.bestStreak,
          accuracy: accuracyStats.accuracy,
        } as const);

  return (
    <div className={styles.frame}>
      {isPhone ? (
        <PhoneTopBar
          contextLabel={contextLabelFor(mode, CHART_META[chartKey].label, format)}
          onOpenContext={() => setPhoneSheet('context')}
          onOpenMenu={() => setPhoneSheet('menu')}
          stats={<PhoneStatsPill {...phoneStats} />}
        />
      ) : (
      <Header
        mode={mode}
        onModeChange={setMode}
        depth={depth}
        onDepthChange={setDepth}
        format={format}
        onFormatChange={setFormat}
        showDraw={showDraw}
        onShowDrawChange={setShowDraw}
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
        facingStats={
          mode === 'facing'
            ? {
                hands: facingStats.hands,
                streak: facingStats.streak,
                accuracy: facingStats.accuracy,
                onResetStats: facingStats.reset,
              }
            : undefined
        }
      />
      )}

      {mode === 'odds' && <OddsTrainer stats={stats} showDraw={showDraw} />}

      {/* key={chartKey}: changing tier or format re-deals and re-shows the
          briefing, rather than leaving a 60bb+ spot on screen labelled 10bb. */}
      {mode === 'preflop' && (
        <PreflopTrainer
          key={chartKey}
          depth={chartKey}
          onRecord={preflopStats.record}
          keysSuspended={keysSuspended}
        />
      )}

      {mode === 'facing' && (
        <FacingTrainer
          key={format}
          format={format}
          stats={facingStats}
          keysSuspended={keysSuspended}
        />
      )}

      {/* The standalone chart browser. Unlike the trainer's own range sheet
          this one IS tier-switchable — there is no hand in play for it to
          disagree with, so browsing 60bb+ → 10bb on one seat is the point. */}
      {rangesOpen &&
        (isPhone ? (
          <PhoneSheet title="RFI range charts" onClose={() => setRangesOpen(false)}>
            <PhoneRangeView
              position={CHART_META[chartKey].seats[0]}
              depth={chartKey}
              depthSwitchable
            />
          </PhoneSheet>
        ) : (
          <RangeSheet
            position={CHART_META[chartKey].seats[0]}
            depth={chartKey}
            onClose={() => setRangesOpen(false)}
          />
        ))}

      {isPhone && phoneSheet !== null && phoneSheet !== 'stats' && (
        <PhoneMenuSheet
          title={phoneSheet === 'context' ? 'Mode & format' : 'Menu'}
          mode={mode}
          onModeChange={setMode}
          depth={depth}
          onDepthChange={setDepth}
          format={format}
          onFormatChange={setFormat}
          showDraw={showDraw}
          onShowDrawChange={setShowDraw}
          onOpenRanges={() => {
            setPhoneSheet(null);
            setRangesOpen(true);
          }}
          onResetStats={resetActiveStats}
          onClose={() => setPhoneSheet(null)}
        />
      )}

      {isPhone && phoneSheet === 'stats' && (
        <PhoneStatsSheet
          {...phoneStatsSheet}
          onReset={resetActiveStats}
          onClose={() => setPhoneSheet(null)}
        />
      )}
    </div>
  );
}
