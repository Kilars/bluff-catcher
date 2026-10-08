/**
 * SliceRows — a stroke through the rows picks a tab per row; a press that
 * barely moves is still a tap. The hit-test reads getBoundingClientRect, so
 * the tests lay the rows out by stubbing it and drive pointer coordinates.
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SliceRows from './SliceRows';
import ChartBrowser from './ChartBrowser';

/** Rows 40px apart, 36px tall; tabs 40px apart, 36px wide, from 0,0. */
const ROW = 40;
const TAB = 40;
const SIZE = 36;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

/** Lays out every `[data-row]` under the slice root as a grid of tabs. */
function layOut() {
  const root = screen.getByTestId('slice-rows');
  root.getBoundingClientRect = () => rect(0, 0, 400, 400);
  root.querySelectorAll<HTMLElement>('[data-row]').forEach((row, r) => {
    row.getBoundingClientRect = () => rect(0, r * ROW, 400, SIZE);
    row.querySelectorAll<HTMLElement>('[data-id]').forEach((tab, i) => {
      tab.getBoundingClientRect = () => rect(i * TAB, r * ROW, SIZE, SIZE);
    });
  });
}

/** Centre of tab `i` in row `r`. */
const at = (r: number, i: number) => ({ x: i * TAB + SIZE / 2, y: r * ROW + SIZE / 2 });

/** jsdom has no PointerEvent; a MouseEvent carries the coordinates React reads. */
function pointer(type: string, el: Element, { x, y }: { x: number; y: number }) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
  fireEvent(el, ev);
}

function slice(...points: { x: number; y: number }[]) {
  const root = screen.getByTestId('slice-rows');
  pointer('pointerdown', root, points[0]);
  for (const p of points.slice(1)) {
    layOut();
    pointer('pointermove', root, p);
  }
  pointer('pointerup', root, points[points.length - 1]);
}

const rows = (onTap: (id: string) => void) => (
  <>
    {['a', 'b', 'c'].map((r) => (
      <div key={r} data-row={r}>
        {['0', '1', '2'].map((id) => (
          <button key={id} type="button" data-id={id} onClick={() => onTap(`${r}${id}`)}>
            {r}
            {id}
          </button>
        ))}
      </div>
    ))}
  </>
);

describe('SliceRows', () => {
  it('picks the press point, a drift along a row, and every row a jump crosses', () => {
    const onPick = vi.fn((_row: string, _id: string) => true);
    render(<SliceRows onPick={onPick}>{rows(() => {})}</SliceRows>);
    layOut();
    // A drift along row a, then one jump to row c: row b is still crossed.
    slice(at(0, 0), at(0, 1), at(2, 1));
    const picked = onPick.mock.calls.map(([r, id]) => `${r}${id}`);
    expect(picked).toEqual(['a0', 'a1', 'b1', 'c1']);
  });

  it('picks a row where a diagonal crosses its centre, not where it leaves', () => {
    const onPick = vi.fn((_row: string, _id: string) => true);
    render(<SliceRows onPick={onPick}>{rows(() => {})}</SliceRows>);
    layOut();
    // From a2 down-left to b0: the stroke leaves row a over a1, and must not pick it.
    slice(at(0, 2), { x: at(0, 2).x - 2, y: at(0, 2).y + 9 }, at(1, 0));
    const picked = onPick.mock.calls.map(([r, id]) => `${r}${id}`);
    expect(picked).toEqual(['a2', 'b0']);
  });

  it('swallows the click that ends a slice, and leaves a tap alone', () => {
    const onTap = vi.fn();
    render(<SliceRows onPick={() => true}>{rows(onTap)}</SliceRows>);
    layOut();
    slice(at(0, 0), at(1, 0));
    fireEvent.click(screen.getByText('b0'));
    expect(onTap).not.toHaveBeenCalled();

    slice(at(2, 2), { x: at(2, 2).x + 3, y: at(2, 2).y });
    fireEvent.click(screen.getByText('c2'));
    expect(onTap).toHaveBeenCalledWith('c2');
  });
  it('still crosses every row on a fast, shallow flick', () => {
    const onPick = vi.fn((_row: string, _id: string) => true);
    render(<SliceRows onPick={onPick}>{rows(() => {})}</SliceRows>);
    layOut();
    // Down into the gap, then one move more than twice as sideways as down
    // that still crosses the centres of b (over b0) and c (over c2).
    slice(at(0, 0), { x: 20, y: 54 }, { x: 110, y: 98 });
    expect(onPick.mock.calls.map(([r, id]) => `${r}${id}`)).toEqual(['a0', 'b0', 'c2']);
  });

  it('drops a mouse stroke whose button came up outside the rows', () => {
    const onPick = vi.fn((_row: string, _id: string) => true);
    render(<SliceRows onPick={onPick}>{rows(() => {})}</SliceRows>);
    layOut();
    const root = screen.getByTestId('slice-rows');
    pointer('pointerdown', root, at(0, 0));
    // A hover: no button held, so no slice.
    const hover = new MouseEvent('pointermove', { bubbles: true, clientX: at(2, 0).x, clientY: at(2, 0).y, buttons: 0 });
    Object.defineProperty(hover, 'pointerId', { value: 1 });
    Object.defineProperty(hover, 'pointerType', { value: 'mouse' });
    fireEvent(root, hover);
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe('ChartBrowser slice', () => {
  it('picks spot, seat and raiser in one stroke, passing over greyed tabs', () => {
    render(<ChartBrowser layout="desktop" format="cash" depth="cash" title="Range charts" onClose={() => {}} />);
    layOut();
    // Cash rows: Spot (Open 3-bet 4-bet), You and vs (caption, then LJ HJ CO BTN SB BB).
    // Tab indices count the buttons only, so LJ is 0 and CO is 2.
    slice(at(0, 1), at(1, 2), at(2, 0), at(2, 1));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('CO vs HJ open');

    // Down through 4-bet onto vs LJ: greyed there, so the raiser moves on to BTN.
    slice(at(0, 2), at(1, 2), at(2, 0));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('CO opens, BTN 3-bets');
  });
});
