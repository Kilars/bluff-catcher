/**
 * Test usePreflopStats hook — persistence, recording, streak, accuracy, reset.
 * Mirrors useStats.test.ts conventions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreflopStats } from './usePreflopStats';

const STORAGE_KEY = 'bluff-catcher:preflop:v1';

describe('usePreflopStats', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── Fresh load ─────────────────────────────────────────────────────────────

  describe('fresh load', () => {
    it('initialises with all zeros and 0% accuracy', () => {
      const { result } = renderHook(() => usePreflopStats());

      expect(result.current.hands).toBe(0);
      expect(result.current.correct).toBe(0);
      expect(result.current.streak).toBe(0);
      expect(result.current.bestStreak).toBe(0);
      expect(result.current.accuracy).toBe(0);
    });
  });

  // ── record() ──────────────────────────────────────────────────────────────

  describe('record()', () => {
    it('increments hands and correct on a correct answer', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
      });

      expect(result.current.hands).toBe(1);
      expect(result.current.correct).toBe(1);
    });

    it('increments hands but not correct on a wrong answer', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(false);
      });

      expect(result.current.hands).toBe(1);
      expect(result.current.correct).toBe(0);
    });

    it('increments streak on correct answers', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(true);
      });

      expect(result.current.streak).toBe(3);
    });

    it('resets streak to 0 on a wrong answer', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(false);
      });

      expect(result.current.streak).toBe(0);
    });

    it('resumes streak after a miss', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(false);
        result.current.record(true);
      });

      expect(result.current.streak).toBe(1);
    });

    it('tracks bestStreak correctly across a miss', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(true);
      });
      expect(result.current.bestStreak).toBe(3);

      act(() => {
        result.current.record(false);
      });
      expect(result.current.streak).toBe(0);
      expect(result.current.bestStreak).toBe(3); // preserved

      act(() => {
        result.current.record(true);
        result.current.record(true);
      });
      expect(result.current.streak).toBe(2);
      expect(result.current.bestStreak).toBe(3); // still 3, not beaten
    });

    it('updates bestStreak when new streak exceeds the old one', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(false);
        result.current.record(true);
        result.current.record(true);
        result.current.record(true);
        result.current.record(true);
      });

      expect(result.current.streak).toBe(4);
      expect(result.current.bestStreak).toBe(4);
    });
  });

  // ── accuracy() ────────────────────────────────────────────────────────────

  describe('accuracy', () => {
    it('returns 0 with no hands played', () => {
      const { result } = renderHook(() => usePreflopStats());
      expect(result.current.accuracy).toBe(0);
    });

    it('returns 100 when all answers are correct', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(true);
      });

      expect(result.current.accuracy).toBe(100);
    });

    it('returns 0 when all answers are wrong', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(false);
        result.current.record(false);
      });

      expect(result.current.accuracy).toBe(0);
    });

    it('calculates accuracy as a percentage of correct / total', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(false);
        result.current.record(true);
      });

      // 3 correct / 4 total = 75%
      expect(result.current.accuracy).toBeCloseTo(75);
    });
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('persists state to localStorage on record', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      expect(stored.hands).toBe(1);
      expect(stored.correct).toBe(1);
      expect(stored.streak).toBe(1);
    });

    it('restores state from localStorage on remount', () => {
      const { result: result1 } = renderHook(() => usePreflopStats());

      act(() => {
        result1.current.record(true);
        result1.current.record(true);
        result1.current.record(false);
        result1.current.record(true);
      });

      // Remount a new hook instance — should read from localStorage
      const { result: result2 } = renderHook(() => usePreflopStats());

      expect(result2.current.hands).toBe(4);
      expect(result2.current.correct).toBe(3);
      expect(result2.current.streak).toBe(1); // last answer was correct
      expect(result2.current.bestStreak).toBe(2);
      expect(result2.current.accuracy).toBeCloseTo(75);
    });

    it('does not write to localStorage when hands = 0', () => {
      renderHook(() => usePreflopStats());

      // No interactions — key should not be present
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('clears localStorage key after reset', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
      });
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('handles corrupt localStorage data by starting fresh', () => {
      localStorage.setItem(STORAGE_KEY, '{ not valid json %%');

      const { result } = renderHook(() => usePreflopStats());

      expect(result.current.hands).toBe(0);
      expect(result.current.correct).toBe(0);
      expect(result.current.streak).toBe(0);
      expect(result.current.bestStreak).toBe(0);
      expect(result.current.accuracy).toBe(0);
    });

    it('handles incomplete/wrong-shape localStorage data by starting fresh', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ hands: 'oops', streak: null }));

      const { result } = renderHook(() => usePreflopStats());

      expect(result.current.hands).toBe(0);
    });

    it('is independent from the odds stats key', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
      });

      // Odds stats key should be untouched
      expect(localStorage.getItem('bluff-catcher:stats:v1')).toBeNull();
      // Preflop key should be written
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears all fields back to zero', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(true);
        result.current.record(true);
        result.current.record(false);
        result.current.record(true);
      });

      expect(result.current.hands).toBe(4);

      act(() => {
        result.current.reset();
      });

      expect(result.current.hands).toBe(0);
      expect(result.current.correct).toBe(0);
      expect(result.current.streak).toBe(0);
      expect(result.current.bestStreak).toBe(0);
      expect(result.current.accuracy).toBe(0);
    });

    it('allows a fresh start after reset', () => {
      const { result } = renderHook(() => usePreflopStats());

      act(() => {
        result.current.record(false);
        result.current.record(false);
      });
      act(() => {
        result.current.reset();
      });
      act(() => {
        result.current.record(true);
      });

      expect(result.current.hands).toBe(1);
      expect(result.current.correct).toBe(1);
      expect(result.current.streak).toBe(1);
      expect(result.current.accuracy).toBe(100);
    });
  });
});
