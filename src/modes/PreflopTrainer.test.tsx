/**
 * PreflopTrainer — render + interaction tests.
 *
 * Covers:
 *  1. Renders with a dealt spot (position label + hero cards visible).
 *  2. Open and Fold buttons are present and enabled before commit.
 *  3. Clicking Fold commits the action (buttons go away, "Next hand" appears, verdict shown).
 *  4. Clicking Open commits the action (same as above).
 *  5. Keyboard F key commits fold.
 *  6. Keyboard J key commits open.
 *  7. After commit, Space key advances to next spot (buttons re-enabled).
 *  8. After commit, clicking "Next hand" advances to next spot.
 *  9. onRecord is called once per commit with the correct boolean.
 * 10. The situation info sheet opens on mount, closes via × / Escape / backdrop,
 *     re-opens via the Info button and the I key, and swallows game keys while open.
 *
 * The info sheet is open on every mount, so tests that exercise keyboard game
 * keys close it first via closeInfo().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PreflopTrainer from './PreflopTrainer';
import * as dealModule from '../lib/preflop/deal';
import type { PreflopSpot } from '../lib/preflop/deal';

// ── Stable fake spots for deterministic tests ─────────────────────────────────

const SPOT_A: PreflopSpot = {
  position: 'BTN',
  cards: ['As', 'Kh'],
  handClass: 'AKo',
  correct: 'open',
};

const SPOT_B: PreflopSpot = {
  position: 'UTG',
  cards: ['7d', '2c'],
  handClass: '72o',
  correct: 'fold',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The info sheet is open on mount — dismiss it so game keys are live. */
function closeInfo() {
  fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));
}

/** Render the trainer with the info sheet already dismissed. */
function renderTrainer(onRecord: (wasCorrect: boolean) => void) {
  const result = render(<PreflopTrainer onRecord={onRecord} />);
  closeInfo();
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('PreflopTrainer', () => {
  let dealSpy: MockInstance<typeof dealModule.dealPreflopSpot>;
  let onRecord: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRecord = vi.fn();
    // Return SPOT_A on first call, SPOT_B on subsequent calls
    let callCount = 0;
    dealSpy = vi.spyOn(dealModule, 'dealPreflopSpot').mockImplementation(() => {
      return callCount++ === 0 ? SPOT_A : SPOT_B;
    });
  });

  afterEach(() => {
    dealSpy.mockRestore();
  });

  it('renders the position label from the initial dealt spot', () => {
    renderTrainer(onRecord);
    // BTN position should appear on the felt
    expect(screen.getByText('BTN')).toBeInTheDocument();
  });

  it('shows the hand class in the dock', () => {
    renderTrainer(onRecord);
    expect(screen.getByText('AKo')).toBeInTheDocument();
  });

  it('shows Open and Fold buttons enabled before commit', () => {
    renderTrainer(onRecord);
    const foldBtn = screen.getByRole('button', { name: /fold/i });
    const openBtn = screen.getByRole('button', { name: /open/i });
    expect(foldBtn).not.toBeDisabled();
    expect(openBtn).not.toBeDisabled();
  });

  it('committing Fold locks buttons and shows Next hand with verdict', () => {
    renderTrainer(onRecord);
    // SPOT_A has correct='open', so folding is wrong
    const foldBtn = screen.getByRole('button', { name: /fold/i });
    fireEvent.click(foldBtn);

    // Action buttons should now be absent (conditional render replaces them)
    expect(screen.queryByRole('button', { name: /fold/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open/i })).not.toBeInTheDocument();

    // Next hand button appears
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();

    // Verdict shown — wrong because SPOT_A.correct='open' but we folded
    expect(screen.getByText(/wrong — this is an open/i)).toBeInTheDocument();
  });

  it('committing Open (correct for SPOT_A) shows Correct verdict', () => {
    renderTrainer(onRecord);
    const openBtn = screen.getByRole('button', { name: /open/i });
    fireEvent.click(openBtn);

    expect(screen.queryByRole('button', { name: /open/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();
    // SPOT_A.correct='open' and we opened → Correct
    expect(screen.getByText(/correct — open/i)).toBeInTheDocument();
  });

  it('calls onRecord with true when action is correct', () => {
    renderTrainer(onRecord);
    // SPOT_A.correct = 'open'
    fireEvent.click(screen.getByRole('button', { name: /open/i }));
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(true);
  });

  it('calls onRecord with false when action is wrong', () => {
    renderTrainer(onRecord);
    // SPOT_A.correct = 'open', committing fold is wrong
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(false);
  });

  it('onRecord is called only once even on repeated key presses', () => {
    renderTrainer(onRecord);
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.keyDown(window, { key: 'f' }); // second press — already committed
    expect(onRecord).toHaveBeenCalledTimes(1);
  });

  it('F key commits fold', () => {
    renderTrainer(onRecord);
    fireEvent.keyDown(window, { key: 'f' });
    // SPOT_A.correct='open', fold is wrong
    expect(screen.getByText(/wrong — this is an open/i)).toBeInTheDocument();
  });

  it('J key commits open', () => {
    renderTrainer(onRecord);
    fireEvent.keyDown(window, { key: 'j' });
    // SPOT_A.correct='open', open is correct
    expect(screen.getByText(/correct — open/i)).toBeInTheDocument();
  });

  it('Space key after commit advances to next spot', () => {
    renderTrainer(onRecord);
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));

    // Spot A is active (BTN / AKo); pressing Space should deal SPOT_B
    fireEvent.keyDown(window, { key: ' ' });

    // Now SPOT_B should be rendered
    expect(screen.getByText('UTG')).toBeInTheDocument();
    expect(screen.getByText('72o')).toBeInTheDocument();

    // Buttons re-enabled
    expect(screen.getByRole('button', { name: /fold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('clicking Next hand button after commit advances to next spot', () => {
    renderTrainer(onRecord);
    fireEvent.click(screen.getByRole('button', { name: /open/i }));

    fireEvent.click(screen.getByRole('button', { name: /next hand/i }));

    expect(screen.getByText('UTG')).toBeInTheDocument();
    expect(screen.getByText('72o')).toBeInTheDocument();
  });

  it('keys are ignored when a modifier is held', () => {
    renderTrainer(onRecord);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    // Should not commit — Open/Fold buttons still visible
    expect(screen.getByRole('button', { name: /fold/i })).toBeInTheDocument();
  });

  it('repeated F press does not re-commit after first commit', () => {
    renderTrainer(onRecord);
    fireEvent.keyDown(window, { key: 'f' });
    // Second F press while committed — should be a no-op
    fireEvent.keyDown(window, { key: 'f' });
    // Still in committed state (Next hand visible, not Open/Fold)
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();
  });

  it('shows Correct verdict for fold when spot.correct is fold (SPOT_B)', () => {
    // Override: start with SPOT_B directly (fold = correct)
    let called = false;
    dealSpy.mockImplementation(() => {
      if (!called) { called = true; return SPOT_B; }
      return SPOT_A;
    });
    renderTrainer(onRecord);
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    expect(screen.getByText(/correct — fold/i)).toBeInTheDocument();
    expect(onRecord).toHaveBeenCalledWith(true);
  });

  // ── Situation info sheet ──────────────────────────────────────────────────

  it('opens the situation info sheet on mount', () => {
    render(<PreflopTrainer onRecord={onRecord} />);
    expect(screen.getByText('Open or fold, first in')).toBeInTheDocument();
    expect(
      screen.getByText(/9-handed tournament table · ~60bb effective/i),
    ).toBeInTheDocument();
  });

  it('closes the info sheet with the × button', () => {
    render(<PreflopTrainer onRecord={onRecord} />);
    fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));
    expect(screen.queryByText('Open or fold, first in')).not.toBeInTheDocument();
  });

  it('closes the info sheet with Escape', () => {
    render(<PreflopTrainer onRecord={onRecord} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Open or fold, first in')).not.toBeInTheDocument();
  });

  it('re-opens the info sheet via the Info button', () => {
    renderTrainer(onRecord);
    expect(screen.queryByText('Open or fold, first in')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^i info$/i }));
    expect(screen.getByText('Open or fold, first in')).toBeInTheDocument();
  });

  it('re-opens the info sheet with the I key', () => {
    renderTrainer(onRecord);
    fireEvent.keyDown(window, { key: 'i' });
    expect(screen.getByText('Open or fold, first in')).toBeInTheDocument();
  });

  it('the Info button is available after committing too', () => {
    renderTrainer(onRecord);
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    fireEvent.click(screen.getByRole('button', { name: /^i info$/i }));
    expect(screen.getByText('Open or fold, first in')).toBeInTheDocument();
  });

  it('game keys do nothing while the info sheet is open', () => {
    render(<PreflopTrainer onRecord={onRecord} />);
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.keyDown(window, { key: 'j' });
    expect(onRecord).not.toHaveBeenCalled();
    // Still uncommitted — the action buttons are still on screen
    expect(screen.getByRole('button', { name: /fold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
  });

  it('opening the range sheet closes the info sheet', () => {
    renderTrainer(onRecord);
    fireEvent.click(screen.getByRole('button', { name: /fold/i }));
    fireEvent.click(screen.getByRole('button', { name: /^i info$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^r range$/i }));
    expect(screen.queryByText('Open or fold, first in')).not.toBeInTheDocument();
    expect(screen.getByText(/opening range/i)).toBeInTheDocument();
  });
});
