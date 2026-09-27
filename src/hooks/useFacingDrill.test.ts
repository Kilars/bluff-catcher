/**
 * useFacingDrill — keys, commit lock, advance, stats and verdict copy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as dealModule from '../lib/preflop/facingDeal';
import type { FacingSpot } from '../lib/preflop/facingDeal';
import {
  facingAnswerWord,
  facingCellAction,
  facingChartTitle,
  facingVerdictText,
  useFacingDrill,
} from './useFacingDrill';
import { BRIEFED_KEY } from '../lib/preflop/briefed';
import { ALL_169 } from '../lib/preflop/hands';
import { legendFor } from '../lib/preflop/grid';
import { bucketChartAction } from '../lib/preflop/facing';

const BLUFF: FacingSpot = {
  opener: 'UTG1',
  bucket: 'early',
  cards: ['Ah', 'Qc'],
  handClass: 'AQo',
  correct: '3bet',
  kind: 'bluff',
};

const CALL: FacingSpot = {
  opener: 'HJ',
  bucket: 'late',
  cards: ['Jh', 'Jc'],
  handClass: 'JJ',
  correct: 'call',
};

function press(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
  });
}

/** Mark the briefing as seen so the hook starts with game keys live. */
function briefed() {
  localStorage.setItem(BRIEFED_KEY, JSON.stringify(['facing']));
}

describe('useFacingDrill', () => {
  let dealSpy: MockInstance<typeof dealModule.dealFacingSpot>;
  let onRecord: ReturnType<typeof vi.fn<(wasCorrect: boolean) => void>>;

  beforeEach(() => {
    localStorage.clear();
    onRecord = vi.fn<(wasCorrect: boolean) => void>();
    let n = 0;
    dealSpy = vi
      .spyOn(dealModule, 'dealFacingSpot')
      .mockImplementation(() => (n++ === 0 ? BLUFF : CALL));
  });

  afterEach(() => {
    dealSpy.mockRestore();
  });

  it('opens the briefing on the first visit only', () => {
    const first = renderHook(() => useFacingDrill({ onRecord }));
    expect(first.result.current.infoOpen).toBe(true);
    first.unmount();

    const second = renderHook(() => useFacingDrill({ onRecord }));
    expect(second.result.current.infoOpen).toBe(false);
  });

  it('does not mark any RFI tier as briefed', () => {
    renderHook(() => useFacingDrill({ onRecord }));
    expect(JSON.parse(localStorage.getItem(BRIEFED_KEY)!)).toEqual(['facing']);
  });

  it.each([
    ['f', 'fold'],
    ['j', 'call'],
    ['K', '3bet'],
  ] as const)('%s commits %s', (key, action) => {
    briefed();
    const { result } = renderHook(() => useFacingDrill({ onRecord }));
    press(key);
    expect(result.current.committed).toBe(action);
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(action === '3bet');
  });

  it('locks input after a commit: no second record, other action keys ignored', () => {
    briefed();
    const { result } = renderHook(() => useFacingDrill({ onRecord }));
    press('j');
    press('k');
    press('f');
    act(() => result.current.handleCommit('3bet'));
    expect(result.current.committed).toBe('call');
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(false);
  });

  it('Space and Enter advance only after a commit', () => {
    briefed();
    const { result } = renderHook(() => useFacingDrill({ onRecord }));
    press(' ');
    expect(result.current.spot).toBe(BLUFF);

    press('k');
    press(' ');
    expect(result.current.spot).toBe(CALL);
    expect(result.current.isCommitted).toBe(false);

    press('j');
    expect(onRecord).toHaveBeenLastCalledWith(true);
    press('Enter');
    expect(result.current.isCommitted).toBe(false);
    expect(dealSpy).toHaveBeenCalledTimes(3);
  });

  it('R opens the range after a commit, I opens the briefing, sheets swallow game keys', () => {
    briefed();
    const { result } = renderHook(() => useFacingDrill({ onRecord }));
    press('r');
    expect(result.current.rangeOpen).toBe(false);

    press('i');
    expect(result.current.infoOpen).toBe(true);
    press('f');
    expect(result.current.isCommitted).toBe(false);
    press('Escape');
    expect(result.current.infoOpen).toBe(false);

    press('f');
    press('r');
    expect(result.current.rangeOpen).toBe(true);
    press(' ');
    expect(result.current.spot).toBe(BLUFF);
    press('Escape');
    expect(result.current.rangeOpen).toBe(false);
  });

  it('ignores keys while suspended or with a modifier held', () => {
    briefed();
    const { result, rerender } = renderHook(
      ({ suspended }) => useFacingDrill({ onRecord, keysSuspended: suspended }),
      { initialProps: { suspended: true } }
    );
    press('f');
    expect(result.current.isCommitted).toBe(false);
    rerender({ suspended: false });
    press('f', { ctrlKey: true });
    expect(result.current.isCommitted).toBe(false);
  });

  it('names the 3-bet kind in the verdict', () => {
    briefed();
    const { result } = renderHook(() => useFacingDrill({ onRecord }));
    press('k');
    expect(result.current.verdictText).toBe('Correct — 3-bet (bluff)');
    expect(result.current.wasCorrect).toBe(true);
    expect(result.current.detailText).toBe('AQo vs UTG+1: 3-bet (bluff) on the vs Early chart');

    press(' ');
    press('k');
    expect(result.current.verdictText).toBe('Wrong — this is a call');
    expect(result.current.wasCorrect).toBe(false);
  });
});

describe('facing helpers', () => {
  it('verdict strings', () => {
    expect(facingVerdictText({ correct: 'call' }, 'call')).toBe('Correct — call');
    expect(facingVerdictText({ correct: 'fold' }, 'call')).toBe('Wrong — this is a fold');
    expect(facingVerdictText({ correct: '3bet', kind: 'value' }, 'fold')).toBe(
      'Wrong — this is a 3-bet (value)'
    );
    expect(facingVerdictText({ correct: '3bet', kind: 'bluff' }, '3bet')).toBe(
      'Correct — 3-bet (bluff)'
    );
  });

  it('chart titles list the bucket openers with display names', () => {
    expect(facingChartTitle('early')).toBe('BTN vs Early (UTG, UTG+1)');
    expect(facingChartTitle('late')).toBe('BTN vs Late (UTG+2, LJ, HJ, CO)');
  });

  it('cell colours match the bucket chart for all 169 classes', () => {
    for (const bucket of ['early', 'late'] as const) {
      for (const hc of ALL_169) {
        const { action, kind } = bucketChartAction(bucket, hc);
        expect(facingCellAction(bucket, hc)).toBe(action === '3bet' ? kind : action);
      }
    }
  });
});

describe('cash charts (no value/bluff split)', () => {
  it('colours cash 3-bets plainly and never as value', () => {
    expect(facingCellAction('cashEarly', 'AA')).toBe('threeBet');
    expect(facingCellAction('cashCo', 'A2s')).toBe('threeBet');
    expect(facingCellAction('cashEarly', '99')).toBe('call');
    expect(facingCellAction('early', 'AA')).toBe('value');
  });

  it('says a bare "3-bet" in the verdict', () => {
    expect(facingAnswerWord({ correct: '3bet' })).toBe('3-bet');
    expect(facingAnswerWord({ correct: '3bet', kind: 'bluff' })).toBe('3-bet (bluff)');
  });

  it('builds a three-entry legend for a cash chart and keeps V/B for tournament', () => {
    expect(legendFor((hc) => facingCellAction('cashCo', hc)).map((i) => i.action)).toEqual([
      'threeBet',
      'call',
      'fold',
    ]);
    expect(legendFor((hc) => facingCellAction('late', hc)).map((i) => i.action)).toEqual([
      'value',
      'bluff',
      'call',
      'fold',
    ]);
  });

  it('deals cash spots and briefs cash once, apart from the tournament briefing', () => {
    localStorage.clear();
    const { result } = renderHook(() => useFacingDrill({ onRecord: () => {}, format: 'cash' }));
    expect(['LJ', 'HJ', 'CO']).toContain(result.current.spot.opener);
    expect(result.current.infoOpen).toBe(true);
    expect(JSON.parse(localStorage.getItem(BRIEFED_KEY)!)).toEqual(['facing-cash']);
  });
});
