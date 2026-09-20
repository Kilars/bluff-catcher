/**
 * Tests for the persisted root-level choices — mode, stack depth, and whether
 * the odds drill names the draw before the guess.
 *
 * This file used to be useMode.test.ts, and it re-implemented loadMode and
 * saveMode locally because they were module-private inside App.tsx. That meant
 * it asserted against a copy: a regression in the helpers App actually called
 * would not have failed it. They are a hook now, so the test imports the code
 * that ships.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MODE_KEY,
  DEPTH_KEY,
  SHOW_DRAW_KEY,
  loadMode,
  saveMode,
  loadDepth,
  saveDepth,
  loadShowDraw,
  saveShowDraw,
} from './useAppPrefs';
import { DEFAULT_DEPTH, DEPTHS } from '../lib/preflop/ranges';

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

describe('depth persistence', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to the 60bb+ tier on a first run', () => {
    expect(loadDepth()).toBe(DEFAULT_DEPTH);
  });

  it('round-trips every real tier', () => {
    for (const d of DEPTHS) {
      saveDepth(d);
      expect(loadDepth()).toBe(d);
    }
  });

  it('falls back to the default on a value that is not a tier', () => {
    localStorage.setItem(DEPTH_KEY, 'not-a-tier');
    expect(loadDepth()).toBe(DEFAULT_DEPTH);
  });
});

describe('"show the draw" persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to ON when localStorage is empty — a first run gets the default', () => {
    expect(loadShowDraw()).toBe(true);
  });

  it('defaults to ON for an unrecognised stored value', () => {
    localStorage.setItem(SHOW_DRAW_KEY, 'invalid_garbage');
    expect(loadShowDraw()).toBe(true);
  });

  it('round-trips OFF — the one value that hides the draw', () => {
    saveShowDraw(false);
    expect(localStorage.getItem(SHOW_DRAW_KEY)).toBe('off');
    expect(loadShowDraw()).toBe(false);
  });

  it('round-trips back ON', () => {
    saveShowDraw(false);
    saveShowDraw(true);
    expect(localStorage.getItem(SHOW_DRAW_KEY)).toBe('on');
    expect(loadShowDraw()).toBe(true);
  });

  it('uses the versioned key bluff-catcher:show-draw:v1', () => {
    saveShowDraw(false);
    expect(SHOW_DRAW_KEY).toBe('bluff-catcher:show-draw:v1');
    expect(localStorage.getItem('bluff-catcher:show-draw:v1')).toBe('off');
  });
});
