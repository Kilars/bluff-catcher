/**
 * RangeSheet — navigation tests.
 *
 * Covers the four ways to move between position charts (arrows, tabs, keys,
 * swipe), the clamping at both ends, and the hand highlight only appearing on
 * the hero's own chart.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RangeSheet from './RangeSheet';
import { POSITIONS } from '../lib/preflop/ranges';

function title() {
  return screen.getByRole('heading', { level: 1 }).textContent ?? '';
}

function tab(name: string) {
  const esc = name.replace('+', '\\+');
  // Anchored: "UTG" must not also match "UTG+1"; the hero-seat dot may append
  // "(your seat)" to the accessible name.
  return screen.getByRole('tab', { name: new RegExp(`^${esc}( \\(your seat\\))?$`) });
}

describe('RangeSheet navigation', () => {
  it('renders one tab per position', () => {
    render(<RangeSheet position="UTG" onClose={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(POSITIONS.length);
  });

  it('next/prev arrows step through the seat order', () => {
    render(<RangeSheet position="UTG" onClose={() => {}} />);
    expect(title()).toContain('Under the Gun');

    fireEvent.click(screen.getByLabelText('Next position'));
    expect(title()).toContain('UTG+1');

    fireEvent.click(screen.getByLabelText('Previous position'));
    expect(title()).toContain('Under the Gun');
  });

  it('clamps at both ends and disables the dead arrow', () => {
    render(<RangeSheet position="UTG" onClose={() => {}} />);
    expect(screen.getByLabelText('Previous position')).toBeDisabled();

    fireEvent.click(tab('BTN'));
    expect(title()).toContain('Button');
    expect(screen.getByLabelText('Next position')).toBeDisabled();
  });

  it('tab strip jumps straight to a position', () => {
    render(<RangeSheet position="UTG" onClose={() => {}} />);
    fireEvent.click(tab('CO'));
    expect(title()).toContain('Cutoff');
    expect(tab('CO')).toHaveAttribute('aria-selected', 'true');
  });

  it('arrow keys step positions', () => {
    render(<RangeSheet position="HJ" onClose={() => {}} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(title()).toContain('Cutoff');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(title()).toContain('Hijack');
  });

  it('Escape closes the sheet', () => {
    const onClose = vi.fn();
    render(<RangeSheet position="UTG" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('a horizontal swipe steps a position, a vertical drag does not', () => {
    const { container } = render(<RangeSheet position="HJ" onClose={() => {}} />);
    const body = container.querySelector('[class*="body"]') as HTMLElement;

    // Swipe left → next position
    fireEvent.touchStart(body, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(body, { changedTouches: [{ clientX: 100, clientY: 105 }] });
    expect(title()).toContain('Cutoff');

    // Mostly-vertical drag → no change
    fireEvent.touchStart(body, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(body, { changedTouches: [{ clientX: 190, clientY: 400 }] });
    expect(title()).toContain('Cutoff');
  });

  it('highlights the hero hand only on the hero seat chart', () => {
    render(
      <RangeSheet
        position="BTN"
        heroPosition="BTN"
        highlight="72o"
        onClose={() => {}}
      />
    );
    expect(document.querySelector('[aria-label="72o: fold (your hand)"]')).not.toBeNull();

    // Move away — the same cell is no longer marked as the player's hand
    fireEvent.click(tab('UTG'));
    expect(document.querySelector('[aria-label="72o: fold (your hand)"]')).toBeNull();
  });
});
