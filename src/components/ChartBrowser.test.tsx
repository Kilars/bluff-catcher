/**
 * ChartBrowser — the format, spot, stack, seat and versus rows over the range
 * views: the menu's browser reaches every RFI tier and seat pair, greying what
 * doesn't apply instead of hiding it, and a trainer's sheet opens on its
 * graded charts with the dealt pair one tap away.
 */

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { renderAt } from '../test/renderAt';
import ChartBrowser from './ChartBrowser';
import { facingChartPages } from '../hooks/useFacingDrill';

const strip = (name: string) => within(screen.getByRole('tablist', { name }));
const tabs = (name: string) => strip(name).getAllByRole('tab').map((t) => t.textContent);
const pick = (name: string, tab: string | RegExp) => fireEvent.click(strip(name).getByRole('tab', { name: tab }));
const selected = (name: string) => strip(name).queryByRole('tab', { selected: true })?.textContent ?? null;
const live = (name: string) =>
  strip(name)
    .getAllByRole('tab')
    .filter((t) => t.getAttribute('aria-disabled') !== 'true')
    .map((t) => t.textContent);
const title = () => screen.getByRole('heading', { level: 1 }).textContent ?? '';
const combos = () => screen.getByText(/combos ·/).textContent;

const menu = (format: 'mtt' | 'cash' = 'mtt') =>
  render(
    <ChartBrowser
      layout="desktop"
      format={format}
      depth={format === 'cash' ? 'cash' : 'deep'}
      title="Range charts"
      onClose={() => {}}
    />
  );

describe('ChartBrowser (menu)', () => {
  it('shows every row on Open, with Versus greyed and the tier picked on Stack', () => {
    menu();
    expect(tabs('Format')).toEqual(['Tournament', 'Cash']);
    expect(tabs('Spot')).toEqual(['Open', '3-bet', '4-bet']);
    expect(tabs('Stack')).toEqual(['10bb', '20bb', '40bb', '50bb+', '60bb+']);
    expect(live('Stack')).toEqual(['10bb', '20bb', '60bb+']);
    expect(selected('Stack')).toBe('60bb+');
    expect(tabs('You')).toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(tabs('Versus')).toEqual(tabs('You'));
    expect(live('Versus')).toEqual([]);
    expect(selected('Versus')).toBeNull();
    // The views' own strips are the browser's now.
    expect(screen.queryByRole('tablist', { name: 'Chart' })).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Position' })).toBeNull();

    const deep = combos();
    pick('Stack', '10bb');
    expect(combos()).not.toBe(deep);
    pick('You', 'CO');
    expect(title()).toBe('Cutoff (CO)');
  });

  it('ignores a greyed tab', () => {
    menu();
    pick('You', 'BB');
    expect(selected('You')).toBe('UTG');
    pick('Versus', 'UTG');
    expect(selected('Versus')).toBeNull();
  });

  it('drops Stack and the 9-max seats on cash, and keeps the tournament tier and seat for the way back', () => {
    menu();
    pick('Stack', '20bb');
    pick('You', 'CO');
    pick('Format', 'Cash');
    expect(screen.queryByRole('tablist', { name: 'Stack' })).toBeNull();
    expect(tabs('You')).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(selected('You')).toBe('CO');

    pick('Format', 'Tournament');
    expect(selected('Stack')).toBe('20bb');
    expect(selected('You')).toBe('CO');
  });

  it('picks a 3-bet pair by your seat and the opener, with the BTN-only 50bb+ pack', () => {
    menu();
    pick('You', 'CO');
    pick('Spot', '3-bet');
    expect(live('Stack')).toEqual(['40bb', '50bb+']);
    expect(selected('Stack')).toBe('40bb');
    expect(live('Versus')).toEqual(['UTG', 'UTG1', 'UTG2', 'LJ', 'HJ']);
    // The nearest opener: your right-hand neighbour.
    expect(title()).toBe('CO vs HJ open');
    pick('Versus', 'UTG');
    expect(title()).toBe('CO vs UTG open');

    pick('Stack', '50bb+');
    expect(live('You')).toEqual(['BTN']);
    expect(title()).toMatch(/^BTN vs .* open$/);
  });

  it('picks 4-bet pairs on 40bb only, and keeps 50bb+ for 3-bet', () => {
    menu();
    pick('Spot', '3-bet');
    pick('Stack', '50bb+');
    pick('Spot', '4-bet');
    expect(live('Stack')).toEqual(['40bb']);
    pick('You', 'CO');
    expect(live('Versus')).toEqual(['BTN', 'SB', 'BB']);
    pick('Versus', 'SB');
    expect(title()).toBe('CO opens, SB 3-bets');

    pick('Spot', '3-bet');
    expect(selected('Stack')).toBe('50bb+');
  });

  it('steps the picked pair with the arrows', () => {
    menu();
    pick('Spot', '3-bet');
    expect(title()).toBe('UTG+1 vs UTG open');
    fireEvent.click(screen.getByRole('button', { name: 'Next chart' }));
    expect(title()).toBe('UTG+2 vs UTG open');
    expect(selected('You')).toBe('UTG2');
    expect(selected('Versus')).toBe('UTG');
  });

  it('opens the facing spots on the cash grid in cash', () => {
    menu('cash');
    expect(selected('Format')).toBe('Cash');
    pick('Spot', '3-bet');
    expect(title()).toBe('HJ vs LJ open');
  });

  it('drives the phone view from the same rows', () => {
    renderAt(
      'phone',
      <ChartBrowser layout="phone" format="mtt" depth="deep" title="Range charts" onClose={() => {}} />
    );
    expect(screen.queryByTestId('depth-chip')).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Position' })).toBeNull();
    pick('Format', 'Cash');
    expect(live('You')).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB']);

    pick('Format', 'Tournament');
    pick('Spot', '3-bet');
    // UTG came back from cash as the LJ, and the nearest opener is UTG+2.
    expect(screen.getByTestId('chart-title').textContent).toBe('LJ vs UTG+2 open');
    pick('You', 'BTN');
    pick('Versus', 'CO');
    expect(screen.getByTestId('chart-title').textContent).toBe('BTN vs CO open');
  });
});

describe('ChartBrowser (trainer)', () => {
  const pages = facingChartPages('mtt', 'fourbet', '4-bet');
  const spot = { node: 'vs3bet', setId: 'mtt40', hero: 'BTN', villain: 'BB', hand: 'AKo' } as const;
  const trainer = (s: typeof spot | { node: 'vsOpen'; setId: string; hero: 'BTN'; villain: 'CO'; hand: 'AKo' } = spot) =>
    render(
      <ChartBrowser
        layout="desktop"
        format="mtt"
        depth="deep"
        drill={{ pages, startPage: 1, seat: 'BTN' }}
        spot={s}
        title="4-bet"
        onClose={() => {}}
      />
    );

  it('opens on the drill charts, and the 4-bet spot on the dealt pair with the hand marked', () => {
    trainer();
    expect(tabs('Spot')).toEqual(['Drill', 'Open', '3-bet', '4-bet']);
    expect(selected('Spot')).toBe('Drill');
    expect(selected('Format')).toBe('Tournament');
    // Drill keeps its own seat and chart tabs in place of the rows below Spot.
    expect(screen.queryByRole('tablist', { name: 'Stack' })).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'You' })).toBeNull();
    expect(title()).toBe(pages[1].title);

    pick('Spot', '4-bet');
    expect(title()).toBe('BTN opens, BB 3-bets');
    expect(screen.getByText(/Your hand: AKo/)).toBeInTheDocument();
    expect(strip('Versus').getByLabelText('(dealt)')).toBeInTheDocument();

    // Another raiser is not the hand's chart.
    pick('Versus', 'SB');
    expect(screen.queryByText(/Your hand/)).toBeNull();

    // Nor is another seat: the raiser's dot goes with it.
    pick('You', 'CO');
    expect(strip('Versus').queryByLabelText('(dealt)')).toBeNull();
    expect(strip('You').getByLabelText('(dealt)')).toBeInTheDocument();
  });

  it('leaves the drill for its own decision when a format is picked', () => {
    trainer();
    pick('Format', 'Cash');
    expect(selected('Spot')).toBe('4-bet');
    // A tournament hand isn't marked on a cash chart.
    expect(screen.queryByText(/Your hand/)).toBeNull();
  });

  it('stays on the drill when its own format is picked, and resets the format on the way back', () => {
    trainer();
    pick('Format', 'Tournament');
    expect(selected('Spot')).toBe('Drill');
    pick('Format', 'Cash');
    pick('Spot', 'Drill');
    expect(selected('Format')).toBe('Tournament');
    pick('Spot', 'Open');
    expect(screen.getByRole('tablist', { name: 'Stack' })).toBeInTheDocument();
  });

  it('opens a 50bb+ spot on 50bb+ with the hand marked', () => {
    trainer({ node: 'vsOpen', setId: 'mtt50', hero: 'BTN', villain: 'CO', hand: 'AKo' });
    pick('Spot', '3-bet');
    expect(selected('Stack')).toBe('50bb+');
    expect(title()).toBe('BTN vs CO open');
    expect(screen.getByText(/Your hand: AKo/)).toBeInTheDocument();
  });
});
