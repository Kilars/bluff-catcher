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
import PreflopTable, { buildContextLine, buildSeats, seatSlotIndex } from './PreflopTable';
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

describe('PreflopTable opener (PLAN-3bet F2)', () => {
  it('marks the opener seat and leaves the rest of the pre-hero seats folded', () => {
    const seats = buildSeats('BTN', 'HJ');
    expect(seats.filter((s) => s.type === 'folded').map((s) => s.label)).toEqual([
      'UTG', 'UTG+1', 'UTG+2', 'LJ', 'CO',
    ]);
    expect(seats.find((s) => s.label === 'HJ')).toMatchObject({ type: 'opener', raiseBb: 2.5 });
  });

  it('defaults the raise to 2.5bb and lets it be overridden', () => {
    expect(buildSeats('BTN', 'CO').find((s) => s.label === 'CO')?.raiseBb).toBe(2.5);
    expect(buildSeats('BTN', 'CO', 3).find((s) => s.label === 'CO')?.raiseBb).toBe(3);
  });

  it('renders exactly as today when opener is omitted', () => {
    expect(buildSeats('BTN')).toEqual(buildSeats('BTN', undefined));
    expect(buildSeats('BTN').every((s) => s.type !== 'opener')).toBe(true);
  });

  it('renders the raise chip at the opener seat, on desktop', () => {
    render(<PreflopTable hero={HERO} position="BTN" opener="UTG2" />);
    const chip = screen.getByTestId('raise-chip');
    expect(chip).toHaveTextContent('2.5');
    // No other seat gets a raise-chip testid.
    expect(screen.getAllByTestId('raise-chip')).toHaveLength(1);
  });

  it('does not render a raise chip when opener is omitted', () => {
    render(<PreflopTable hero={HERO} position="BTN" />);
    expect(screen.queryByTestId('raise-chip')).toBeNull();
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

describe('cash (6-max) ring', () => {
  it('seats five others around hero, blinds last', () => {
    expect(buildSeats('LJ', undefined, 2.5, 'cash').map((s) => [s.label, s.type])).toEqual([
      ['HJ', 'toAct'],
      ['CO', 'toAct'],
      ['BTN', 'toAct'],
      ['SB', 'sb'],
      ['BB', 'bb'],
    ]);
  });

  it('seats hero on the SB without a second SB seat, BTN folded but still the button', () => {
    const seats = buildSeats('SB', undefined, 2.5, 'cash');
    expect(seats.map((s) => [s.label, s.type])).toEqual([
      ['LJ', 'folded'],
      ['HJ', 'folded'],
      ['CO', 'folded'],
      ['BTN', 'folded'],
      ['BB', 'bb'],
    ]);
    expect(seats.find((s) => s.label === 'BTN')?.isBtn).toBe(true);
    expect(buildContextLine('SB', 'cash')).toBe('4 players folded before you · only the BB behind you');
  });

  it('counts slots round a six-seat ring', () => {
    expect(seatSlotIndex('CO', 'BTN', 'cash')).toBe(1);
    expect(seatSlotIndex('CO', 'BB', 'cash')).toBe(3);
    expect(seatSlotIndex('CO', 'HJ', 'cash')).toBe(5);
    expect(seatSlotIndex('SB', 'SB', 'cash')).toBe(0);
  });

  it('draws the 6-max felt with hero\'s own blind chip on the SB', () => {
    render(<PreflopTable hero={['As', 'Kd']} position="SB" depth="cash" />);
    expect(screen.getByTestId('hero-blind-chip')).toHaveTextContent('0.5');
    expect(screen.queryByText('UTG')).not.toBeInTheDocument();
    expect(screen.getAllByText('SB')).toHaveLength(1);
  });

  it('puts the facing opener\'s raise chip on a cash seat', () => {
    render(<PreflopTable hero={['As', 'Kd']} position="BTN" opener="HJ" format="cash" />);
    expect(screen.getByTestId('raise-chip')).toBeInTheDocument();
  });
});

describe('hero in the big blind (docs/PLAN-bb-defend.md)', () => {
  it('has every other seat act first; a folded SB leaves its blind', () => {
    const seats = buildSeats('BB', 'CO', 2.3);
    expect(seats.map((s) => [s.label, s.type])).toEqual([
      ['UTG', 'folded'],
      ['UTG+1', 'folded'],
      ['UTG+2', 'folded'],
      ['LJ', 'folded'],
      ['HJ', 'folded'],
      ['CO', 'opener'],
      ['BTN', 'folded'],
      ['SB', 'folded'],
    ]);
    expect(seats.find((s) => s.label === 'SB')?.posted).toBe('sb');
    expect(buildContextLine('BB')).toBe('8 players acted before you · you close the action');
  });

  it('lets the SB be the opener, with no dead blind', () => {
    const sb = buildSeats('BB', 'SB', 3, 'cash').find((s) => s.label === 'SB');
    expect(sb).toMatchObject({ type: 'opener', raiseBb: 3 });
    expect(sb?.posted).toBeUndefined();
  });

  it('draws hero\'s 1bb chip, the SB\'s dead 0.5 and the opener\'s raise', () => {
    render(<PreflopTable hero={['As', 'Kd']} position="BB" opener="BTN" raiseBb={2.3} />);
    expect(screen.getByTestId('hero-blind-chip')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('raise-chip')).toHaveTextContent(/^2\.3$/);
    expect(screen.getByText('0.5')).toBeInTheDocument();
    expect(screen.getAllByText('BB')).toHaveLength(1);
    // The BTN's raise chip takes the button's spot, so the D steps 30px aside.
    expect(screen.getByLabelText('Dealer button').style.top).toBe('220px');
  });

  it('draws an SB open as a raise chip, with no dead blind left behind', () => {
    render(<PreflopTable hero={['As', 'Kd']} position="BB" opener="SB" raiseBb={3.5} />);
    expect(screen.getByTestId('raise-chip')).toHaveTextContent(/^3\.5$/);
    expect(screen.getByText('raises 3.5bb')).toBeInTheDocument();
    expect(screen.queryByText('0.5')).not.toBeInTheDocument();
  });
});

describe('hero opened, a blind 3-bets (docs/PLAN-btn-4bet.md)', () => {
  it('folds everyone but the 3-bettor; the folded blind leaves its blind', () => {
    const seats = buildSeats('BTN', 'SB', 12.5, 'cash', true);
    expect(seats.map((s) => [s.label, s.type])).toEqual([
      ['LJ', 'folded'],
      ['HJ', 'folded'],
      ['CO', 'folded'],
      ['SB', 'opener'],
      ['BB', 'folded'],
    ]);
    expect(seats.find((s) => s.label === 'SB')).toMatchObject({ raiseBb: 12.5 });
    expect(seats.find((s) => s.label === 'BB')?.posted).toBe('bb');
  });

  it('lets the BB be the 3-bettor, with the SB\'s dead 0.5 left behind', () => {
    const seats = buildSeats('BTN', 'BB', 9.2, 'mtt', true);
    expect(seats.find((s) => s.label === 'BB')).toMatchObject({ type: 'opener', raiseBb: 9.2 });
    expect(seats.find((s) => s.label === 'SB')).toMatchObject({ type: 'folded', posted: 'sb' });
  });

  it('draws hero\'s open, the 3-bet and the dead blind, with the D stepped aside', () => {
    render(
      <PreflopTable hero={['As', 'Kd']} position="BTN" opener="SB" raiseBb={12.5} heroOpenBb={2.5} format="cash" />
    );
    expect(screen.getByTestId('hero-raise-chip')).toHaveTextContent(/^2\.5$/);
    expect(screen.getByTestId('raise-chip')).toHaveTextContent(/^12\.5$/);
    expect(screen.getByText('3-bets to 12.5bb')).toBeInTheDocument();
    // The folded BB's posted blind stays in the pot.
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-blind-chip')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Dealer button').style.top).toBe('330px');
  });
});

describe('hero opened from the LJ, a seat behind 3-bets', () => {
  it('folds the seats between and behind; the BTN keeps the D; blinds leave dead chips', () => {
    const seats = buildSeats('LJ', 'CO', 7.5, 'cash', true);
    expect(seats.map((s) => [s.label, s.type, s.posted ?? null])).toEqual([
      ['HJ', 'folded', null],
      ['CO', 'opener', null],
      ['BTN', 'folded', null],
      ['SB', 'folded', 'sb'],
      ['BB', 'folded', 'bb'],
    ]);
    expect(seats.find((s) => s.label === 'BTN')?.isBtn).toBe(true);
  });

  it('draws the in-position 3-bet, hero\'s open and both dead blinds', () => {
    render(<PreflopTable hero={['As', 'Kd']} position="HJ" opener="BTN" raiseBb={7.5} heroOpenBb={2.5} format="cash" />);
    expect(screen.getByTestId('raise-chip')).toHaveTextContent(/^7\.5$/);
    expect(screen.getByTestId('hero-raise-chip')).toHaveTextContent(/^2\.5$/);
    expect(screen.getByText('3-bets to 7.5bb')).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
