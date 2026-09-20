/**
 * useAppPrefs — the persisted root-level choices: which mode is running, which
 * stack tier the preflop trainer drills, and whether the odds drill names the
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
import { DEFAULT_DEPTH, DEPTHS, type Depth } from '../lib/preflop/ranges';

// ─── Mode ─────────────────────────────────────────────────────────────────────

export type AppMode = 'odds' | 'preflop';

export const MODE_KEY = 'bluff-catcher:mode:v1';
export const DEPTH_KEY = 'bluff-catcher:preflop-depth:v1';
export const SHOW_DRAW_KEY = 'bluff-catcher:show-draw:v1';

export function loadMode(): AppMode {
  try {
    if (typeof window === 'undefined') return 'odds';
    const raw = localStorage.getItem(MODE_KEY);
    if (raw === 'odds' || raw === 'preflop') return raw;
    return 'odds';
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
  /** Odds drill: name the draw before the guess is committed. */
  showDraw: boolean;
  setShowDraw: (next: boolean) => void;
}

export function useAppPrefs(): AppPrefs {
  const [mode, setModeState] = useState<AppMode>(() => loadMode());
  const [depth, setDepthState] = useState<Depth>(() => loadDepth());
  const [showDraw, setShowDrawState] = useState<boolean>(() => loadShowDraw());

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    saveMode(next);
  }, []);

  const setDepth = useCallback((next: Depth) => {
    setDepthState(next);
    saveDepth(next);
  }, []);

  const setShowDraw = useCallback((next: boolean) => {
    setShowDrawState(next);
    saveShowDraw(next);
  }, []);

  return { mode, setMode, depth, setDepth, showDraw, setShowDraw };
}
