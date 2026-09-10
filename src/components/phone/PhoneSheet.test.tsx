/**
 * PhoneSheet — the frame contract every phone overlay inherits.
 *
 * The footer is the one that matters: it holds the primary button, which is the
 * exit path, and a footer that scrolls away is how a full-screen sheet becomes
 * a trap. The drag thresholds are tested through synthetic pointer events —
 * jsdom implements no PointerEvent, so a MouseEvent carrying the pointer type
 * name is dispatched instead; React reads clientY off the native event either
 * way. timeStamp is pinned so the velocity threshold is deterministic rather
 * than a function of how fast the test machine runs.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderAt } from '../../test/renderAt';
import PhoneSheet from './PhoneSheet';

/** Dispatch a pointer event React can read clientY and timeStamp from. */
/**
 * `timeStamp` is offset off zero deliberately.
 *
 * React substitutes `Date.now()` when a native event's `timeStamp` is falsy, so
 * a gesture starting at 0 hands the component a wall-clock stamp for its first
 * event and a monotonic one for the rest — dt goes hugely negative and the
 * velocity never accumulates. A real browser never emits 0 here (it is ms since
 * page load), so anchoring the gesture away from zero is what makes these
 * timings represent a real one. The relative offsets are what the tests assert.
 */
const T0 = 1_000;

function pointer(el: Element, type: string, clientY: number, timeStamp: number) {
  const event = new MouseEvent(type, { bubbles: true, clientY });
  Object.defineProperty(event, 'timeStamp', { value: T0 + timeStamp });
  fireEvent(el, event);
}

function grabZone(): Element {
  // The handle strip and the header share one drag zone; the handle's parent
  // chain reaches it from either.
  const sheet = screen.getByTestId('phone-sheet');
  const zone = sheet.firstElementChild;
  if (!zone) throw new Error('sheet has no drag zone');
  return zone;
}

function renderSheet(onClose = () => {}, footer: ReactNode = <button>Deal me another</button>) {
  return renderAt(
    'phone',
    <PhoneSheet title="How this works" subtitle="Flop · 9 outs" onClose={onClose} footer={footer}>
      <p>Body copy</p>
    </PhoneSheet>
  );
}

describe('PhoneSheet', () => {
  it('renders handle, title, body and a sticky footer', () => {
    renderSheet();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('How this works');
    expect(screen.getByText('Flop · 9 outs')).toBeInTheDocument();
    expect(screen.getByTestId('phone-sheet-body')).toHaveTextContent('Body copy');

    const footer = screen.getByTestId('phone-sheet-footer');
    expect(footer).toBeInTheDocument();
    // The primary button lives in the footer, not in the scrolling body.
    expect(footer).toContainElement(screen.getByRole('button', { name: 'Deal me another' }));
    expect(screen.getByTestId('phone-sheet-body')).not.toContainElement(
      screen.getByRole('button', { name: 'Deal me another' })
    );
  });

  it('omits the footer when no footer content is given', () => {
    renderAt(
      'phone',
      <PhoneSheet title="Menu" onClose={() => {}}>
        <p>Body</p>
      </PhoneSheet>
    );
    expect(screen.queryByTestId('phone-sheet-footer')).toBeNull();
  });

  it('the × closes it', () => {
    const onClose = vi.fn();
    renderSheet(onClose);

    fireEvent.click(screen.getByRole('button', { name: 'Close How this works' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc closes it', () => {
    const onClose = vi.fn();
    renderSheet(onClose);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses on a drag past 96px of travel', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const zone = grabZone();

    pointer(zone, 'pointerdown', 100, 0);
    pointer(zone, 'pointermove', 220, 400); // 120px over 400ms — slow, but far
    pointer(zone, 'pointerup', 220, 400);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses on a flick faster than 0.5px/ms, however short', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const zone = grabZone();

    pointer(zone, 'pointerdown', 100, 0);
    pointer(zone, 'pointermove', 130, 20); // 30px in 20ms = 1.5px/ms
    pointer(zone, 'pointerup', 130, 20);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back when the drag is short and slow', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const zone = grabZone();

    pointer(zone, 'pointerdown', 100, 0);
    pointer(zone, 'pointermove', 140, 500); // 40px in 500ms = 0.08px/ms
    expect(screen.getByTestId('phone-sheet')).toHaveStyle({ transform: 'translateY(40px)' });

    pointer(zone, 'pointerup', 140, 500);
    expect(onClose).not.toHaveBeenCalled();
    // Home again, and the transition class is on for the 180ms it plays.
    expect(screen.getByTestId('phone-sheet').getAttribute('style')).toBeFalsy();
  });

  it('ignores upward drags — the sheet is already at the top of the screen', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const zone = grabZone();

    pointer(zone, 'pointerdown', 300, 0);
    pointer(zone, 'pointermove', 120, 200);
    expect(screen.getByTestId('phone-sheet').getAttribute('style')).toBeFalsy();

    pointer(zone, 'pointerup', 120, 200);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a cancelled pointer springs back rather than dismissing', () => {
    const onClose = vi.fn();
    renderSheet(onClose);
    const zone = grabZone();

    pointer(zone, 'pointerdown', 100, 0);
    pointer(zone, 'pointermove', 400, 100);
    act(() => {
      fireEvent(zone, new MouseEvent('pointercancel', { bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
