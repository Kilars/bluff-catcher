/**
 * Tests for the persisted root-level choices — mode and stack depth.
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
  loadMode,
  saveMode,
  loadDepth,
  saveDepth,
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
