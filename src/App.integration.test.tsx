/**
 * App — the layout seam.
 *
 * Every phase before this one was additive: the phone tree existed but nothing
 * routed to it. These tests cover the routing itself, which is the part that
 * regresses silently — a tree still renders, it is merely the wrong one, and
 * every other test in the suite would stay green.
 *
 * jsdom has no matchMedia and reports a 1024px viewport, so without renderAt()
 * all of this would quietly assert the desktop tree twice.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, act, fireEvent } from '@testing-library/react';
import { renderAt, clearLayoutMode } from './test/renderAt';
import App from './App';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  clearLayoutMode();
});

describe('App layout routing', () => {
  it('renders the phone tree below 600px, and no felt with it', () => {
    renderAt('phone', <App />);

    expect(screen.getByTestId('phone-odds-frame')).toBeInTheDocument();
    // The felt is the thing the phone design deletes — its villain seat is the
    // cheapest proof the desktop tree is not also mounted.
    expect(screen.queryByText('Villain')).not.toBeInTheDocument();
  });

  it('renders the desktop tree at 1024px, and no phone chrome with it', () => {
    renderAt('desktop', <App />);

    expect(screen.getByText('Villain')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-odds-frame')).not.toBeInTheDocument();
  });

  it('keeps the compact band (600–1023px) on the desktop tree', () => {
    // A 768px iPad wants desktop chrome with a smaller felt, which --felt-scale
    // already delivers. This is the band that used to get the phone layout
    // because 820 was the felt's asset width. See docs/PLAN-phone.md §4.1.
    renderAt('compact', <App />);

    expect(screen.getByText('Villain')).toBeInTheDocument();
    expect(screen.queryByTestId('phone-odds-frame')).not.toBeInTheDocument();
  });

  it('swaps trees on rotation without remounting the app', () => {
    const { dispatch } = renderAt('desktop', <App />);
    expect(screen.getByText('Villain')).toBeInTheDocument();

    // The MediaQueryList change fires outside React's batching, so the
    // subscription's state update needs an explicit flush.
    act(() => dispatch('phone'));

    expect(screen.getByTestId('phone-odds-frame')).toBeInTheDocument();
    expect(screen.queryByText('Villain')).not.toBeInTheDocument();
  });

  it('stamps data-layout on <html> for the stylesheets to key off', () => {
    renderAt('phone', <App />);
    expect(document.documentElement.dataset.layout).toBe('phone');
  });
});

describe('the explanation is reachable on phone', () => {
  // DECISIONS.md calls this sheet core product — it is what teaches the rule of
  // 2 and 4. The phone tree raises [?] but does not mount the sheet itself, so
  // the mode component has to, and nothing else in the suite would notice if it
  // stopped: the button would still be there, and still do nothing.
  it('opens the explain sheet from the commit bar', () => {
    renderAt('phone', <App />);

    // Commit via the bar's keyboard path — the drag path needs stubbed
    // geometry, and the point here is the sheet, not the gesture.
    const field = screen.getByTestId('phone-drag-field');
    fireEvent.keyDown(field, { key: 'ArrowRight' });
    fireEvent.keyDown(field, { key: 'Enter' });

    fireEvent.click(screen.getByRole('button', { name: /how is this counted/i }));

    // The sheet's title is generated per hand; its kicker is the fixed part.
    expect(screen.getByText(/How it.s counted/i)).toBeInTheDocument();
  });
});

describe('phone drops what a phone cannot use', () => {
  it('shows no keyboard hints in the preflop briefing', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'preflop');
    renderAt('phone', <App />);

    // The briefing itself should be up on a first run…
    expect(screen.getByText(/the situation/i)).toBeInTheDocument();
    // …but the key card is instructions for hardware that isn't there.
    expect(screen.queryByText('Keys')).not.toBeInTheDocument();
    expect(screen.queryByText('Next hand')).not.toBeInTheDocument();
  });

  it('keeps the key hints on desktop', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'preflop');
    renderAt('desktop', <App />);

    expect(screen.getByText('Keys')).toBeInTheDocument();
  });

  it('briefs a tier once on phone, not on every launch', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'preflop');

    const first = renderAt('phone', <App />);
    expect(screen.getByText(/the situation/i)).toBeInTheDocument();
    first.unmount();

    // Same tier, second launch: straight into the drill.
    renderAt('phone', <App />);
    expect(screen.queryByText(/the situation/i)).not.toBeInTheDocument();
  });
});
