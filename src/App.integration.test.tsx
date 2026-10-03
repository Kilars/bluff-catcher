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

describe('facing mode', () => {
  it('routes to the facing trainer, and records into its own stats key, not RFI\'s', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'facing');
    renderAt('desktop', <App />);

    // First visit: the facing briefing, not an RFI one.
    expect(screen.getByText(/JJ and TT always call/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));

    expect(screen.getByTestId('raise-chip')).toBeInTheDocument();
    expect(screen.queryByText('Villain')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^3-bet$/ }));
    expect(screen.getByTestId('verdict')).toHaveTextContent(/^(Correct|Wrong) — /);
    expect(JSON.parse(localStorage.getItem('bluff-catcher:facing:v1')!).hands).toBe(1);
    expect(localStorage.getItem('bluff-catcher:preflop:v1')).toBeNull();
  });

  it('renders the phone facing trainer with three thumb buttons', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'facing');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['facing']));
    renderAt('phone', <App />);

    expect(screen.getByTestId('phone-facing-trainer')).toBeInTheDocument();
    expect(screen.getByTestId('decision-fold')).toBeInTheDocument();
    expect(screen.getByTestId('decision-call')).toBeInTheDocument();
    expect(screen.getByTestId('decision-3bet')).toBeInTheDocument();
  });

  it('is reachable from the desktop menu, and switching to it persists', () => {
    renderAt('desktop', <App />);

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Facing open/ }));

    expect(screen.getByRole('button', { name: /^Call$/ })).toBeInTheDocument();
    expect(localStorage.getItem('bluff-catcher:mode:v1')).toBe('facing');
  });

  it('is reachable from the phone menu, and the phone menu has no depth group there', () => {
    renderAt('phone', <App />);

    fireEvent.click(screen.getByRole('button', { name: /more|menu/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Facing open/ }));

    expect(screen.getByTestId('phone-top-bar')).toHaveTextContent(/vs open/);

    fireEvent.click(screen.getByRole('button', { name: /more|menu/i }));
    expect(screen.queryByRole('menuitemradio', { name: /60bb\+/ })).not.toBeInTheDocument();
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

describe('"Show the draw" — the whole wire, root to tree', () => {
  // The preference is persisted in useAppPrefs, flipped in two different menus
  // and consumed in two different trees. Each end has its own test; this is the
  // only place the wire between them is exercised.

  it('names the draw before the commit by default, on phone', () => {
    renderAt('phone', <App />);
    expect(screen.getByTestId('phone-draw-preview')).toBeInTheDocument();
  });

  it('names the draw before the commit by default, on desktop', () => {
    renderAt('desktop', <App />);
    expect(screen.getByTestId('dock-draw-preview')).toBeInTheDocument();
  });

  it('hides it from the phone menu, and remembers that', () => {
    const first = renderAt('phone', <App />);

    fireEvent.click(screen.getByRole('button', { name: /more|menu/i }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Show the draw/ }));

    expect(screen.queryByTestId('phone-draw-preview')).not.toBeInTheDocument();
    first.unmount();

    // Second launch: still hidden, because the choice outlives the session.
    renderAt('phone', <App />);
    expect(screen.queryByTestId('phone-draw-preview')).not.toBeInTheDocument();
  });

  it('hides it from the desktop menu', () => {
    renderAt('desktop', <App />);

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Show the draw/ }));

    expect(screen.queryByTestId('dock-draw-preview')).not.toBeInTheDocument();
  });

  it('offers the toggle in odds mode only — it means nothing to the preflop drill', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'preflop');
    renderAt('desktop', <App />);

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(
      screen.queryByRole('menuitemcheckbox', { name: /Show the draw/ })
    ).not.toBeInTheDocument();
  });
});


describe('cash format', () => {
  it('switches the RFI drill to cash from the desktop menu, persists, and keeps stats apart', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'preflop');
    localStorage.setItem('bluff-catcher:preflop-depth:v1', 'short');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['short']));
    renderAt('desktop', <App />);
    // Desktop RFI still briefs on every mount; close it.
    fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));

    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Cash/ }));
    expect(localStorage.getItem('bluff-catcher:format:v1')).toBe('cash');
    // The stored tier is kept for the return to tournament.
    expect(localStorage.getItem('bluff-catcher:preflop-depth:v1')).toBe('short');

    // Cash briefing, then a hand graded into the cash key only.
    expect(screen.getByText(/6-max cash table/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));
    expect(screen.getByText('Preflop RFI · Cash')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fold$/ }));
    expect(JSON.parse(localStorage.getItem('bluff-catcher:preflop-cash:v1')!).hands).toBe(1);
    expect(localStorage.getItem('bluff-catcher:preflop:v1')).toBeNull();

    // No depth group in cash.
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(screen.queryByRole('menuitem', { name: /10bb/ })).not.toBeInTheDocument();
  });

  it('restores cash on reload and deals the facing drill on a 6-max ring', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'facing');
    localStorage.setItem('bluff-catcher:format:v1', 'cash');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['facing-cash']));
    renderAt('desktop', <App />);

    expect(screen.getByText(/Facing open · vs open · Cash 100bb/)).toBeInTheDocument();
    // 6-max: no UTG seats on the felt.
    expect(screen.queryByText('UTG+1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^3-bet$/ }));
    // Cash charts carry no value/bluff label.
    expect(screen.getByTestId('verdict')).not.toHaveTextContent(/\((value|bluff)\)/);
    expect(JSON.parse(localStorage.getItem('bluff-catcher:facing-cash:v1')!).hands).toBe(1);
    expect(localStorage.getItem('bluff-catcher:facing:v1')).toBeNull();
  });

  it('shows "Cash" on the phone chip in the facing drill', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'facing');
    localStorage.setItem('bluff-catcher:format:v1', 'cash');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['facing-cash']));
    renderAt('phone', <App />);
    expect(screen.getByTestId('phone-top-bar')).toHaveTextContent(/Cash/);
    expect(screen.getAllByTestId('seat-slot')).toHaveLength(6);
  });
});

describe('BB defend mode (docs/PLAN-bb-defend.md)', () => {
  it('restores on reload, briefs once, seats hero in the BB and keeps its own stats', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'bbdefend');
    renderAt('desktop', <App />);

    expect(screen.getByText('Fold, call or 3-bet in the big blind')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));
    expect(JSON.parse(localStorage.getItem('bluff-catcher:briefed:v1')!)).toContain('bbdefend');

    expect(screen.getByText('BB defend · 40bb')).toBeInTheDocument();
    expect(screen.getByTestId('raise-chip')).toBeInTheDocument();
    expect(screen.getByTestId('hero-blind-chip')).toHaveTextContent(/^1$/);
    expect(screen.getByText(/Folds to you in the big blind/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Call$/ }));
    expect(screen.getByTestId('verdict')).toHaveTextContent(/^(Correct|Wrong) — /);
    expect(JSON.parse(localStorage.getItem('bluff-catcher:bbdefend:v1')!).hands).toBe(1);
    expect(localStorage.getItem('bluff-catcher:facing:v1')).toBeNull();
  });

  it('deals cash on a 6-max ring with its own stats key', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'bbdefend');
    localStorage.setItem('bluff-catcher:format:v1', 'cash');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['bbdefend-cash']));
    renderAt('desktop', <App />);

    expect(screen.getByText('BB defend · Cash 100bb')).toBeInTheDocument();
    expect(screen.getByTestId('hero-blind-chip')).toHaveTextContent(/^1$/);
    expect(screen.queryByText('UTG')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Fold$/ }));
    expect(JSON.parse(localStorage.getItem('bluff-catcher:bbdefend-cash:v1')!).hands).toBe(1);
    expect(localStorage.getItem('bluff-catcher:bbdefend:v1')).toBeNull();
  });

  it('renders the phone tree with hero last on the ladder and a short chip', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'bbdefend');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['bbdefend']));
    renderAt('phone', <App />);

    expect(screen.getByTestId('phone-facing-trainer')).toBeInTheDocument();
    const slots = screen.getAllByTestId('seat-slot');
    expect(slots.at(-1)).toHaveAttribute('data-label', 'BB');
    expect(slots.at(-1)).toHaveAttribute('data-state', 'hero');
    expect(screen.getByText('BB 40bb')).toBeInTheDocument();
  });

  it('is reachable from the desktop menu, and switching to it persists', () => {
    renderAt('desktop', <App />);
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /BB defend/ }));
    expect(localStorage.getItem('bluff-catcher:mode:v1')).toBe('bbdefend');
    expect(screen.getByText('Fold, call or 3-bet in the big blind')).toBeInTheDocument();
  });
});

describe('BTN vs 3-bet mode (docs/PLAN-btn-4bet.md)', () => {
  it('restores on reload, briefs once, shows hero\'s open and the 3-bet, and keeps its own stats', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'btn4bet');
    localStorage.setItem('bluff-catcher:format:v1', 'cash');
    renderAt('desktop', <App />);

    expect(screen.getByText('Fold, call or 4-bet on the button')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));
    expect(JSON.parse(localStorage.getItem('bluff-catcher:briefed:v1')!)).toContain('btn4bet-cash');

    expect(screen.getByText('BTN vs 3-bet · Cash 100bb')).toBeInTheDocument();
    expect(screen.getByTestId('hero-raise-chip')).toHaveTextContent(/^2\.5$/);
    expect(screen.getByTestId('raise-chip')).toHaveTextContent(/^12\.5$/);
    expect(screen.getByText(/You open 2\.5bb, (SB|BB) 3-bets to 12\.5bb\. Fold, call or 4-bet \(25bb\)\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /4-bet$/ }));
    expect(screen.getByTestId('verdict')).toHaveTextContent(/^(Correct|Wrong) — /);
    expect(JSON.parse(localStorage.getItem('bluff-catcher:btn4bet-cash:v1')!).hands).toBe(1);
    expect(localStorage.getItem('bluff-catcher:facing-cash:v1')).toBeNull();
  });

  it('renders the phone tree with a 4-bet thumb button and the 3-bettor on the ladder', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'btn4bet');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['btn4bet']));
    renderAt('phone', <App />);

    expect(screen.getByTestId('phone-top-bar')).toHaveTextContent('vs 3b');
    expect(screen.getByTestId('ladder-context')).toHaveTextContent(/^(SB|BB) 3-bets to 9\.2bb · 40bb$/);
    expect(screen.getByText('Fold, call or 4-bet (all-in)?')).toBeInTheDocument();
    const opener = screen.getAllByTestId('seat-slot').find((s) => s.getAttribute('data-state') === 'opener')!;
    expect(['SB', 'BB']).toContain(opener.getAttribute('data-label'));
    fireEvent.click(screen.getByTestId('decision-4bet'));
    expect(JSON.parse(localStorage.getItem('bluff-catcher:btn4bet:v1')!).hands).toBe(1);
  });
});

describe('Open vs 3-bet mode (cash only)', () => {
  it('plays cash even with the tournament switch on, hero opens and a seat behind 3-bets', () => {
    localStorage.setItem('bluff-catcher:mode:v1', 'open4bet');
    localStorage.setItem('bluff-catcher:briefed:v1', JSON.stringify(['open4bet']));
    renderAt('desktop', <App />);

    expect(screen.getByText('Open vs 3-bet · Cash 100bb')).toBeInTheDocument();
    expect(screen.queryByText('UTG')).not.toBeInTheDocument();
    expect(screen.getByTestId('hero-raise-chip')).toHaveTextContent(/^2\.5$/);
    expect(screen.getByText(/You open 2\.5bb, (HJ|CO|BTN|SB|BB) 3-bets to (7\.5|12\.5)bb\. Fold, call or 4-bet \((19|25)bb\)\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /4-bet$/ }));
    expect(JSON.parse(localStorage.getItem('bluff-catcher:open4bet:v1')!).hands).toBe(1);
  });
});
