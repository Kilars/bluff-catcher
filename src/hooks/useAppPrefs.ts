/**
 * useAppPrefs — the two persisted root-level choices: which mode is running,
 * and which stack tier the preflop trainer drills.
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface AppPrefs {
  mode: AppMode;
  setMode: (next: AppMode) => void;
  depth: Depth;
  setDepth: (next: Depth) => void;
}

export function useAppPrefs(): AppPrefs {
  const [mode, setModeState] = useState<AppMode>(() => loadMode());
  const [depth, setDepthState] = useState<Depth>(() => loadDepth());

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    saveMode(next);
  }, []);

  const setDepth = useCallback((next: Depth) => {
    setDepthState(next);
    saveDepth(next);
  }, []);

  return { mode, setMode, depth, setDepth };
}
