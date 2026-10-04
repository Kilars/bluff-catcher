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
  FORMAT_KEY,
  loadFormat,
  saveFormat,
  loadMode,
  saveMode,
  loadDepth,
  saveDepth,
  loadShowDraw,
  saveShowDraw,
  OPPONENTS_KEY,
  loadOpponents,
  saveOpponents,
  hasOpponentsChoice,
  LEGACY_STATS,
  STATS_KEY,
  migrateLegacyStats,
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

  it('round-trips each facing mode', () => {
    for (const mode of ['threebet', 'fourbet', 'blinds'] as const) {
      saveMode(mode);
      expect(localStorage.getItem(MODE_KEY)).toBe(mode);
      expect(loadMode()).toBe(mode);
    }
  });

  it('reads the retired drill ids forward to their mode (docs/PLAN-menu.md)', () => {
    const expected = {
      facing: 'threebet',
      seatvsopen: 'threebet',
      btn4bet: 'fourbet',
      open4bet: 'fourbet',
      bbdefend: 'blinds',
    };
    for (const [old, mode] of Object.entries(expected)) {
      localStorage.setItem(MODE_KEY, old);
      expect(loadMode()).toBe(mode);
    }
  });

  it('overwrites a previous mode value', () => {
    saveMode('preflop');
    saveMode('odds');
    expect(loadMode()).toBe('odds');
  });

  it('overwrites preflop with a facing mode and back', () => {
    saveMode('preflop');
    saveMode('threebet');
    expect(loadMode()).toBe('threebet');
    saveMode('preflop');
    expect(loadMode()).toBe('preflop');
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

describe('format persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to tournament, so nobody\'s app changes until they flip it', () => {
    expect(loadFormat()).toBe('mtt');
  });

  it('falls back to tournament for an unrecognised value', () => {
    localStorage.setItem(FORMAT_KEY, 'spins');
    expect(loadFormat()).toBe('mtt');
  });

  it('round-trips cash', () => {
    saveFormat('cash');
    expect(localStorage.getItem(FORMAT_KEY)).toBe('cash');
    expect(loadFormat()).toBe('cash');
  });

  it('falls back to tournament when storage throws', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(loadFormat()).toBe('mtt');
    } finally {
      Storage.prototype.getItem = orig;
    }
  });
});

describe('opponents persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to low stakes', () => {
    expect(loadOpponents()).toBe('low');
  });

  it('defaults to low stakes for an unrecognised stored value', () => {
    localStorage.setItem(OPPONENTS_KEY, 'nits');
    expect(loadOpponents()).toBe('low');
  });

  it('round-trips balanced', () => {
    saveOpponents('balanced');
    expect(loadOpponents()).toBe('balanced');
  });

  it('is offered only in cash 4-bet mode', () => {
    expect(hasOpponentsChoice('fourbet', 'cash')).toBe(true);
    expect(hasOpponentsChoice('fourbet', 'mtt')).toBe(false);
    expect(hasOpponentsChoice('threebet', 'cash')).toBe(false);
    expect(hasOpponentsChoice('blinds', 'cash')).toBe(false);
    expect(hasOpponentsChoice('preflop', 'cash')).toBe(false);
    expect(hasOpponentsChoice('odds', 'cash')).toBe(false);
  });
});

describe('legacy stats migration (docs/PLAN-menu.md)', () => {
  beforeEach(() => localStorage.clear());
  const put = (key: string, hands: number, correct: number, streak: number, bestStreak: number) =>
    localStorage.setItem(key, JSON.stringify({ hands, correct, streak, bestStreak }));
  const get = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');

  it('sums the sources of each new key, best of the best streaks, streak reset', () => {
    put('bluff-catcher:facing:v1', 10, 7, 3, 5);
    put('bluff-catcher:seatvsopen:v1', 4, 2, 1, 6);
    put('bluff-catcher:open4bet:v1', 3, 3, 3, 3);
    migrateLegacyStats();
    expect(get(STATS_KEY.threebet.mtt)).toEqual({ hands: 14, correct: 9, streak: 0, bestStreak: 6 });
    expect(get(STATS_KEY.fourbet.cash)).toEqual({ hands: 3, correct: 3, streak: 0, bestStreak: 3 });
    // Nothing to fold, nothing written; the old keys stay.
    expect(get(STATS_KEY.blinds.mtt)).toBeNull();
    expect(get('bluff-catcher:facing:v1')).not.toBeNull();
  });

  it('runs once, so a reset of a new mode does not bring the old numbers back', () => {
    put('bluff-catcher:bbdefend:v1', 5, 4, 0, 2);
    migrateLegacyStats();
    localStorage.removeItem(STATS_KEY.blinds.mtt); // what a reset does
    migrateLegacyStats();
    expect(get(STATS_KEY.blinds.mtt)).toBeNull();
  });

  it('every new key it writes is one the app reads', () => {
    const read = Object.values(STATS_KEY).flatMap((k) => Object.values(k));
    for (const target of Object.keys(LEGACY_STATS)) expect(read).toContain(target);
  });
});
