/**
 * usePreflopStats — persistent preflop RFI stats hook backed by localStorage.
 *
 * Tracks: hands (total committed), correct count, current streak,
 * bestStreak. Derives accuracy (%) on read.
 *
 * Storage key: bluff-catcher:preflop:v1
 * Follows the same conventions as useStats.ts:
 *   - Lazy initialiser loads from localStorage.
 *   - useEffect persists on every state change.
 *   - Corrupt or missing data → default (all zeros).
 *   - Empty state → clears the key (no stale entries).
 *   - SSR guard (typeof window check).
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'bluff-catcher:preflop:v1';

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

function loadState(): PreflopStatsState {
  try {
    if (typeof window === 'undefined') return defaultState();
    const raw = localStorage.getItem(STORAGE_KEY);
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

function saveState(state: PreflopStatsState): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be disabled (private mode, etc.) — silently fail
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePreflopStats() {
  const [state, setState] = useState<PreflopStatsState>(() => loadState());

  // Persist on state change; clear key when returned to empty
  useEffect(() => {
    const isEmpty = state.hands === 0;
    if (isEmpty) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Silently fail
      }
    } else {
      saveState(state);
    }
  }, [state]);

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
