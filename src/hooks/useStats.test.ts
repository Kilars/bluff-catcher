/**
 * Test useStats hook — persistence, recording, reset, and state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStats } from './useStats';

describe('useStats', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('fresh load', () => {
    it('should initialize with all zeros', () => {
      const { result } = renderHook(() => useStats());

      expect(result.current.hands).toBe(0);
      expect(result.current.streak).toBe(0);
      expect(result.current.bestStreak).toBe(0);
      expect(result.current.errors).toEqual([]);
      expect(result.current.bands).toEqual({ green: 0, amber: 0, red: 0 });
      expect(result.current.perCategory).toEqual({});
    });
  });

  describe('record()', () => {
    it('should increment hands and add to totals on green', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(3, 'green', 'flushDraw');
      });

      expect(result.current.hands).toBe(1);
      expect(result.current.errors).toEqual([3]);
      expect(result.current.bands.green).toBe(1);
      expect(result.current.bands.amber).toBe(0);
      expect(result.current.bands.red).toBe(0);
    });

    it('should increment streak on green, reset on non-green', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(3, 'green', 'flushDraw');
        result.current.record(2, 'green', 'openEnder');
        result.current.record(2, 'green', 'gutshot');
      });
      expect(result.current.streak).toBe(3);

      act(() => {
        result.current.record(8, 'amber', 'openEnder');
      });
      expect(result.current.streak).toBe(0);

      act(() => {
        result.current.record(3, 'green', 'combo');
      });
      expect(result.current.streak).toBe(1);
    });

    it('should track bestStreak correctly', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(3, 'green', 'flushDraw');
        result.current.record(2, 'green', 'openEnder');
      });
      expect(result.current.bestStreak).toBe(2);

      act(() => {
        result.current.record(8, 'red', 'gutshot');
      });
      expect(result.current.streak).toBe(0);
      expect(result.current.bestStreak).toBe(2);

      act(() => {
        result.current.record(3, 'green', 'combo');
        result.current.record(2, 'green', 'overcards');
        result.current.record(1, 'green', 'pairImproving');
      });
      expect(result.current.streak).toBe(3);
      expect(result.current.bestStreak).toBe(3);
    });

    it('should create and update per-category stats', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(3, 'green', 'flushDraw');
        result.current.record(5, 'amber', 'flushDraw');
        result.current.record(8, 'green', 'openEnder');
      });

      expect(result.current.perCategory.flushDraw).toEqual({
        n: 2,
        errors: [3, 5],
        bands: { green: 1, amber: 1, red: 0 },
      });

      expect(result.current.perCategory.openEnder).toEqual({
        n: 1,
        errors: [8],
        bands: { green: 1, amber: 0, red: 0 },
      });
    });

    it('should handle multiple categories independently', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(2, 'green', 'flushDraw');
        result.current.record(12, 'red', 'gutshot');
        result.current.record(6, 'amber', 'combo');
        result.current.record(3, 'green', 'flushDraw');
      });

      expect(result.current.hands).toBe(4);
      expect(result.current.errors).toEqual([2, 12, 6, 3]);
      expect(result.current.bands).toEqual({ green: 2, amber: 1, red: 1 });

      expect(result.current.perCategory.flushDraw.n).toBe(2);
      expect(result.current.perCategory.gutshot.n).toBe(1);
      expect(result.current.perCategory.combo.n).toBe(1);
    });
  });

  describe('persistence', () => {
    it('should persist state to localStorage on record', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(4, 'green', 'flushDraw');
      });

      const stored = JSON.parse(localStorage.getItem('bluff-catcher:stats:v1') || '{}');
      expect(stored.totals.hands).toBe(1);
      expect(stored.totals.errors).toEqual([4]);
      expect(stored.totals.streak).toBe(1);
      expect(stored.perCategory.flushDraw).toBeDefined();
    });

    it('should restore from localStorage on remount', () => {
      const { result: result1 } = renderHook(() => useStats());

      act(() => {
        result1.current.record(3, 'green', 'flushDraw');
        result1.current.record(7, 'amber', 'openEnder');
      });

      // Unmount and remount
      const { result: result2 } = renderHook(() => useStats());

      expect(result2.current.hands).toBe(2);
      expect(result2.current.streak).toBe(0); // 0 because last was amber
      expect(result2.current.bestStreak).toBe(1);
      expect(result2.current.errors).toEqual([3, 7]);
      expect(result2.current.bands).toEqual({ green: 1, amber: 1, red: 0 });
      expect(result2.current.perCategory.flushDraw.n).toBe(1);
      expect(result2.current.perCategory.openEnder.n).toBe(1);
    });

    it('should survive multiple record operations and remounts', () => {
      const { result: result1 } = renderHook(() => useStats());

      act(() => {
        result1.current.record(2, 'green', 'combo');
        result1.current.record(3, 'green', 'combo');
        result1.current.record(1, 'green', 'combo');
        result1.current.record(9, 'red', 'overcards');
      });

      expect(result1.current.streak).toBe(0);

      // Remount
      const { result: result2 } = renderHook(() => useStats());

      expect(result2.current.hands).toBe(4);
      expect(result2.current.streak).toBe(0);
      expect(result2.current.bestStreak).toBe(3);
      expect(result2.current.errors).toEqual([2, 3, 1, 9]);
      expect(result2.current.bands).toEqual({ green: 3, amber: 0, red: 1 });

      // Continue playing
      act(() => {
        result2.current.record(4, 'green', 'backdoor');
      });

      expect(result2.current.hands).toBe(5);
      expect(result2.current.streak).toBe(1);

      // Final remount
      const { result: result3 } = renderHook(() => useStats());
      expect(result3.current.hands).toBe(5);
      expect(result3.current.streak).toBe(1);
      expect(result3.current.bestStreak).toBe(3);
    });
  });

  describe('reset()', () => {
    it('should clear all stats and localStorage', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(5, 'green', 'flushDraw');
        result.current.record(8, 'amber', 'openEnder');
        result.current.record(2, 'green', 'gutshot');
      });

      expect(result.current.hands).toBe(3);

      act(() => {
        result.current.reset();
      });

      expect(result.current.hands).toBe(0);
      expect(result.current.streak).toBe(0);
      expect(result.current.bestStreak).toBe(0);
      expect(result.current.errors).toEqual([]);
      expect(result.current.bands).toEqual({ green: 0, amber: 0, red: 0 });
      expect(result.current.perCategory).toEqual({});

      const stored = localStorage.getItem('bluff-catcher:stats:v1');
      expect(stored).toBeNull();
    });

    it('should allow fresh start after reset', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(5, 'green', 'flushDraw');
        result.current.record(8, 'amber', 'openEnder');
      });

      act(() => {
        result.current.reset();
      });

      act(() => {
        result.current.record(3, 'green', 'combo');
      });

      expect(result.current.hands).toBe(1);
      expect(result.current.streak).toBe(1);
      expect(result.current.errors).toEqual([3]);
      expect(result.current.perCategory.combo.n).toBe(1);
      expect(result.current.perCategory.flushDraw).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle zero delta', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(0, 'green', 'flushDraw');
      });

      expect(result.current.hands).toBe(1);
      expect(result.current.errors).toEqual([0]);
      expect(result.current.bands.green).toBe(1);
    });

    it('should handle large deltas', () => {
      const { result } = renderHook(() => useStats());

      act(() => {
        result.current.record(99, 'red', 'flushDraw');
      });

      expect(result.current.hands).toBe(1);
      expect(result.current.errors).toEqual([99]);
      expect(result.current.bands.red).toBe(1);
    });

    it('should accumulate errors correctly (for averaging)', () => {
      const { result } = renderHook(() => useStats());

      const deltas = [3, 5, 2, 8, 4];
      act(() => {
        deltas.forEach((d, i) => {
          const band = i % 2 === 0 ? 'green' : 'amber';
          result.current.record(d, band, 'flushDraw');
        });
      });

      expect(result.current.errors).toEqual(deltas);
      const avg = deltas.reduce((a, b) => a + b) / deltas.length;
      expect(avg).toBeCloseTo(4.4);
    });
  });
});
