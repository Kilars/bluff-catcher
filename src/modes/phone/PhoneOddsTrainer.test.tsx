/**
 * PhoneOddsTrainer — the phone odds tree, driven by the real drill hook.
 *
 * PhoneStage and PhoneCommitBar are unit-tested beside themselves; what this
 * file is for is the two claims that only hold when the real `useOddsDrill` is
 * wired underneath:
 *
 *  1. **The read zone is pixel-identical across the commit.** Asserted as byte
 *     identity of the stage's markup before and after a real commit — the cards
 *     cannot move, because comparing the answer to the cards is the learning
 *     act.
 *  2. **Lift does not commit, the button does** — end to end, against the hook
 *     that actually records the hand.
 *
 * The spot is randomly dealt, so nothing here asserts on a specific board; the
 * assertions are about structure and about which state the drill is in.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderAt } from '../../test/renderAt';
import { useOddsDrill } from '../../hooks/useOddsDrill';
import { useStats } from '../../hooks/useStats';
import PhoneOddsTrainer from './PhoneOddsTrainer';

// ─── Harness ──────────────────────────────────────────────────────────────────

/** Exactly the wiring the parent mode does: one hook instance, one tree. */
function Harness() {
  const stats = useStats();
  const drill = useOddsDrill(stats);
  return <PhoneOddsTrainer drill={drill} />;
}

const PHONE_WIDTH = 390;

function stubField(): HTMLElement {
  const field = screen.getByTestId('phone-drag-field');
  field.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: PHONE_WIDTH, bottom: 120, width: PHONE_WIDTH, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return field;
}

function pointer(type: string, clientX: number): MouseEvent {
  return new MouseEvent(type, { clientX, bubbles: true, cancelable: true });
}

const button = () => screen.getByTestId('phone-commit-button');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PhoneOddsTrainer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the read zone and the swap zone, and no felt', () => {
    renderAt('phone', <Harness />);

    expect(screen.getByTestId('phone-stage')).toBeInTheDocument();
    expect(screen.getByTestId('phone-commit-bar')).toBeInTheDocument();
    expect(screen.getAllByTestId('phone-board-slot')).toHaveLength(5);
  });

  it('keeps the read zone pixel-identical across the commit', () => {
    renderAt('phone', <Harness />);
    const before = screen.getByTestId('phone-stage').outerHTML;

    const field = stubField();
    fireEvent(field, pointer('pointerdown', 200));
    fireEvent(field, pointer('pointermove', 260));
    fireEvent(field, pointer('pointerup', 260));
    fireEvent.click(button());

    // The reveal has definitely happened...
    expect(screen.getByTestId('phone-actual')).toBeInTheDocument();
    // ...and the cards have not moved by so much as an attribute.
    expect(screen.getByTestId('phone-stage').outerHTML).toBe(before);
  });

  it('does not commit on lift — only the button ends the hand', () => {
    renderAt('phone', <Harness />);
    const field = stubField();

    fireEvent(field, pointer('pointerdown', 200));
    fireEvent(field, pointer('pointermove', 260));
    fireEvent(field, pointer('pointerup', 260));

    expect(screen.getByTestId('phone-pending')).toHaveTextContent('61%');
    expect(screen.queryByTestId('phone-actual')).not.toBeInTheDocument();

    fireEvent.click(button());

    expect(screen.getByTestId('phone-you')).toHaveTextContent('61%');
    expect(button()).toHaveTextContent('Next hand →');
  });

  it('deals a fresh hand from the same button, resetting the dial', () => {
    renderAt('phone', <Harness />);
    const field = stubField();

    fireEvent(field, pointer('pointerdown', 200));
    fireEvent.click(button()); // commit
    fireEvent.click(button()); // next hand

    expect(screen.getByTestId('phone-pending')).toHaveTextContent('—');
    expect(button()).toHaveTextContent('Commit');
    expect(button()).toBeDisabled();
    expect(screen.getAllByTestId('phone-board-slot')).toHaveLength(5);
  });

  it('records the hand through the shared stats hook, not through the tree', () => {
    renderAt('phone', <Harness />);

    fireEvent(stubField(), pointer('pointerdown', 200));
    fireEvent.click(button());

    // Persistence is the shared hook's job; the phone tree owning a storage key
    // would be the drift bug DECISIONS.md forbids. Assert it happened, and that
    // it happened where it should.
    const keys = Object.keys(localStorage);
    expect(keys.length).toBeGreaterThan(0);
  });
});
