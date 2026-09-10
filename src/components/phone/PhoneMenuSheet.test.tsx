/**
 * PhoneMenuSheet — every item the desktop hamburger has, at 44px, in a sheet.
 *
 * The list is asserted exhaustively (and against DEPTHS rather than a literal),
 * because the failure this guards against is an item quietly not making the
 * crossing to the phone tree: on desktop it is still there, so nothing else
 * catches it.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderAt } from '../../test/renderAt';
import { DEPTHS, DEPTH_META } from '../../lib/preflop/ranges';
import PhoneMenuSheet from './PhoneMenuSheet';

function setup(overrides: Partial<Parameters<typeof PhoneMenuSheet>[0]> = {}) {
  const props = {
    mode: 'odds' as const,
    onModeChange: vi.fn(),
    depth: 'deep' as const,
    onDepthChange: vi.fn(),
    onOpenRanges: vi.fn(),
    onResetStats: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  renderAt('phone', <PhoneMenuSheet {...props} />);
  return props;
}

function menu() {
  return within(screen.getByRole('menu'));
}

describe('PhoneMenuSheet', () => {
  it('lists every item the desktop menu has', () => {
    setup();

    expect(menu().getByRole('menuitemradio', { name: /Odds trainer/ })).toBeInTheDocument();
    expect(menu().getByRole('menuitemradio', { name: /Preflop RFI/ })).toBeInTheDocument();

    for (const depth of DEPTHS) {
      expect(
        menu().getByRole('menuitemradio', { name: new RegExp(DEPTH_META[depth].label.replace('+', '\\+')) })
      ).toBeInTheDocument();
    }

    expect(menu().getByRole('menuitem', { name: /RFI range charts/ })).toBeInTheDocument();
    expect(menu().getByRole('menuitem', { name: /Reset stats/ })).toBeInTheDocument();

    // Two modes + three depths + charts + reset, and nothing else.
    expect(menu().getAllByRole('menuitemradio')).toHaveLength(2 + DEPTHS.length);
    expect(menu().getAllByRole('menuitem')).toHaveLength(2);
  });

  it('marks the current mode and the current depth', () => {
    setup({ mode: 'preflop', depth: 'mid' });

    expect(menu().getByRole('menuitemradio', { name: /Preflop RFI/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(menu().getByRole('menuitemradio', { name: /Odds trainer/ })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(menu().getByRole('menuitemradio', { name: /20bb/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('lists the stack depths in both modes — the context chip opens this sheet too', () => {
    setup({ mode: 'odds' });
    expect(menu().getAllByRole('menuitemradio')).toHaveLength(2 + DEPTHS.length);
  });

  it('switching mode reports it and closes', () => {
    const props = setup();
    fireEvent.click(menu().getByRole('menuitemradio', { name: /Preflop RFI/ }));

    expect(props.onModeChange).toHaveBeenCalledWith('preflop');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('switching depth reports it and closes', () => {
    const props = setup();
    fireEvent.click(menu().getByRole('menuitemradio', { name: /10bb/ }));

    expect(props.onDepthChange).toHaveBeenCalledWith('short');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('the range charts open and the sheet gets out of the way', () => {
    const props = setup();
    fireEvent.click(menu().getByRole('menuitem', { name: /RFI range charts/ }));

    expect(props.onOpenRanges).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('Reset takes two taps', () => {
    const props = setup();

    fireEvent.click(menu().getByRole('menuitem', { name: /Reset stats/ }));
    expect(props.onResetStats).not.toHaveBeenCalled();

    // The row re-labels itself rather than opening a dialog — one control, two
    // states, no second surface to dismiss.
    const armed = menu().getByRole('menuitem', { name: /Tap again to reset/ });
    fireEvent.click(armed);
    expect(props.onResetStats).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('is a PhoneSheet — footer button and × both close it', () => {
    const props = setup();

    expect(screen.getByTestId('phone-sheet-footer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Menu' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('titles itself for the door it was opened from', () => {
    setup({ title: 'Mode & depth' });
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Mode & depth');
  });
});
