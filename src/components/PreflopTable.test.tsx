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
import PreflopTable, { buildSeats } from './PreflopTable';
import type { Card as CardCode } from '../lib/odds';

const HERO: [CardCode, CardCode] = ['As', 'Kh'];

describe('PreflopTable seats', () => {
  it('renders all 8 non-hero seats when hero is UTG', () => {
    render(<PreflopTable hero={HERO} position="UTG" />);
    for (const label of ['UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // SB / BB appear twice each: once on the chip, once as the seat label
    expect(screen.getAllByText('SB')).toHaveLength(2);
    expect(screen.getAllByText('BB')).toHaveLength(2);
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
    // 'HJ' appears once only — as the centre position label, not as a seat
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
