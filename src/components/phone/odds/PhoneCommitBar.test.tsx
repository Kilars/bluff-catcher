/**
 * PhoneCommitBar — the dial (PLAN-phone §3.3, §5.1).
 *
 * The gesture under test is **absolute grab → relative refine → explicit
 * commit**, and the point of every one of these cases is that the desktop
 * rail's tap-to-commit is gone:
 *
 *  1. Touching down sets the value by absolute position.
 *  2. Further movement refines it relatively, at 1 point per 6px.
 *  3. Relative travel is not bounded by the bar's width.
 *  4. **Lift does not commit** — the readout is still pending afterwards.
 *  5. The button commits, and only the button.
 *  6. Post-commit the button relabels and the bar becomes the error picture.
 *  7. The em dash holds the readout until first touch.
 *  8. The keyboard path (free a11y) still works, with no key hints rendered.
 *
 * jsdom notes: it implements neither PointerEvent nor setPointerCapture, so the
 * gestures are driven by dispatching MouseEvents under the pointer event names
 * (React reads clientX off the native event either way), and the drag field's
 * geometry is stubbed to a 390px-wide phone.
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderAt } from '../../../test/renderAt';
import PhoneCommitBar from './PhoneCommitBar';
import { bandOf } from '../../../lib/band';

// ─── Harness ──────────────────────────────────────────────────────────────────

const TRUE_TOTAL = 35;
const PHONE_WIDTH = 390;

/**
 * Mirrors exactly what `useOddsDrill` does with these two values — pending is
 * the hook's `hover`, and committing clears it — so the bar is exercised
 * against the same state machine it gets in the app, without dealing a hand.
 */
function ControlledBar({
  onOpenExplain = () => {},
  onNext = () => {},
}: {
  onOpenExplain?: () => void;
  onNext?: () => void;
}) {
  const [pending, setPending] = useState<number | null>(null);
  const [guess, setGuess] = useState<number | null>(null);
  const delta = guess === null ? 0 : Math.abs(guess - TRUE_TOTAL);

  return (
    <PhoneCommitBar
      guess={guess}
      pending={pending}
      trueTotal={TRUE_TOTAL}
      drawName="A flush draw"
      drawNote="Nine cards make it"
      band={guess === null ? null : bandOf(delta)}
      delta={delta}
      onPendingChange={setPending}
      onCommit={(pct) => {
        setGuess(pct);
        setPending(null);
      }}
      onNext={onNext}
      onOpenExplain={onOpenExplain}
    />
  );
}

// ─── Gesture helpers ──────────────────────────────────────────────────────────

/** Give the drag field the geometry of a full-bleed bar on a 390px phone. */
function stubField(): HTMLElement {
  const field = screen.getByTestId('phone-drag-field');
  field.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: PHONE_WIDTH, bottom: 120, width: PHONE_WIDTH, height: 120, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return field;
}

function pointer(type: string, clientX: number): MouseEvent {
  return new MouseEvent(type, { clientX, bubbles: true, cancelable: true });
}

function grab(field: HTMLElement, clientX: number): void {
  fireEvent(field, pointer('pointerdown', clientX));
}

function drag(field: HTMLElement, clientX: number): void {
  fireEvent(field, pointer('pointermove', clientX));
}

function lift(field: HTMLElement, clientX: number): void {
  fireEvent(field, pointer('pointerup', clientX));
}

const readout = () => screen.getByTestId('phone-readout').textContent ?? '';
const button = () => screen.getByTestId('phone-commit-button');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PhoneCommitBar', () => {
  describe('before first touch', () => {
    it('shows an em dash, not a number', () => {
      renderAt('phone', <ControlledBar />);
      expect(screen.getByTestId('phone-pending')).toHaveTextContent('—');
    });

    it('has nothing to commit, so the button is disabled and unlabelled by a value', () => {
      renderAt('phone', <ControlledBar />);
      expect(button()).toBeDisabled();
      expect(button()).toHaveTextContent('Commit');
    });

    it('draws no marks on the bar', () => {
      renderAt('phone', <ControlledBar />);
      expect(screen.queryByTestId('phone-you-mark')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phone-actual-mark')).not.toBeInTheDocument();
    });
  });

  describe('absolute grab', () => {
    it('sets the value from where the finger lands', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      // 200 / 390 = 51.28% → 51
      grab(field, 200);

      expect(readout()).toContain('51%');
      expect(button()).toHaveTextContent('Commit 51%');
      expect(button()).toBeEnabled();
    });

    it('pins the ends: 0 at the left edge, 100 at the right', () => {
      const first = renderAt('phone', <ControlledBar />);
      grab(stubField(), 0);
      expect(readout()).toContain('0%');
      first.unmount();

      renderAt('phone', <ControlledBar />);
      grab(stubField(), PHONE_WIDTH);
      expect(readout()).toContain('100%');
    });
  });

  describe('relative refine — 1 point per 6px', () => {
    it('refines the grabbed value rather than re-reading absolute position', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 200); // 51
      drag(field, 260); // +60px → +10 points

      expect(readout()).toContain('61%');
      // Absolute would have given 260 / 390 = 67%. It is relative, so it is 61.
      expect(readout()).not.toContain('67%');
    });

    it('moves one point for the smallest deliberate nudge', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 195); // 50
      drag(field, 201); // +6px → +1 point

      expect(readout()).toContain('51%');
    });

    it('is not bounded by the bar — a 300px swipe covers 50 points', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 40); // 10
      drag(field, 340); // +300px → +50 points

      expect(readout()).toContain('60%');
    });

    it('clamps at 0 and 100 however far the finger travels', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 195); // 50
      drag(field, 1500);
      expect(readout()).toContain('100%');
      drag(field, -1500);
      expect(readout()).toContain('0%');
    });
  });

  describe('lift does NOT commit', () => {
    it('leaves the hand open after the finger leaves the glass', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 200);
      drag(field, 260);
      lift(field, 260);

      // Still pending: no reveal, no relabel, no marks.
      expect(screen.getByTestId('phone-pending')).toHaveTextContent('61%');
      expect(screen.queryByTestId('phone-actual')).not.toBeInTheDocument();
      expect(screen.queryByTestId('phone-you-mark')).not.toBeInTheDocument();
      expect(button()).toHaveTextContent('Commit 61%');
    });

    it('lets a lifted gesture be re-grabbed and refined again', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 200);
      lift(field, 200);
      grab(field, 100); // absolute again: 100 / 390 = 26%
      drag(field, 88); // −12px → −2 points

      expect(readout()).toContain('24%');
      expect(screen.queryByTestId('phone-actual')).not.toBeInTheDocument();
    });

    it('ignores a move that never started with a grab', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      drag(field, 300);

      expect(screen.getByTestId('phone-pending')).toHaveTextContent('—');
    });
  });

  describe('the button commits', () => {
    it('reveals the answer and relabels itself', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 200);
      drag(field, 260); // 61
      lift(field, 260);
      fireEvent.click(button());

      expect(screen.getByTestId('phone-you')).toHaveTextContent('61%');
      expect(screen.getByTestId('phone-actual')).toHaveTextContent('35.0%');
      expect(button()).toHaveTextContent('Next hand →');
    });

    it('draws you, actual and the gap between them on the same bar', () => {
      renderAt('phone', <ControlledBar />);
      grab(stubField(), 200); // 51
      fireEvent.click(button());

      expect(screen.getByTestId('phone-you-mark')).toHaveStyle({ left: '51%' });
      expect(screen.getByTestId('phone-actual-mark')).toHaveStyle({ left: '35%' });

      const gap = screen.getByTestId('phone-gap-bar');
      expect(gap).toHaveStyle({ left: '35%' });
      expect(gap).toHaveStyle({ width: '16%' });
    });

    it('inverts the type hierarchy — ACTUAL is the headline, YOU the footnote', () => {
      renderAt('phone', <ControlledBar />);
      grab(stubField(), 200);
      fireEvent.click(button());

      expect(screen.getByTestId('phone-actual')).toHaveTextContent('35.0%');
      expect(screen.getByTestId('phone-you')).toHaveTextContent('51%');
      expect(screen.getByTestId('phone-readout')).toHaveTextContent(/off by 16\.0/);
    });

    it('names the draw and offers the explanation only once the hand is answered', () => {
      const onOpenExplain = vi.fn();
      renderAt('phone', <ControlledBar onOpenExplain={onOpenExplain} />);

      expect(screen.queryByText('A flush draw')).not.toBeInTheDocument();

      grab(stubField(), 200);
      fireEvent.click(button());

      expect(screen.getByText('A flush draw')).toBeInTheDocument();
      expect(screen.getByText('Nine cards make it')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'How is this counted?' }));
      expect(onOpenExplain).toHaveBeenCalledTimes(1);
    });

    it('makes the bar inert once committed — no second guess, no stray commit', () => {
      renderAt('phone', <ControlledBar />);
      const field = stubField();

      grab(field, 200);
      fireEvent.click(button());
      grab(field, 40);

      expect(screen.getByTestId('phone-you')).toHaveTextContent('51%');
      expect(field).toHaveAttribute('aria-disabled', 'true');
    });

    it('asks for the next hand on the second press', () => {
      const onNext = vi.fn();
      renderAt('phone', <ControlledBar onNext={onNext} />);

      grab(stubField(), 200);
      fireEvent.click(button());
      fireEvent.click(button());

      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyboard — carried over from the rail, with no hints drawn', () => {
    it('steps the value and commits on Enter', () => {
      renderAt('phone', <ControlledBar />);
      const field = screen.getByTestId('phone-drag-field');

      fireEvent.keyDown(field, { key: 'ArrowRight' }); // from the 50 default
      expect(readout()).toContain('51%');

      fireEvent.keyDown(field, { key: 'ArrowRight', shiftKey: true });
      expect(readout()).toContain('61%');

      fireEvent.keyDown(field, { key: 'Enter' });
      expect(screen.getByTestId('phone-you')).toHaveTextContent('61%');
    });

    it('renders no key-hint badges — there is no keyboard on the device', () => {
      renderAt('phone', <ControlledBar />);
      const bar = screen.getByTestId('phone-commit-bar');
      expect(bar.textContent).not.toMatch(/space|enter|↵|shift/i);
    });
  });

  describe('the ruler', () => {
    it('labels 0 / 25 / 50 / 75 / 100 under the bar', () => {
      renderAt('phone', <ControlledBar />);
      for (const label of ['0', '25', '50', '75', '100']) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });
  });
});
