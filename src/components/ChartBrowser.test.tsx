/**
 * ChartBrowser — the format, spot and stack strips over the range views: the
 * menu's browser reaches every RFI tier and seat pair, and a trainer's sheet
 * opens on its graded charts with the dealt pair one tap away.
 */

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { renderAt } from '../test/renderAt';
import ChartBrowser from './ChartBrowser';
import { facingChartPages } from '../hooks/useFacingDrill';

const strip = (name: string) => within(screen.getByRole('tablist', { name }));
const tabs = (name: string) => strip(name).getAllByRole('tab').map((t) => t.textContent);
const pick = (name: string, tab: string | RegExp) => fireEvent.click(strip(name).getByRole('tab', { name: tab }));
const selected = (name: string) => strip(name).getByRole('tab', { selected: true }).textContent;
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
  it('stacks format, spot and stack above the seats, with no Versus on Open', () => {
    menu();
    expect(tabs('Format')).toEqual(['Tournament', 'Cash']);
    expect(tabs('Spot')).toEqual(['Open', '3-bet', '4-bet']);
    expect(tabs('Stack')).toEqual(['60bb+Deep', '20bbMid', '10bbShort']);
    // The sheet's own tier strip is the browser's now.
    expect(screen.queryByRole('tablist', { name: 'Chart' })).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Position' })).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: /vs$/ })).toBeNull();

    const deep = combos();
    pick('Stack', /10bb/);
    expect(combos()).not.toBe(deep);
  });

  it('hides Stack on cash and keeps the tournament tier and seat for the way back', () => {
    menu();
    pick('Stack', /20bb/);
    pick('Position', /^CO/);
    pick('Format', 'Cash');
    expect(screen.queryByRole('tablist', { name: 'Stack' })).toBeNull();
    expect(tabs('Position')).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB']);
    expect(selected('Position')).toBe('CO');

    pick('Format', 'Tournament');
    expect(selected('Stack')).toMatch(/^20bb/);
    expect(selected('Position')).toBe('CO');
  });

  it('pages 3-bet pairs by your seat and the opener, with the BTN-only 50bb+ pack', () => {
    menu();
    pick('Spot', '3-bet');
    expect(tabs('Stack')).toEqual(['40bb', '50bb+BTN only']);
    expect(selected('Stack')).toBe('40bb');

    pick('Your seat', /^CO/);
    expect(tabs('CO vs')).toEqual(['vs UTG', 'vs UTG+1', 'vs UTG+2', 'vs LJ', 'vs HJ']);

    pick('Stack', /50bb\+/);
    // One seat, still on the strip, so the position row doesn't vanish.
    expect(tabs('Your seat')).toEqual(['BTN6 charts']);
    expect(title()).toMatch(/^BTN vs .* open$/);
  });

  it('pages 4-bet pairs on 40bb with no stack choice, and keeps 50bb+ for 3-bet', () => {
    menu();
    pick('Spot', '3-bet');
    pick('Stack', /50bb\+/);
    pick('Spot', '4-bet');
    expect(screen.queryByRole('tablist', { name: 'Stack' })).toBeNull();
    pick('Your seat', /^CO/);
    expect(tabs('CO vs')).toEqual(['vs BTN', 'vs SB', 'vs BB']);
    pick('CO vs', 'vs SB');
    expect(title()).toBe('CO opens, SB 3-bets');

    pick('Spot', '3-bet');
    expect(selected('Stack')).toMatch(/^50bb\+/);
  });

  it('opens the facing spots on the cash grid in cash, with no stack strip', () => {
    menu('cash');
    expect(selected('Format')).toBe('Cash');
    pick('Spot', '3-bet');
    expect(screen.queryByRole('tablist', { name: 'Stack' })).toBeNull();
    expect(title()).toBe('HJ vs LJ open');
  });

  it('drives the phone view from the same strips', () => {
    renderAt(
      'phone',
      <ChartBrowser layout="phone" format="mtt" depth="deep" title="Range charts" onClose={() => {}} />
    );
    expect(screen.queryByTestId('depth-chip')).toBeNull();
    expect(screen.queryByRole('tablist', { name: 'Chart' })).toBeNull();
    pick('Format', 'Cash');
    expect(tabs('Position')).toEqual(['LJ', 'HJ', 'CO', 'BTN', 'SB']);

    pick('Format', 'Tournament');
    pick('Spot', '3-bet');
    expect(screen.getByTestId('chart-title').textContent).toBe('UTG+1 vs UTG open');
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
    expect(screen.queryByRole('tablist', { name: 'Stack' })).toBeNull();
    expect(title()).toBe(pages[1].title);

    pick('Spot', '4-bet');
    expect(title()).toBe('BTN opens, BB 3-bets');
    expect(screen.getByText(/Your hand: AKo/)).toBeInTheDocument();
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
    expect(selected('Stack')).toMatch(/^50bb\+/);
    expect(title()).toBe('BTN vs CO open');
    expect(screen.getByText(/Your hand: AKo/)).toBeInTheDocument();
  });
});
