/**
 * The briefing is a teaching aid the first time and a toll every time after.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BRIEFED_KEY, needsBriefing, markBriefed } from './briefed';

beforeEach(() => localStorage.clear());

describe('needsBriefing', () => {
  it('is true for a tier never seen', () => {
    expect(needsBriefing('deep')).toBe(true);
  });

  it('is false once that tier is marked, and only that tier', () => {
    markBriefed('deep');
    expect(needsBriefing('deep')).toBe(false);
    // 10bb jam-or-fold really is a different game — it earns its own briefing.
    expect(needsBriefing('short')).toBe(true);
  });

  it('marking twice does not duplicate the entry', () => {
    markBriefed('deep');
    markBriefed('deep');
    expect(JSON.parse(localStorage.getItem(BRIEFED_KEY)!)).toEqual(['deep']);
  });

  it('treats corrupt storage as never briefed rather than throwing', () => {
    localStorage.setItem(BRIEFED_KEY, '{not json');
    expect(needsBriefing('deep')).toBe(true);
  });

  it('ignores non-string junk inside a valid array', () => {
    localStorage.setItem(BRIEFED_KEY, JSON.stringify(['deep', 7, null]));
    expect(needsBriefing('deep')).toBe(false);
    expect(needsBriefing('mid')).toBe(true);
  });
});
