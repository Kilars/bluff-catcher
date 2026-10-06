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
  facingChartPages,
  facingChartTitle,
  facingVerdictText,
  useFacingDrill,
} from './useFacingDrill';
import { BRIEFED_KEY } from '../lib/preflop/briefed';
import { ALL_169 } from '../lib/preflop/hands';
import { legendFor } from '../lib/preflop/grid';
import { BUCKET_REACHABLE, bucketChartAction } from '../lib/preflop/facing';

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
  localStorage.setItem(BRIEFED_KEY, JSON.stringify(['threebet']));
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
    expect(JSON.parse(localStorage.getItem(BRIEFED_KEY)!)).toEqual(['threebet']);
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

  it('cell colours match the bucket chart for all 169 classes, and dim what it never deals', () => {
    for (const bucket of ['early', 'late'] as const) {
      for (const hc of ALL_169) {
        const { action, kind } = bucketChartAction(bucket, hc);
        const dealt = BUCKET_REACHABLE[bucket]!.has(hc);
        expect(facingCellAction(bucket, hc)).toBe(!dealt ? 'none' : action === '3bet' ? kind : action);
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
      'none',
    ]);
    expect(legendFor((hc) => facingCellAction('late', hc)).map((i) => i.action)).toEqual([
      'value',
      'bluff',
      'call',
      'fold',
      'none',
    ]);
  });

  it('deals cash spots and briefs cash once, apart from the tournament briefing', () => {
    localStorage.clear();
    const { result } = renderHook(() => useFacingDrill({ onRecord: () => {}, format: 'cash' }));
    expect(['LJ', 'HJ', 'CO']).toContain(result.current.spot.opener);
    expect(result.current.infoOpen).toBe(true);
    expect(JSON.parse(localStorage.getItem(BRIEFED_KEY)!)).toEqual(['threebet-cash']);
  });
});

describe('BTN vs 3-bet (docs/PLAN-btn-4bet.md)', () => {
  const FOUR_BET_BLUFF: FacingSpot = {
    opener: 'SB',
    bucket: 'btn4-cash-SB',
    cards: ['Ah', 'Jc'],
    handClass: 'AJo',
    correct: '4bet',
    kind: 'bluff',
  };

  it('K commits a 4-bet, graded right, and the copy says 4-bet', () => {
    localStorage.setItem(BRIEFED_KEY, JSON.stringify(['fourbet-cash']));
    const spy = vi.spyOn(dealModule, 'dealFacingSpot').mockReturnValue(FOUR_BET_BLUFF);
    const onRecord = vi.fn<(wasCorrect: boolean) => void>();
    const { result } = renderHook(() => useFacingDrill({ onRecord, format: 'cash', mode: 'fourbet' }));
    expect(result.current.raiseWord).toBe('4-bet');
    press('k');
    expect(result.current.committed).toBe('4bet');
    expect(onRecord).toHaveBeenCalledWith(true);
    expect(result.current.verdictText).toBe('Correct — 4-bet (bluff)');
    expect(result.current.detailText).toBe('AJo vs SB: 4-bet (bluff)');
    spy.mockRestore();
  });

  it('briefs each format once, under its own id', () => {
    localStorage.clear();
    renderHook(() => useFacingDrill({ onRecord: () => {}, format: 'mtt', mode: 'fourbet' }));
    expect(JSON.parse(localStorage.getItem(BRIEFED_KEY)!)).toEqual(['fourbet']);
  });

  it('colours 4-bets with the value/bluff split in cash and plainly at 40bb', () => {
    expect(facingCellAction('btn4-cash-SB', 'KK')).toBe('fourBetValue');
    expect(facingCellAction('btn4-cash-BB', 'KQo')).toBe('fourBetBluff');
    expect(facingCellAction('btn4-cash-BB', 'JTs')).toBe('call');
    expect(facingCellAction('btn4-mtt-SB', '33')).toBe('fourBet');
    expect(legendFor((hc) => facingCellAction('btn4-cash-SB', hc)).map((i) => i.action)).toEqual([
      'fourBetValue',
      'fourBetBluff',
      'call',
      'fold',
      'none',
    ]);
    expect(legendFor((hc) => facingCellAction('btn4-mtt-BB', hc)).map((i) => i.action)).toEqual([
      'fourBet',
      'call',
      'fold',
      'none',
    ]);
  });

  it('names the chart by the 3-bettor', () => {
    expect(facingChartTitle('btn4-cash-SB')).toBe('BTN vs SB 3-bet');
    expect(facingChartTitle('btn4-mtt-BB')).toBe('BTN vs BB 3-bet');
    expect(facingAnswerWord({ correct: '4bet' })).toBe('4-bet');
  });
});

describe('chart pages per mode (docs/PLAN-menu.md)', () => {
  it('groups a mode spanning seats by hero seat, with the raiser alone on the tab', () => {
    expect(facingChartPages('cash', 'fourbet', 'k').map((p) => [p.group, p.tab, p.title])).toEqual([
      ['BTN', 'SB', 'BTN vs SB 3-bet'],
      ['BTN', 'BB', 'BTN vs BB 3-bet'],
      ['LJ', '3-bet', 'LJ vs 3-bet'],
      ['HJ', '3-bet', 'HJ vs 3-bet'],
      ['CO', '3-bet', 'CO vs 3-bet'],
    ]);
    expect(facingChartPages('mtt', 'threebet', 'k').map((p) => [p.group, p.tab])).toEqual([
      ['BTN', 'Early'],
      ['BTN', 'Late'],
      ['HJ', 'LJ'],
      ['CO', 'HJ'],
    ]);
    expect(new Set(facingChartPages('mtt', 'blinds', 'k').map((p) => p.group))).toEqual(new Set(['BB', 'SB']));
  });

  it('deals 4-bet in a tournament from the button only: there are no tournament open-vs-3-bet charts', () => {
    localStorage.clear();
    const { result } = renderHook(() => useFacingDrill({ onRecord: () => {}, format: 'mtt', mode: 'fourbet' }));
    expect(result.current.bucketMeta.format).toBe('mtt');
    expect(result.current.bucketMeta.hero).toBe('BTN');
  });
});

describe('facingCellAction — opponents read', () => {
  it('colours a value 4-bet the low-stakes read folds to a jam as a bluff', () => {
    expect(facingCellAction('btn4-cash-SB', 'TT')).toBe('fourBetValue');
    expect(facingCellAction('btn4-cash-SB', 'TT', 'low')).toBe('fourBetBluff');
    expect(facingCellAction('btn4-cash-SB', 'QQ', 'low')).toBe('fourBetValue');
  });

  it('leaves the 3-bet charts alone', () => {
    expect(facingCellAction('early', 'AKo', 'low')).toBe(facingCellAction('early', 'AKo'));
  });
});
