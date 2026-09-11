/**
 * PhoneTopBar — the four slots, and the two handlers behind them.
 *
 * Rendered through renderAt('phone') because the whole component only exists in
 * the phone tree; jsdom is 1024 wide and would otherwise be exercising nothing
 * the phone build ever sees.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderAt } from '../../test/renderAt';
import PhoneTopBar from './PhoneTopBar';
import PhoneStatsPill from './PhoneStatsPill';

const noop = () => {};

function slots(): string[] {
  const bar = screen.getByTestId('phone-top-bar');
  return [...bar.querySelectorAll('[data-slot]')].map(
    (el) => el.getAttribute('data-slot') ?? ''
  );
}

describe('PhoneTopBar', () => {
  it('renders all four slots, in order, on one row', () => {
    renderAt(
      'phone',
      <PhoneTopBar
        contextLabel="60bb+"
        onOpenContext={noop}
        onOpenMenu={noop}
        stats={
          <PhoneStatsPill
            mode="odds"
            streak={3}
            bands={{ green: 4, amber: 2, red: 1 }}
            onPress={noop}
          />
        }
      />
    );

    expect(slots()).toEqual(['brand', 'context', 'stats', 'menu']);
    expect(screen.getByText('RUNOUT')).toBeInTheDocument();
    expect(screen.getByText('60bb+')).toBeInTheDocument();
    // The stats pill lands inside the stats slot, not loose in the bar.
    const statsSlot = screen.getByTestId('phone-top-bar').querySelector('[data-slot="stats"]');
    expect(statsSlot).toContainElement(screen.getByTestId('phone-stats-pill'));
  });

  it('renders the four slots with no stats pill supplied', () => {
    renderAt('phone', <PhoneTopBar contextLabel="Odds" onOpenContext={noop} onOpenMenu={noop} />);
    // The slot stays in the layout even when empty — it is what pushes the ⋯
    // button to the right edge, so it must not collapse out of the row.
    expect(slots()).toEqual(['brand', 'context', 'stats', 'menu']);
  });

  it('the context chip opens the mode + depth sheet', () => {
    const onOpenContext = vi.fn();
    renderAt(
      'phone',
      <PhoneTopBar contextLabel="Odds" onOpenContext={onOpenContext} onOpenMenu={noop} />
    );

    fireEvent.click(screen.getByRole('button', { name: /change mode or stack depth/i }));
    expect(onOpenContext).toHaveBeenCalledTimes(1);
  });

  it('the ⋯ button opens the menu sheet', () => {
    const onOpenMenu = vi.fn();
    renderAt(
      'phone',
      <PhoneTopBar contextLabel="Odds" onOpenContext={noop} onOpenMenu={onOpenMenu} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it('takes the context label it is given, rather than deriving one', () => {
    // The bar knows nothing about modes or depths — the parent composes the
    // string. This is the "presentation only" rule in one assertion.
    renderAt('phone', <PhoneTopBar contextLabel="10bb" onOpenContext={noop} onOpenMenu={noop} />);
    expect(screen.getByRole('button', { name: /^10bb/ })).toBeInTheDocument();
  });
});
