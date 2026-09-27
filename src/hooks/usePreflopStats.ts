/**
 * usePreflopStats — persistent preflop RFI stats hook backed by localStorage.
 *
 * Tracks: hands (total committed), correct count, current streak,
 * bestStreak. Derives accuracy (%) on read.
 *
 * Storage key: bluff-catcher:preflop:v1 by default.
 * Follows the same conventions as useStats.ts:
 *   - Lazy initialiser loads from localStorage.
 *   - useEffect persists on every state change.
 *   - Corrupt or missing data → default (all zeros).
 *   - Empty state → clears the key (no stale entries).
 *   - SSR guard (typeof window check).
 *
 * The storage key is a parameter, defaulting to the RFI key above, so a second
 * caller (the facing-open drill, `bluff-catcher:facing:v1`) gets its own
 * isolated instance of the same shape without touching RFI's stats.
 */

import { useState, useEffect } from 'react';

export const DEFAULT_PREFLOP_STATS_KEY = 'bluff-catcher:preflop:v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreflopStatsState {
  hands: number;
  correct: number;
  streak: number;
  bestStreak: number;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultState(): PreflopStatsState {
  return { hands: 0, correct: 0, streak: 0, bestStreak: 0 };
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadState(storageKey: string): PreflopStatsState {
  try {
    if (typeof window === 'undefined') return defaultState();
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as PreflopStatsState;
    // Basic shape validation — corrupt data falls through to default
    if (
      typeof parsed.hands !== 'number' ||
      typeof parsed.correct !== 'number' ||
      typeof parsed.streak !== 'number' ||
      typeof parsed.bestStreak !== 'number'
    ) {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState(storageKey: string, state: PreflopStatsState): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // localStorage might be disabled (private mode, etc.) — silently fail
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param storageKey Which localStorage key this instance reads/writes.
 *   Defaults to the RFI key so existing callers, and existing saved stats, are
 *   untouched. Pass a different key (e.g. `bluff-catcher:facing:v1`) to get a
 *   second, isolated instance of the same shape for another mode.
 */
export function usePreflopStats(storageKey: string = DEFAULT_PREFLOP_STATS_KEY) {
  const [state, setState] = useState<PreflopStatsState>(() => loadState(storageKey));

  // Persist on state change; clear key when returned to empty
  useEffect(() => {
    const isEmpty = state.hands === 0;
    if (isEmpty) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // Silently fail
      }
    } else {
      saveState(storageKey, state);
    }
  }, [state, storageKey]);

  // ── record(wasCorrect) ────────────────────────────────────────────────────

  const record = (wasCorrect: boolean) => {
    setState((prev) => {
      const newStreak = wasCorrect ? prev.streak + 1 : 0;
      return {
        hands: prev.hands + 1,
        correct: prev.correct + (wasCorrect ? 1 : 0),
        streak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
      };
    });
  };

  // ── reset() ───────────────────────────────────────────────────────────────

  const reset = () => {
    setState(defaultState());
  };

  // ── Derived: accuracy % ───────────────────────────────────────────────────

  const accuracy = state.hands === 0 ? 0 : (state.correct / state.hands) * 100;

  return {
    hands: state.hands,
    correct: state.correct,
    streak: state.streak,
    bestStreak: state.bestStreak,
    accuracy,
    record,
    reset,
  };
}
