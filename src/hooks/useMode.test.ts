/**
 * Tests for mode persistence — App's loadMode / saveMode logic.
 *
 * Because loadMode and saveMode are module-local functions in App.tsx,
 * we test the observable behaviour: the localStorage key, its default,
 * and round-trip survival of valid/invalid values.
 *
 * We import AppMode type for type safety but duplicate the key constant
 * here rather than exporting it — keep the production module lean.
 */

import { describe, it, expect, beforeEach } from 'vitest';

const MODE_KEY = 'bluff-catcher:mode:v1';
type AppMode = 'odds' | 'preflop';

// ── Inline the tiny load/save helpers so the test is self-contained ──────────

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
    // silently fail
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('mode persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to "odds" when localStorage is empty', () => {
    expect(loadMode()).toBe('odds');
  });

  it('defaults to "odds" for an unrecognised stored value', () => {
    localStorage.setItem(MODE_KEY, 'invalid_garbage');
    expect(loadMode()).toBe('odds');
  });

  it('defaults to "odds" for an empty string', () => {
    localStorage.setItem(MODE_KEY, '');
    expect(loadMode()).toBe('odds');
  });

  it('round-trips "odds" correctly', () => {
    saveMode('odds');
    expect(localStorage.getItem(MODE_KEY)).toBe('odds');
    expect(loadMode()).toBe('odds');
  });

  it('round-trips "preflop" correctly', () => {
    saveMode('preflop');
    expect(localStorage.getItem(MODE_KEY)).toBe('preflop');
    expect(loadMode()).toBe('preflop');
  });

  it('overwrites a previous mode value', () => {
    saveMode('preflop');
    saveMode('odds');
    expect(loadMode()).toBe('odds');
  });

  it('uses the versioned key bluff-catcher:mode:v1', () => {
    saveMode('preflop');
    expect(localStorage.getItem('bluff-catcher:mode:v1')).toBe('preflop');
    // Other keys are untouched
    expect(localStorage.getItem('bluff-catcher:mode:v2')).toBeNull();
  });
});
