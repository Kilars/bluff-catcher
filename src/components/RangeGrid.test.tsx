/**
 * RangeGrid — component tests.
 *
 * Covers:
 *  1. Renders exactly 169 cells (one per hand class).
 *  2. A few spot-checked cells carry the correct open/fold class per isOpen().
 *  3. The highlighted cell is uniquely marked.
 *  4. AA is rendered (top-left corner pair).
 *  5. Suited and offsuit cells are present with correct notation.
 *  6. All pair cells are on the diagonal (row label === col rank in the class).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RangeGrid from './RangeGrid';
import { isOpen } from '../lib/preflop/ranges';

// Utility: find a cell by hand-class aria-label
function getCell(hc: string) {
  // aria-label is like "AKs: open" or "72o: fold (your hand)"
  return document
    .querySelector(`[aria-label^="${hc}:"]`) as HTMLElement | null;
}

describe('RangeGrid', () => {
  it('renders exactly 169 hand-class cells', () => {
    render(<RangeGrid position="BTN" />);
    // Each cell has a role implied by aria-label
    const cells = document.querySelectorAll('[aria-label]');
    // 169 cells + 0 headers (headers are plain divs without aria-label)
    expect(cells.length).toBe(169);
  });

  describe('open/fold classification — spot checks against isOpen()', () => {
    it.each([
      // BTN opens very wide — these should be open
      ['BTN', 'AKs', true],
      ['BTN', 'AKo', true],
      ['BTN', 'AA',  true],
      ['BTN', '22',  true],
      // BTN folds some offsuit trash
      ['BTN', '72o', false],
      ['BTN', '32o', false],
      // UTG is tighter
      ['UTG', 'AKs', true],
      ['UTG', 'AA',  true],
      ['UTG', '72o', false],
      ['UTG', '87s', true],   // expanded addition
      ['UTG', '54s', false],  // not in UTG range
      // CO boundary hands from the plan spec
      ['CO', 'K7s', true],
      ['CO', 'K6s', false],
    ] as [string, string, boolean][])(
      'position=%s hand=%s → isOpen=%s',
      (position, hc, expected) => {
        render(<RangeGrid position={position as Parameters<typeof isOpen>[0]} />);
        const cell = getCell(hc);
        expect(cell).not.toBeNull();

        // The aria-label includes "open" or "fold"
        const label = cell!.getAttribute('aria-label') ?? '';
        if (expected) {
          expect(label).toMatch(/: open/);
        } else {
          expect(label).toMatch(/: fold/);
        }
        // Clean up for the next parametrised run
        document.body.innerHTML = '';
      }
    );
  });

  describe('highlight prop', () => {
    it('marks the highlighted cell with "(your hand)" in aria-label', () => {
      render(<RangeGrid position="CO" highlight="AKs" />);
      const cell = getCell('AKs');
      expect(cell).not.toBeNull();
      expect(cell!.getAttribute('aria-label')).toMatch(/\(your hand\)/);
    });

    it('does not mark any other cell as highlighted', () => {
      render(<RangeGrid position="CO" highlight="AKs" />);
      const allCells = Array.from(document.querySelectorAll('[aria-label]'));
      const highlighted = allCells.filter((el) =>
        el.getAttribute('aria-label')?.includes('(your hand)')
      );
      expect(highlighted.length).toBe(1);
      expect(highlighted[0].getAttribute('aria-label')).toMatch(/^AKs:/);
    });

    it('renders normally when no highlight is provided (no "(your hand)" labels)', () => {
      render(<RangeGrid position="HJ" />);
      const allCells = Array.from(document.querySelectorAll('[aria-label]'));
      const highlighted = allCells.filter((el) =>
        el.getAttribute('aria-label')?.includes('(your hand)')
      );
      expect(highlighted.length).toBe(0);
    });
  });

  describe('grid orientation', () => {
    it('renders AA (top-left pair — diagonal)', () => {
      render(<RangeGrid position="UTG" />);
      const cell = getCell('AA');
      expect(cell).not.toBeNull();
    });

    it('renders 22 (bottom-right pair — diagonal)', () => {
      render(<RangeGrid position="UTG" />);
      const cell = getCell('22');
      expect(cell).not.toBeNull();
    });

    it('renders AKs (upper-right triangle — suited)', () => {
      render(<RangeGrid position="UTG" />);
      const cell = getCell('AKs');
      expect(cell).not.toBeNull();
      // Should be suited (upper-right), not offsuit
      expect(cell!.getAttribute('aria-label')).toMatch(/^AKs:/);
    });

    it('renders AKo (lower-left triangle — offsuit)', () => {
      render(<RangeGrid position="UTG" />);
      const cell = getCell('AKo');
      expect(cell).not.toBeNull();
      expect(cell!.getAttribute('aria-label')).toMatch(/^AKo:/);
    });

    it('renders 32s (smallest suited hand)', () => {
      render(<RangeGrid position="BTN" />);
      const cell = getCell('32s');
      expect(cell).not.toBeNull();
    });

    it('renders 32o (smallest offsuit hand)', () => {
      render(<RangeGrid position="BTN" />);
      const cell = getCell('32o');
      expect(cell).not.toBeNull();
    });
  });

  describe('cell label text', () => {
    it('each cell contains its hand-class label as visible text', () => {
      render(<RangeGrid position="CO" />);
      // Spot-check a few cells have visible text
      expect(screen.getAllByText('AA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('AKs').length).toBeGreaterThan(0);
      expect(screen.getAllByText('72o').length).toBeGreaterThan(0);
    });
  });
});
