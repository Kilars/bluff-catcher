/**
 * useAppPrefs — the persisted root-level choices: which mode is running, which
 * stack tier the preflop trainer drills, tournament or cash for both preflop drills, and whether the odds drill names the
 * draw before you guess.
 *
 * Both used to live as module-local helpers inside App.tsx. That was fine until
 * DECISIONS.md gained the rule that all state and persistence live in shared
 * hooks, and it had one concrete cost before that: `useMode.test.ts` could not
 * import loadMode/saveMode, so it *re-implemented* them and asserted against
 * the copy. A regression in App's real helpers would not have failed it.
 *
 * Keys are versioned (`:v1`) so a future shape change can be migrated rather
 * than silently misread.
 *
 * Every access is wrapped: localStorage throws, not just returns null, in
 * Safari private mode and wherever site data is blocked. A drill that cannot
 * remember your tier is a small loss; one that will not start is a total one.
 */

import { useCallback, useState } from 'react';
import { DEFAULT_DEPTH, DEPTHS, FORMATS, type Depth, type Format } from '../lib/preflop/ranges';
import { FACING_MODES, bucketsForMode, hasOpponentsRead, type FacingMode } from '../lib/preflop/facing';
import { DEFAULT_PREFLOP_STATS_KEY, mergeStatsKeys } from './usePreflopStats';
import { OPPONENTS, type Opponents } from '../lib/preflop/lowStakes';

// ─── Mode ─────────────────────────────────────────────────────────────────────

export type AppMode = 'odds' | 'preflop' | FacingMode;

/** Every valid mode, in menu order. Same list `loadMode` validates against. */
export const MODES: readonly AppMode[] = ['odds', 'preflop', ...FACING_MODES];

/** Each mode's name in menus and sheet subtitles. */
export const MODE_LABEL: Record<AppMode, string> = {
  odds: 'Odds',
  preflop: 'Open',
  threebet: '3-bet',
  fourbet: '4-bet',
  blinds: 'Blinds',
};

/** The menu's sections, in order (docs/PLAN-menu.md). */
export const MODE_SECTIONS: readonly { label: string; modes: readonly AppMode[] }[] = [
  { label: 'Postflop', modes: ['odds'] },
  { label: 'Preflop', modes: ['preflop', ...FACING_MODES] },
];

/** Whether a mode runs the facing drill (everything but odds and RFI). */
export function isFacingMode(mode: AppMode): mode is FacingMode {
  return (FACING_MODES as readonly string[]).includes(mode);
}

/** Whether a mode follows the tournament/cash switch. Odds has no format. */
export function hasFormatChoice(mode: AppMode): boolean {
  return mode !== 'odds';
}

/**
 * Stats keys per mode and format. RFI's tournament key predates the format
 * (it is usePreflopStats' default); cash stats never mix with tournament ones.
 */
export const STATS_KEY: Record<Exclude<AppMode, 'odds'>, Record<Format, string>> = {
  preflop: { mtt: DEFAULT_PREFLOP_STATS_KEY, cash: 'bluff-catcher:preflop-cash:v1' },
  threebet: { mtt: 'bluff-catcher:threebet:v1', cash: 'bluff-catcher:threebet-cash:v1' },
  fourbet: { mtt: 'bluff-catcher:fourbet:v1', cash: 'bluff-catcher:fourbet-cash:v1' },
  blinds: { mtt: 'bluff-catcher:blinds:v1', cash: 'bluff-catcher:blinds-cash:v1' },
};

// ─── Before the menu cleanup ──────────────────────────────────────────────────
//
// Five drills became three modes (docs/PLAN-menu.md). Old ids and stats are
// read forward, never deleted: phones keep localStorage for a long time.

/** The mode each retired mode id now opens. */
export const LEGACY_MODE: Record<string, AppMode> = {
  facing: 'threebet',
  seatvsopen: 'threebet',
  btn4bet: 'fourbet',
  open4bet: 'fourbet',
  bbdefend: 'blinds',
};

/**
 * The retired stats keys each new key sums. Seat vs open cannot be split
 * between 3-bet and Blinds, so all of it goes to 3-bet. Open vs 3-bet was cash
 * only, under one key.
 */
export const LEGACY_STATS: Record<string, readonly string[]> = {
  [STATS_KEY.threebet.mtt]: ['bluff-catcher:facing:v1', 'bluff-catcher:seatvsopen:v1'],
  [STATS_KEY.threebet.cash]: ['bluff-catcher:facing-cash:v1', 'bluff-catcher:seatvsopen-cash:v1'],
  [STATS_KEY.fourbet.mtt]: ['bluff-catcher:btn4bet:v1'],
  [STATS_KEY.fourbet.cash]: ['bluff-catcher:btn4bet-cash:v1', 'bluff-catcher:open4bet:v1'],
  [STATS_KEY.blinds.mtt]: ['bluff-catcher:bbdefend:v1'],
  [STATS_KEY.blinds.cash]: ['bluff-catcher:bbdefend-cash:v1'],
};

/** Set once the stats are folded, so a reset of a new mode does not bring them back. */
export const STATS_MIGRATED_KEY = 'bluff-catcher:stats-migrated:menu-v1';

/** Fold the retired drills' stats into the new modes, once. Call before the stats hooks mount. */
export function migrateLegacyStats(): void {
  try {
    if (typeof window === 'undefined' || localStorage.getItem(STATS_MIGRATED_KEY)) return;
    for (const [target, sources] of Object.entries(LEGACY_STATS)) mergeStatsKeys(target, sources);
    localStorage.setItem(STATS_MIGRATED_KEY, '1');
  } catch {
    // localStorage might be disabled — nothing to migrate
  }
}

export const MODE_KEY = 'bluff-catcher:mode:v1';
export const DEPTH_KEY = 'bluff-catcher:preflop-depth:v1';
export const SHOW_DRAW_KEY = 'bluff-catcher:show-draw:v1';
export const FORMAT_KEY = 'bluff-catcher:format:v1';
export const OPPONENTS_KEY = 'bluff-catcher:opponents:v1';

export function loadMode(): AppMode {
  try {
    if (typeof window === 'undefined') return 'odds';
    const raw = localStorage.getItem(MODE_KEY) ?? '';
    if ((MODES as readonly string[]).includes(raw)) return raw as AppMode;
    return LEGACY_MODE[raw] ?? 'odds';
  } catch {
    return 'odds';
  }
}

export function saveMode(mode: AppMode): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // localStorage might be disabled — silently fail
  }
}

// ─── Stack depth ──────────────────────────────────────────────────────────────

export function loadDepth(): Depth {
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

export function saveDepth(depth: Depth): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(DEPTH_KEY, depth);
  } catch {
    // localStorage might be disabled — silently fail
  }
}

// ─── Format ───────────────────────────────────────────────────────────────────
//
// Tournament or cash, for both preflop drills (docs/PLAN-cash.md). Default
// 'mtt', so nobody's app changes until they flip it. Kept apart from `depth`
// rather than folded into it: a stored tier survives a spell in cash and comes
// back on the return to tournament.

export function loadFormat(): Format {
  try {
    if (typeof window === 'undefined') return 'mtt';
    const raw = localStorage.getItem(FORMAT_KEY);
    return (FORMATS as readonly string[]).includes(raw ?? '') ? (raw as Format) : 'mtt';
  } catch {
    return 'mtt';
  }
}

export function saveFormat(format: Format): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FORMAT_KEY, format);
  } catch {
    // localStorage might be disabled — silently fail
  }
}

// ─── Opponents ────────────────────────────────────────────────────────────────
//
// Who the cash 4-bet drills assume is across the table (lib/preflop/lowStakes.ts).
// Default 'low': a low-stakes pool's 5-bet jam is value only, so fewer value
// 4-bets call it. 'balanced' is the source chart as solved.

/**
 * Whether a mode offers the opponents choice: only where one of its charts
 * has a low-stakes read (the cash 4-bets, where it changes which 4-bets call
 * a 5-bet jam).
 */
export function hasOpponentsChoice(mode: AppMode, format: Format): boolean {
  return isFacingMode(mode) && bucketsForMode(format, mode).some(hasOpponentsRead);
}

export function loadOpponents(): Opponents {
  try {
    if (typeof window === 'undefined') return 'low';
    const raw = localStorage.getItem(OPPONENTS_KEY);
    return (OPPONENTS as readonly string[]).includes(raw ?? '') ? (raw as Opponents) : 'low';
  } catch {
    return 'low';
  }
}

export function saveOpponents(opponents: Opponents): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(OPPONENTS_KEY, opponents);
  } catch {
    // localStorage might be disabled — silently fail
  }
}

// ─── Show the draw ────────────────────────────────────────────────────────────
//
// Default ON. You cannot practise counting outs for a draw you have not
// identified, and the drill asks for one number over a board you have three
// seconds to read — so naming the draw up front is the training default, not
// the assist. Turning it off is the harder drill (identify it yourself, then
// price it), which is why the toggle exists at all: it is the thing you switch
// off once you no longer need it. See DECISIONS.md, "Naming the draw".

export function loadShowDraw(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    const raw = localStorage.getItem(SHOW_DRAW_KEY);
    // Only an explicit 'off' hides it: an absent or corrupt value means a
    // first run, and a first run gets the default.
    return raw !== 'off';
  } catch {
    return true;
  }
}

export function saveShowDraw(showDraw: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SHOW_DRAW_KEY, showDraw ? 'on' : 'off');
  } catch {
    // localStorage might be disabled — silently fail
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface AppPrefs {
  mode: AppMode;
  setMode: (next: AppMode) => void;
  depth: Depth;
  setDepth: (next: Depth) => void;
  /** Preflop drills: tournament or cash. */
  format: Format;
  setFormat: (next: Format) => void;
  /** Cash 4-bet drills: a low-stakes pool or the solver's balanced player. */
  opponents: Opponents;
  setOpponents: (next: Opponents) => void;
  /** Odds drill: name the draw before the guess is committed. */
  showDraw: boolean;
  setShowDraw: (next: boolean) => void;
}

export function useAppPrefs(): AppPrefs {
  const [mode, setModeState] = useState<AppMode>(() => loadMode());
  const [depth, setDepthState] = useState<Depth>(() => loadDepth());
  const [format, setFormatState] = useState<Format>(() => loadFormat());
  const [opponents, setOpponentsState] = useState<Opponents>(() => loadOpponents());
  const [showDraw, setShowDrawState] = useState<boolean>(() => loadShowDraw());

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    saveMode(next);
  }, []);

  const setDepth = useCallback((next: Depth) => {
    setDepthState(next);
    saveDepth(next);
  }, []);

  const setFormat = useCallback((next: Format) => {
    setFormatState(next);
    saveFormat(next);
  }, []);

  const setOpponents = useCallback((next: Opponents) => {
    setOpponentsState(next);
    saveOpponents(next);
  }, []);

  const setShowDraw = useCallback((next: boolean) => {
    setShowDrawState(next);
    saveShowDraw(next);
  }, []);

  return {
    mode,
    setMode,
    depth,
    setDepth,
    format,
    setFormat,
    opponents,
    setOpponents,
    showDraw,
    setShowDraw,
  };
}
