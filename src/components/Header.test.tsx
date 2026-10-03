/**
 * Header — the mode-aware brand label and stats block.
 *
 * Pins one thing per mode: the brand subtitle text and which stats block
 * renders with which numbers. This is the failure docs/PLAN-3bet.md (phase F2)
 * calls out — a two-way `mode === 'odds' ? … : …` check silently treats
 * 'facing' as 'preflop', which here would mean the right numbers render but
 * under the wrong reset button / label, or facing's own stats prop is ignored
 * entirely in favour of preflop's.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAt } from '../test/renderAt';
import Header from './Header';

const noop = () => {};

function baseProps() {
  return {
    onModeChange: noop,
    depth: 'deep' as const,
    onDepthChange: noop,
    format: 'mtt' as const,
    onFormatChange: noop,
    opponents: 'low' as const,
    onOpponentsChange: noop,
    showDraw: true,
    onShowDrawChange: noop,
    onOpenRanges: noop,
  };
}

describe('Header', () => {
  it('odds mode: "Odds trainer" subtitle and the odds stat block', () => {
    renderAt(
      'desktop',
      <Header
        {...baseProps()}
        mode="odds"
        oddsStats={{
          hands: 12,
          streak: 3,
          errors: [2, 4],
          bands: { green: 5, amber: 3, red: 2 },
        }}
      />
    );

    expect(screen.getByText('Odds trainer')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Streak').nextElementSibling).toHaveTextContent('3');
    expect(screen.queryByText('Accuracy')).not.toBeInTheDocument();
  });

  it('preflop mode: "Preflop RFI · <depth>" subtitle and the preflop stat block', () => {
    renderAt(
      'desktop',
      <Header
        {...baseProps()}
        mode="preflop"
        preflopStats={{ hands: 20, streak: 5, accuracy: 80 }}
      />
    );

    expect(screen.getByText(/Preflop RFI/)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('facing mode: "Facing open" subtitle and facing\'s own stats, not preflop\'s', () => {
    renderAt(
      'desktop',
      <Header
        {...baseProps()}
        mode="facing"
        preflopStats={{ hands: 999, streak: 999, accuracy: 1 }}
        facingStats={{ hands: 7, streak: 2, accuracy: 40 }}
      />
    );

    expect(screen.getByText(/Facing open/)).toBeInTheDocument();
    // The RFI stats, still passed in, must not leak into the facing block.
    expect(screen.queryByText('999')).not.toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('facing mode: reset calls facing\'s own reset, not RFI\'s', () => {
    const onResetFacing = vi.fn();
    const onResetPreflop = vi.fn();
    renderAt(
      'desktop',
      <Header
        {...baseProps()}
        mode="facing"
        preflopStats={{ hands: 1, streak: 1, accuracy: 1, onResetStats: onResetPreflop }}
        facingStats={{ hands: 1, streak: 1, accuracy: 1, onResetStats: onResetFacing }}
      />
    );

    screen.getByRole('button', { name: 'Reset' }).click();
    expect(onResetFacing).toHaveBeenCalledTimes(1);
    expect(onResetPreflop).not.toHaveBeenCalled();
  });
});
