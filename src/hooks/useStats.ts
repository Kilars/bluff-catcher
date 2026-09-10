/**
 * useStats — persistent stats hook backed by localStorage.
 *
 * Manages hands, streak, errors, and per-category statistics,
 * persisting to localStorage:v1 on every mutation.
 */

import { useState, useEffect } from 'react';
import type { Band } from '../lib/band';

const STORAGE_KEY = 'bluff-catcher:stats:v1';

// ─── Types ────────────────────────────────────────────────────────────────

export interface Bands {
  green: number;
  amber: number;
  red: number;
}

export interface CategoryStat {
  n: number;
  errors: number[];
  bands: Bands;
}

export interface StatsState {
  totals: {
    hands: number;
    streak: number;
    bestStreak: number;
    errors: number[];
    bands: Bands;
  };
  perCategory: Record<string, CategoryStat>;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

function defaultStats(): StatsState {
  return {
    totals: {
      hands: 0,
      streak: 0,
      bestStreak: 0,
      errors: [],
      bands: { green: 0, amber: 0, red: 0 },
    },
    perCategory: {},
  };
}

// ─── localStorage helpers ──────────────────────────────────────────────────

function loadStats(): StatsState {
  try {
    if (typeof window === 'undefined') return defaultStats();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStats();
    const parsed = JSON.parse(raw) as StatsState;
    return parsed;
  } catch {
    // Corrupt or missing — start fresh
    return defaultStats();
  }
}

function saveStats(state: StatsState): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage might be disabled (private mode, etc.) — silently fail
  }
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useStats() {
  const [state, setState] = useState<StatsState>(() => loadStats());

  // Persist on state change (except during reset)
  useEffect(() => {
    // Only save if this is a non-empty state (hands > 0 or has perCategory entries)
    const isNonEmpty = state.totals.hands > 0 || Object.keys(state.perCategory).length > 0;
    if (isNonEmpty) {
      saveStats(state);
    } else {
      // If returning to empty state, clear localStorage
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Silently fail if localStorage is unavailable
      }
    }
  }, [state]);

  // ── record(delta, band, category) ──────────────────────────────────────

  const record = (delta: number, band: Band, category: string) => {
    setState((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as StatsState;

      // Update totals
      next.totals.hands += 1;
      next.totals.errors.push(delta);
      next.totals.bands[band] += 1;

      // Streak logic
      if (band === 'green') {
        next.totals.streak += 1;
      } else {
        next.totals.streak = 0;
      }
      next.totals.bestStreak = Math.max(next.totals.bestStreak, next.totals.streak);

      // Ensure category exists
      if (!next.perCategory[category]) {
        next.perCategory[category] = {
          n: 0,
          errors: [],
          bands: { green: 0, amber: 0, red: 0 },
        };
      }

      // Update per-category stats
      const cat = next.perCategory[category];
      cat.n += 1;
      cat.errors.push(delta);
      cat.bands[band] += 1;

      return next;
    });
  };

  // ── reset() ────────────────────────────────────────────────────────────

  const reset = () => {
    const freshStats = defaultStats();
    setState(freshStats);
  };

  return {
    hands: state.totals.hands,
    streak: state.totals.streak,
    bestStreak: state.totals.bestStreak,
    errors: state.totals.errors,
    bands: state.totals.bands,
    perCategory: state.perCategory,
    record,
    reset,
  };
}
