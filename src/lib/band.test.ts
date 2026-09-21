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

const BANDS: Band[] = ['green', 'amber', 'red'];

describe('bandOf()', () => {
  it.each([
    [0, 'green'],
    [1, 'green'],
    [4.9, 'green'],
    [GREEN_BAND, 'green'],
    [5.1, 'amber'],
    [6, 'amber'],
    [AMBER_BAND, 'amber'],
    [10.1, 'red'],
    [50, 'red'],
    [100, 'red'],
  ] as const)('scores a %s-point miss %s', (delta, band) => {
    expect(bandOf(delta)).toBe(band);
  });

  it('reaches all three bands across the 0–100 range', () => {
    const seen = new Set<Band>();
    for (let delta = 0; delta <= 100; delta += 1) seen.add(bandOf(delta));
    expect([...seen].sort()).toEqual(['amber', 'green', 'red']);
  });
});

describe('thresholds', () => {
  it('holds the documented values the designs are sized against', () => {
    expect(GREEN_BAND).toBe(5);
    expect(AMBER_BAND).toBe(10);
    expect(GREEN_BAND).toBeLessThan(AMBER_BAND);
  });
});

describe('presentation maps', () => {
  // The copy is asserted here on purpose: this module is the single source for
  // it, so the views can assert against BAND_LABEL instead of their own string.
  it('names and colours exactly the three bands', () => {
    expect(Object.keys(BAND_COLOR).sort()).toEqual(['amber', 'green', 'red']);
    expect(Object.keys(BAND_LABEL).sort()).toEqual(['amber', 'green', 'red']);
    for (const band of BANDS) expect(BAND_COLOR[band]).toBe(`var(--band-${band})`);
    expect(BAND_LABEL).toEqual({ green: 'On the money', amber: 'Close', red: 'Off' });
  });
});
