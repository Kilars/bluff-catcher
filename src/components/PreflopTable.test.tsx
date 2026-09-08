/**
 * PreflopTable — seat ring + action counter tests.
 *
 * Covers:
 *  1. All 8 non-hero seats are rendered, hero's own seat is not.
 *  2. The BTN seat is present when hero is UTG (regression: the button used to
 *     vanish for every position before it).
 *  3. The folded-before / to-act-behind counters read correctly per position.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PreflopTable, { buildSeats, seatSlotIndex } from './PreflopTable';
import type { Card as CardCode } from '../lib/odds';

const HERO: [CardCode, CardCode] = ['As', 'Kh'];

describe('PreflopTable seats', () => {
  it('renders all 8 non-hero seats when hero is UTG', () => {
    render(<PreflopTable hero={HERO} position="UTG" />);
    for (const label of ['UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Blinds are seats like any other — one plaque each, plus a posted chip
    expect(screen.getByText('SB')).toBeInTheDocument();
    expect(screen.getByText('BB')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(buildSeats('UTG')).toHaveLength(8);
  });

  it('renders the BTN seat when hero is UTG (button must never vanish)', () => {
    render(<PreflopTable hero={HERO} position="UTG" />);
    expect(screen.getByText('BTN')).toBeInTheDocument();
  });

  it('renders the BTN seat when hero is CO', () => {
    render(<PreflopTable hero={HERO} position="CO" />);
    expect(screen.getByText('BTN')).toBeInTheDocument();
  });

  it('omits hero’s own seat from the ring', () => {
    render(<PreflopTable hero={HERO} position="HJ" />);
    // 'HJ' appears once only — on hero's own plaque, not as a ring seat
    expect(screen.getAllByText('HJ')).toHaveLength(1);
    expect(buildSeats('HJ').map((s) => s.label)).toEqual([
      'UTG', 'UTG+1', 'UTG+2', 'LJ', 'CO', 'BTN', 'SB', 'BB',
    ]);
  });

  it('marks seats before hero folded and seats after hero still to act', () => {
    const seats = buildSeats('LJ');
    expect(seats.filter((s) => s.type === 'folded').map((s) => s.label)).toEqual([
      'UTG', 'UTG+1', 'UTG+2',
    ]);
    expect(seats.filter((s) => s.type === 'toAct').map((s) => s.label)).toEqual([
      'HJ', 'CO', 'BTN',
    ]);
    expect(seats.find((s) => s.label === 'BTN')?.isBtn).toBe(true);
  });

  it('seats the ring clockwise from hero, blinds included', () => {
    // Hero on the CO: the button is the next seat round, then SB and BB.
    expect(seatSlotIndex('CO', 'BTN')).toBe(1);
    expect(seatSlotIndex('CO', 'SB')).toBe(2);
    expect(seatSlotIndex('CO', 'BB')).toBe(3);
    expect(seatSlotIndex('CO', 'UTG')).toBe(4);
    // …and the seat that acted just before hero sits on hero's right.
    expect(seatSlotIndex('CO', 'HJ')).toBe(8);
  });

  it('puts hero in slot 0, so the button rides with hero on the BTN', () => {
    expect(seatSlotIndex('BTN', 'BTN')).toBe(0);
    expect(seatSlotIndex('UTG', 'UTG')).toBe(0);
  });

  it('always shows one dealer button', () => {
    for (const pos of ['UTG', 'HJ', 'BTN'] as const) {
      const { unmount } = render(<PreflopTable hero={HERO} position={pos} />);
      expect(screen.getAllByLabelText('Dealer button')).toHaveLength(1);
      unmount();
    }
  });
});

describe('PreflopTable action counters', () => {
  it('shows 0 folded / 6 to act for UTG', () => {
    render(<PreflopTable hero={HERO} position="UTG" />);
    expect(screen.getByText(/First in — nobody has acted/i)).toBeInTheDocument();
    expect(screen.getByText(/6 players to act behind you/i)).toBeInTheDocument();
  });

  it('shows 5 folded / 1 to act for CO', () => {
    render(<PreflopTable hero={HERO} position="CO" />);
    expect(screen.getByText(/5 players folded before you/i)).toBeInTheDocument();
    expect(screen.getByText(/1 player to act behind you/i)).toBeInTheDocument();
  });

  it('shows 1 player (singular) folded for UTG+1', () => {
    render(<PreflopTable hero={HERO} position="UTG1" />);
    expect(screen.getByText(/1 player folded before you/i)).toBeInTheDocument();
  });

  it('calls out the button case for BTN', () => {
    render(<PreflopTable hero={HERO} position="BTN" />);
    expect(screen.getByText(/you're on the button/i)).toBeInTheDocument();
    expect(screen.getByText(/6 players folded before you/i)).toBeInTheDocument();
  });
});
