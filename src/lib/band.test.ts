/**
 * Tests for the shared band model.
 *
 * The thresholds are inclusive at the top and the boundary cases are the whole
 * point of this module: both the desktop and the phone tree score against them,
 * and the stats tally is keyed off the result.
 */

import { describe, it, expect } from 'vitest';
import {
  bandOf,
  BAND_COLOR,
  BAND_LABEL,
  GREEN_BAND,
  AMBER_BAND,
  type Band,
} from './band';

describe('bandOf()', () => {
  it('scores a perfect guess green', () => {
    expect(bandOf(0)).toBe('green');
  });

  it('scores inside the green band green', () => {
    expect(bandOf(1)).toBe('green');
    expect(bandOf(4.9)).toBe('green');
  });

  it('includes the green boundary itself', () => {
    expect(bandOf(GREEN_BAND)).toBe('green');
    expect(bandOf(5)).toBe('green');
  });

  it('scores just past the green boundary amber', () => {
    expect(bandOf(5.1)).toBe('amber');
    expect(bandOf(6)).toBe('amber');
  });

  it('includes the amber boundary itself', () => {
    expect(bandOf(AMBER_BAND)).toBe('amber');
    expect(bandOf(10)).toBe('amber');
  });

  it('scores past the amber boundary red', () => {
    expect(bandOf(10.1)).toBe('red');
    expect(bandOf(50)).toBe('red');
    expect(bandOf(100)).toBe('red');
  });
});

describe('thresholds', () => {
  it('keeps green tighter than amber', () => {
    expect(GREEN_BAND).toBeLessThan(AMBER_BAND);
  });

  it('holds the documented values the designs are sized against', () => {
    expect(GREEN_BAND).toBe(5);
    expect(AMBER_BAND).toBe(10);
  });
});

describe('presentation maps', () => {
  const BANDS: Band[] = ['green', 'amber', 'red'];

  it('has a colour token for every band', () => {
    for (const band of BANDS) {
      expect(BAND_COLOR[band]).toBe(`var(--band-${band})`);
    }
  });

  it('has copy for every band', () => {
    for (const band of BANDS) {
      expect(BAND_LABEL[band]).toBeTruthy();
    }
    expect(BAND_LABEL.green).toBe('On the money');
    expect(BAND_LABEL.amber).toBe('Close');
    expect(BAND_LABEL.red).toBe('Off');
  });

  it('covers exactly the three bands and no more', () => {
    expect(Object.keys(BAND_COLOR).sort()).toEqual(['amber', 'green', 'red']);
    expect(Object.keys(BAND_LABEL).sort()).toEqual(['amber', 'green', 'red']);
  });
});

describe('every band is reachable from some delta', () => {
  it('produces all three bands across the 0–100 range', () => {
    const seen = new Set<Band>();
    for (let delta = 0; delta <= 100; delta += 1) seen.add(bandOf(delta));
    expect([...seen].sort()).toEqual(['amber', 'green', 'red']);
  });
});
