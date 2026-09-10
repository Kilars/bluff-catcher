/**
 * PhoneSeatLadder — the 44px row that replaced the nine-seat felt.
 *
 * Covers:
 *  1. Nine slots, always, in action order — the row is the whole table.
 *  2. folded / hero / behind states for UTG (first to act), CO and BTN.
 *  3. The dealer button is on exactly one slot in every case, including the
 *     one where hero *is* the button — the seat it rides on is skipped by
 *     `buildSeats`, and the button vanishing from that spot is a regression
 *     that has actually shipped once.
 *  4. SB and BB are tagged, and are always the last two slots.
 *  5. The context line counts what the row draws.
 */

import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../../test/renderAt';
import PhoneSeatLadder from './PhoneSeatLadder';
import type { Position } from '../../../lib/preflop/ranges';
import { POSITIONS } from '../../../lib/preflop/ranges';

const ACTION_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

function slots() {
  return screen.getAllByTestId('seat-slot');
}

function labels() {
  return slots().map((el) => el.dataset.label);
}

function statesByLabel(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of slots()) out[el.dataset.label as string] = el.dataset.state as string;
  return out;
}

function buttonLabels() {
  return slots()
    .filter((el) => el.dataset.button === 'true')
    .map((el) => el.dataset.label);
}

describe('PhoneSeatLadder', () => {
  it('renders nine slots in action order for every position', () => {
    for (const position of POSITIONS) {
      const { unmount } = renderAt('phone', <PhoneSeatLadder position={position} />);
      expect(labels()).toEqual(ACTION_ORDER);
      unmount();
    }
  });

  it('UTG: nobody has folded, everyone else is behind', () => {
    renderAt('phone', <PhoneSeatLadder position="UTG" />);

    expect(statesByLabel()).toEqual({
      UTG: 'hero',
      'UTG+1': 'behind',
      'UTG+2': 'behind',
      LJ: 'behind',
      HJ: 'behind',
      CO: 'behind',
      BTN: 'behind',
      SB: 'behind',
      BB: 'behind',
    });
    expect(screen.getByTestId('ladder-context')).toHaveTextContent('0 folded · 8 behind');
  });

  it('CO: five folded in front, BTN and the blinds behind', () => {
    renderAt('phone', <PhoneSeatLadder position="CO" />);

    expect(statesByLabel()).toEqual({
      UTG: 'folded',
      'UTG+1': 'folded',
      'UTG+2': 'folded',
      LJ: 'folded',
      HJ: 'folded',
      CO: 'hero',
      BTN: 'behind',
      SB: 'behind',
      BB: 'behind',
    });
    expect(screen.getByTestId('ladder-context')).toHaveTextContent('5 folded · 3 behind');
  });

  it('BTN: hero holds the button and only the blinds are behind', () => {
    renderAt('phone', <PhoneSeatLadder position="BTN" />);

    expect(statesByLabel()).toEqual({
      UTG: 'folded',
      'UTG+1': 'folded',
      'UTG+2': 'folded',
      LJ: 'folded',
      HJ: 'folded',
      CO: 'folded',
      BTN: 'hero',
      SB: 'behind',
      BB: 'behind',
    });
    expect(screen.getByTestId('ladder-context')).toHaveTextContent('6 folded · 2 behind');
  });

  it('marks exactly one dealer button, on the BTN slot, from every position', () => {
    for (const position of POSITIONS) {
      const { unmount } = renderAt('phone', <PhoneSeatLadder position={position} />);
      expect(buttonLabels()).toEqual(['BTN']);
      unmount();
    }
  });

  it('shows the D on the button slot, hero or not', () => {
    for (const position of ['UTG', 'BTN'] as Position[]) {
      const { unmount } = renderAt('phone', <PhoneSeatLadder position={position} />);
      const btnSlot = slots().find((el) => el.dataset.label === 'BTN') as HTMLElement;
      expect(within(btnSlot).getByText('D')).toBeInTheDocument();
      unmount();
    }
  });

  it('tags the blinds and keeps them last', () => {
    renderAt('phone', <PhoneSeatLadder position="HJ" />);

    const all = slots();
    expect(all[7].dataset.blind).toBe('sb');
    expect(all[8].dataset.blind).toBe('bb');
    expect(all.filter((el) => el.dataset.blind !== undefined)).toHaveLength(2);
  });

  it('describes each slot for a screen reader', () => {
    renderAt('phone', <PhoneSeatLadder position="CO" />);

    expect(screen.getByLabelText('UTG, folded')).toBeInTheDocument();
    expect(screen.getByLabelText('CO, you')).toBeInTheDocument();
    expect(screen.getByLabelText('BTN, to act, dealer button')).toBeInTheDocument();
  });

  it('never shows more than one hero slot', () => {
    for (const position of POSITIONS) {
      const { unmount } = renderAt('phone', <PhoneSeatLadder position={position} />);
      expect(slots().filter((el) => el.dataset.state === 'hero')).toHaveLength(1);
      unmount();
    }
  });
});
