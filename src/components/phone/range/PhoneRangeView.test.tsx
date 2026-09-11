/**
 * PhoneRangeView — component tests (PLAN-phone §3.1 / §6 phase 6).
 *
 * The bet this file guards: 169 cells with **no labels** plus a drag-scrub
 * readout is a better phone chart than 169 illegible ones. So it asserts both
 * halves — that the labels really are gone, and that the readout that replaces
 * them names the right hand for a given finger position.
 *
 * Everything renders through `renderAt('phone', …)`; jsdom is 1024px wide, so
 * without it a test named "phone" silently exercises the desktop tree.
 */

import { describe, it, expect } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderAt } from '../../../test/renderAt';
import PhoneRangeView from './PhoneRangeView';
import { cellClass, RANK_LABELS } from '../../../lib/preflop/grid';
import { boundarySentence } from '../../../lib/preflop/boundary';
import { isOpen } from '../../../lib/preflop/ranges';

// ─── Geometry, mirrored from the component ───────────────────────────────────
//
// 24px cells and 2px gaps: the numbers §3.1 derives from a 390px screen. The
// hit-test is pure arithmetic over getBoundingClientRect, so the tests stub a
// rect and drive real pointer coordinates through it.

const CELL = 24;
const GAP = 2;
const PITCH = CELL + GAP; // 26
const SIDE = 13 * CELL + 12 * GAP; // 336

/** Client coords of the centre of cell (row, col) for a rect pinned at 0,0. */
function centreOf(row: number, col: number): { x: number; y: number } {
  return { x: col * PITCH + CELL / 2, y: row * PITCH + CELL / 2 };
}

function stubRect(el: Element, left = 0, top = 0): void {
  el.getBoundingClientRect = () =>
    ({
      left,
      top,
      right: left + SIDE,
      bottom: top + SIDE,
      width: SIDE,
      height: SIDE,
      x: left,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

/**
 * jsdom has no PointerEvent, and dom-testing-library's fallback Event drops
 * clientX/clientY — which are the only things the hit-test reads. A MouseEvent
 * carries them and React dispatches it to onPointerDown/Move all the same.
 */
function pointer(type: string, el: Element, x: number, y: number): void {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  fireEvent(el, ev);
}

/** Press at the centre of (row, col) and read the bar. */
/**
 * The readout's text, with the separator spacing normalised.
 *
 * The hand and its meta are separate flex items so they can carry different
 * type sizes, which makes each one its own inline formatting context — and CSS
 * collapses leading whitespace at the start of one. A literal " · " in the
 * markup therefore rendered as "Q5s· fold", so the space now comes from the
 * container's `gap` and never appears in textContent. These assertions are
 * about which cell is named, not about where the space comes from.
 */
function readoutText(): string {
  return (screen.getByTestId('scrub-readout').textContent ?? '')
    .replace(/\s*·\s*/g, ' · ')
    .trim();
}

function scrubTo(row: number, col: number): string {
  const cells = screen.getByTestId('grid-cells');
  stubRect(cells);
  const { x, y } = centreOf(row, col);
  pointer('pointerdown', cells, x, y);
  pointer('pointermove', cells, x, y);
  return readoutText();
}

function cellEls(): HTMLElement[] {
  return Array.from(
    screen.getByTestId('grid-cells').querySelectorAll<HTMLElement>('[aria-label]')
  );
}

function cellFor(hc: string): HTMLElement {
  const el = screen
    .getByTestId('grid-cells')
    .querySelector<HTMLElement>(`[aria-label^="${hc}:"]`);
  if (!el) throw new Error(`no cell for ${hc}`);
  return el;
}

describe('PhoneRangeView', () => {
  describe('the grid', () => {
    it('renders all 169 cells', () => {
      renderAt('phone', <PhoneRangeView position="BTN" />);
      expect(cellEls()).toHaveLength(169);
    });

    it('renders no text label in any cell — the whole §3.1 decision', () => {
      renderAt('phone', <PhoneRangeView position="BTN" />);
      const labelled = cellEls().filter((c) => (c.textContent ?? '').trim() !== '');
      expect(labelled).toEqual([]);
    });

    it('keeps an aria-label on every cell even with no visible text', () => {
      renderAt('phone', <PhoneRangeView position="UTG" />);
      // Same convention as the desktop RangeGrid: "AKs: open" / "72o: fold".
      expect(cellFor('AKs').getAttribute('aria-label')).toBe('AKs: open');
      expect(cellFor('72o').getAttribute('aria-label')).toBe('72o: fold');
      expect(cellFor('AA').getAttribute('aria-label')).toBe('AA: open');
    });

    it('labels every cell in agreement with isOpen()', () => {
      renderAt('phone', <PhoneRangeView position="CO" depth="mid" />);
      for (const cell of cellEls()) {
        const label = cell.getAttribute('aria-label') ?? '';
        const [hc, verdict] = label.split(': ');
        expect(verdict).toBe(isOpen('CO', hc, 'mid') ? 'open' : 'fold');
      }
    });

    it('says "jam", not "open", at 10bb', () => {
      renderAt('phone', <PhoneRangeView position="UTG" depth="short" />);
      expect(cellFor('AA').getAttribute('aria-label')).toBe('AA: jam');
    });

    it('renders the rank headers on both axes', () => {
      const { container } = renderAt('phone', <PhoneRangeView position="HJ" />);
      const tracks = container.querySelectorAll('[aria-hidden="true"]');
      expect(tracks).toHaveLength(2);
      for (const track of tracks) {
        const labels = Array.from(track.children)
          .map((c) => c.textContent ?? '')
          .filter((t) => t !== '');
        expect(labels).toEqual([...RANK_LABELS]);
      }
    });

    it('keeps the cells out of the tab order — they are not tap targets', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      const cells = screen.getByTestId('grid-cells');
      expect(cells.querySelectorAll('button, a, [tabindex], [role="button"]')).toHaveLength(0);
    });
  });

  describe('the scrub readout', () => {
    it('starts as a hint, not a blank bar', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      expect(screen.getByTestId('scrub-readout')).toHaveTextContent(
        /drag across the grid/i
      );
    });

    it('names the cell under the finger', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      // row 3 = J, col 5 = 9, row < col → upper-right triangle → suited.
      expect(cellClass(3, 5)).toBe('J9s');
      expect(scrubTo(3, 5)).toBe('J9s · open · HJ');
    });

    it('names a folded hand as folded', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      expect(cellClass(8, 2)).toBe('Q6o');
      expect(scrubTo(8, 2)).toBe('Q6o · fold · HJ');
    });

    it('reads the pairs off the diagonal', () => {
      renderAt('phone', <PhoneRangeView position="BTN" />);
      expect(scrubTo(0, 0)).toBe('AA · open · BTN');
      expect(scrubTo(12, 12)).toBe('22 · open · BTN');
    });

    it('tracks the finger across a drag without a second press', () => {
      renderAt('phone', <PhoneRangeView position="CO" />);
      const cells = screen.getByTestId('grid-cells');
      stubRect(cells);

      const start = centreOf(0, 0);
      pointer('pointerdown', cells, start.x, start.y);
      expect(readoutText()).toBe('AA · open · CO');

      for (const [row, col, expected] of [
        [0, 1, 'AKs · open · CO'],
        [1, 0, 'AKo · open · CO'],
        [12, 0, 'A2o · fold · CO'],
      ] as [number, number, string][]) {
        const p = centreOf(row, col);
        pointer('pointermove', cells, p.x, p.y);
        expect(readoutText()).toBe(expected);
      }
    });

    it('ignores a move that is not part of a press', () => {
      renderAt('phone', <PhoneRangeView position="CO" />);
      const cells = screen.getByTestId('grid-cells');
      stubRect(cells);
      const p = centreOf(4, 4);
      pointer('pointermove', cells, p.x, p.y);
      expect(screen.getByTestId('scrub-readout')).toHaveTextContent(/drag across the grid/i);
    });

    it('honours the rect offset — the grid is not always at 0,0', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      const cells = screen.getByTestId('grid-cells');
      stubRect(cells, 17, 213);
      const p = centreOf(2, 2);
      pointer('pointerdown', cells, p.x + 17, p.y + 213);
      expect(readoutText()).toBe('QQ · open · HJ');
    });

    it('clamps to the nearest cell when the finger runs off the edge', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      const cells = screen.getByTestId('grid-cells');
      stubRect(cells);
      pointer('pointerdown', cells, 4, 4);
      pointer('pointermove', cells, -400, -400);
      expect(readoutText()).toBe('AA · open · HJ');
      pointer('pointermove', cells, 4000, 4000);
      // 22 is outside HJ's 33+ pairs — the clamp lands on the corner all the same.
      expect(readoutText()).toBe('22 · fold · HJ');
    });

    it('keeps the last read after the finger lifts — you cannot read under it', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      const cells = screen.getByTestId('grid-cells');
      stubRect(cells);
      const p = centreOf(3, 5);
      pointer('pointerdown', cells, p.x, p.y);
      pointer('pointerup', cells, p.x, p.y);
      expect(readoutText()).toBe('J9s · open · HJ');
    });

    it('marks the scrubbed cell on the grid too', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      scrubTo(3, 5);
      const marked = cellEls().filter((c) => c.hasAttribute('data-scrubbed'));
      expect(marked).toHaveLength(1);
      expect(marked[0].getAttribute('aria-label')).toMatch(/^J9s:/);
    });

    it('re-reads the same cell against the new seat when the seat changes', () => {
      renderAt('phone', <PhoneRangeView position="BTN" />);
      expect(scrubTo(4, 9)).toBe('T5s · open · BTN');
      fireEvent.click(screen.getByRole('tab', { name: /^UTG$/ }));
      expect(readoutText()).toBe('T5s · fold · UTG');
    });
  });

  describe('the hero cell', () => {
    it('outlines the hero hand on the hero seat', () => {
      renderAt('phone', <PhoneRangeView position="CO" highlight="AKs" />);
      const hero = cellEls().filter((c) => c.hasAttribute('data-hero'));
      expect(hero).toHaveLength(1);
      expect(hero[0].getAttribute('aria-label')).toBe('AKs: open (your hand)');
    });

    it('does not mark it on another seat’s chart', () => {
      renderAt('phone', <PhoneRangeView position="CO" highlight="AKs" />);
      fireEvent.click(screen.getByRole('tab', { name: /^UTG$/ }));
      expect(cellEls().filter((c) => c.hasAttribute('data-hero'))).toEqual([]);
      // …and comes back when the hero's seat does.
      fireEvent.click(screen.getByRole('tab', { name: /^CO/ }));
      expect(cellEls().filter((c) => c.hasAttribute('data-hero'))).toHaveLength(1);
    });

    it('honours an explicit heroPosition different from the opening seat', () => {
      renderAt('phone', <PhoneRangeView position="UTG" highlight="AKs" heroPosition="BTN" />);
      expect(cellEls().filter((c) => c.hasAttribute('data-hero'))).toEqual([]);
      fireEvent.click(screen.getByRole('tab', { name: /^BTN/ }));
      expect(cellEls().filter((c) => c.hasAttribute('data-hero'))).toHaveLength(1);
    });

    it('marks nothing when no hand is being drilled', () => {
      renderAt('phone', <PhoneRangeView position="CO" />);
      expect(cellEls().filter((c) => c.hasAttribute('data-hero'))).toEqual([]);
    });
  });

  describe('the boundary sentence', () => {
    it.each([
      ['HJ', 'deep'],
      ['UTG', 'deep'],
      ['BTN', 'mid'],
      ['CO', 'short'],
    ] as const)('matches boundary.ts for %s @ %s', (position, depth) => {
      renderAt('phone', <PhoneRangeView position={position} depth={depth} />);
      expect(screen.getByTestId('boundary-sentence')).toHaveTextContent(
        boundarySentence(position, depth)
      );
    });

    it('follows the seat strip', () => {
      renderAt('phone', <PhoneRangeView position="UTG" />);
      expect(screen.getByTestId('boundary-sentence').textContent).toBe(
        boundarySentence('UTG', 'deep')
      );
      fireEvent.click(screen.getByRole('tab', { name: /^BTN$/ }));
      expect(screen.getByTestId('boundary-sentence').textContent).toBe(
        boundarySentence('BTN', 'deep')
      );
    });

    it('says "jams" on the 10bb chart', () => {
      renderAt('phone', <PhoneRangeView position="HJ" depth="short" />);
      expect(screen.getByTestId('boundary-sentence').textContent).toMatch(/^HJ jams /);
    });
  });

  describe('the tier control', () => {
    it('is a static chip in the trainer’s sheet (default)', () => {
      renderAt('phone', <PhoneRangeView position="HJ" depth="mid" />);
      expect(screen.getByTestId('depth-chip')).toHaveTextContent('20bb');
      expect(screen.queryByRole('tablist', { name: 'Stack depth' })).toBeNull();
      expect(screen.queryByRole('tab', { name: /10bb/ })).toBeNull();
    });

    it('is a 3-way strip in the standalone browser', () => {
      renderAt('phone', <PhoneRangeView position="HJ" depthSwitchable />);
      expect(screen.queryByTestId('depth-chip')).toBeNull();
      const strip = screen.getByRole('tablist', { name: 'Stack depth' });
      const tabs = within(strip).getAllByRole('tab');
      expect(tabs).toHaveLength(3);
      expect(tabs.map((t) => t.textContent)).toEqual(['60bb+Deep', '20bbMid', '10bbShort']);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('switches the chart, the sentence and the verb when the strip is used', () => {
      renderAt('phone', <PhoneRangeView position="UTG" depthSwitchable />);
      expect(cellFor('A2s').getAttribute('aria-label')).toBe('A2s: fold'); // UTG @ 60bb+
      fireEvent.click(screen.getByRole('tab', { name: /10bb/ }));
      expect(cellFor('A2s').getAttribute('aria-label')).toBe('A2s: jam'); // UTG @ 10bb
      expect(screen.getByTestId('boundary-sentence').textContent).toBe(
        boundarySentence('UTG', 'short')
      );
      expect(scrubTo(0, 12)).toBe('A2s · jam · UTG');
    });
  });

  describe('the seat strip', () => {
    it('offers all seven seats, with the opening one selected', () => {
      renderAt('phone', <PhoneRangeView position="LJ" />);
      const strip = screen.getByRole('tablist', { name: 'Position' });
      const tabs = within(strip).getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual([
        'UTG',
        'UTG+1',
        'UTG+2',
        'LJ',
        'HJ',
        'CO',
        'BTN',
      ]);
      expect(tabs[3]).toHaveAttribute('aria-selected', 'true');
    });

    it('pages on a horizontal swipe that does not start on the grid', () => {
      renderAt('phone', <PhoneRangeView position="LJ" />);
      const readout = screen.getByTestId('scrub-readout');
      fireEvent.touchStart(readout, { touches: [{ clientX: 300, clientY: 200 }] });
      fireEvent.touchEnd(readout, { changedTouches: [{ clientX: 180, clientY: 205 }] });
      expect(screen.getByRole('tab', { name: /^HJ$/ })).toHaveAttribute('aria-selected', 'true');

      fireEvent.touchStart(readout, { touches: [{ clientX: 180, clientY: 200 }] });
      fireEvent.touchEnd(readout, { changedTouches: [{ clientX: 300, clientY: 205 }] });
      expect(screen.getByRole('tab', { name: /^LJ$/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('does not page on a swipe that starts on the grid — that is a scrub', () => {
      renderAt('phone', <PhoneRangeView position="LJ" />);
      const cells = screen.getByTestId('grid-cells');
      fireEvent.touchStart(cells, { touches: [{ clientX: 300, clientY: 400 }] });
      fireEvent.touchEnd(cells, { changedTouches: [{ clientX: 180, clientY: 405 }] });
      expect(screen.getByRole('tab', { name: /^LJ$/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('does not wrap around at either end', () => {
      renderAt('phone', <PhoneRangeView position="UTG" />);
      const readout = screen.getByTestId('scrub-readout');
      fireEvent.touchStart(readout, { touches: [{ clientX: 180, clientY: 200 }] });
      fireEvent.touchEnd(readout, { changedTouches: [{ clientX: 300, clientY: 200 }] });
      expect(screen.getByRole('tab', { name: /^UTG$/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('dots the hero’s seat', () => {
      renderAt('phone', <PhoneRangeView position="CO" highlight="AKs" heroPosition="CO" />);
      const heroTab = screen.getByRole('tab', { name: /^CO/ });
      expect(within(heroTab).getByLabelText('(your seat)')).toBeTruthy();
    });
  });

  describe('the sheet furniture that is gone', () => {
    it('renders no Close button and no nav hint — the × and swipe-down replace them', () => {
      renderAt('phone', <PhoneRangeView position="HJ" />);
      expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
      expect(screen.queryByText(/arrows, tabs or swipe/i)).toBeNull();
    });
  });
});
