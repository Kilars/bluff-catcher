/**
 * ChartBrowser — the decision strip over the range views: the menu's browser
 * reaches every seat pair, and a trainer's sheet opens on its graded charts
 * with the dealt pair one tap away.
 */

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { renderAt } from '../test/renderAt';
import ChartBrowser from './ChartBrowser';
import { facingChartPages } from '../hooks/useFacingDrill';

const decision = () => within(screen.getByRole('tablist', { name: 'Decision' }));
const title = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';

describe('ChartBrowser (menu)', () => {
  it('opens on the RFI charts and switches to any seat pair', () => {
    render(<ChartBrowser layout="desktop" format="mtt" depth="deep" title="Range charts" onClose={() => {}} />);
    expect(decision().getAllByRole('tab').map((t) => t.textContent)).toEqual(['Open', 'vs open', 'vs 3-bet']);
    expect(screen.getByRole('tablist', { name: 'Position' })).toBeInTheDocument();

    fireEvent.click(decision().getByRole('tab', { name: 'vs 3-bet' }));
    const sources = within(screen.getByRole('tablist', { name: 'Source' }));
    // 50bb+ has no 3-bet pots, so it is not offered here.
    expect(sources.getAllByRole('tab')).toHaveLength(2);
    expect(sources.getByRole('tab', { name: /40bb/ })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(within(screen.getByRole('tablist', { name: 'Your seat' })).getByRole('tab', { name: /^CO/ }));
    const raisers = within(screen.getByRole('tablist', { name: 'CO vs' }));
    expect(raisers.getAllByRole('tab').map((t) => t.textContent)).toEqual(['vs BTN', 'vs SB', 'vs BB']);
    fireEvent.click(raisers.getByRole('tab', { name: 'vs SB' }));
    expect(title()).toBe('CO opens, SB 3-bets');
  });

  it('opens the facing views on the cash grid in cash', () => {
    render(<ChartBrowser layout="desktop" format="cash" depth="cash" title="Range charts" onClose={() => {}} />);
    fireEvent.click(decision().getByRole('tab', { name: 'vs open' }));
    expect(screen.getByRole('tab', { name: /100bb/ })).toHaveAttribute('aria-selected', 'true');
    expect(title()).toBe('HJ vs LJ open');
  });

  it('pages pairs on the phone too', () => {
    renderAt(
      'phone',
      <ChartBrowser layout="phone" format="mtt" depth="deep" title="Range charts" onClose={() => {}} />
    );
    fireEvent.click(decision().getByRole('tab', { name: 'vs open' }));
    expect(screen.getByTestId('chart-title').textContent).toBe('UTG+1 vs UTG open');
  });
});

describe('ChartBrowser (trainer)', () => {
  const pages = facingChartPages('mtt', 'fourbet', '4-bet');
  const spot = { node: 'vs3bet', setId: 'mtt40', hero: 'BTN', villain: 'BB', hand: 'AKo' } as const;

  it('opens on the drill charts, and the pair view on the dealt pair with the hand marked', () => {
    render(
      <ChartBrowser
        layout="desktop"
        format="mtt"
        depth="deep"
        drill={{ pages, startPage: 1, seat: 'BTN' }}
        spot={spot}
        title="4-bet"
        onClose={() => {}}
      />
    );
    expect(decision().getByRole('tab', { name: 'Drill' })).toHaveAttribute('aria-selected', 'true');
    expect(title()).toBe(pages[1].title);

    fireEvent.click(decision().getByRole('tab', { name: 'vs 3-bet' }));
    expect(title()).toBe('BTN opens, BB 3-bets');
    expect(screen.getByText(/Your hand: AKo/)).toBeInTheDocument();
  });
});
