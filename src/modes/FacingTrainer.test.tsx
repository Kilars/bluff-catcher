/**
 * FacingTrainer — render + interaction, desktop and phone trees.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { screen, fireEvent, cleanup, within } from '@testing-library/react';
import { renderAt } from '../test/renderAt';
import FacingTrainer from './FacingTrainer';
import * as dealModule from '../lib/preflop/facingDeal';
import type { FacingSpot } from '../lib/preflop/facingDeal';
import { BRIEFED_KEY } from '../lib/preflop/briefed';
import type { usePreflopStats } from '../hooks/usePreflopStats';

const SPOT: FacingSpot = {
  opener: 'HJ',
  bucket: 'late',
  cards: ['As', '8s'],
  handClass: 'A8s',
  correct: '3bet',
  kind: 'bluff',
};

const NEXT: FacingSpot = {
  opener: 'UTG',
  bucket: 'early',
  cards: ['7d', '2c'],
  handClass: '72o',
  correct: 'fold',
};

function fakeStats(): ReturnType<typeof usePreflopStats> {
  return {
    hands: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    accuracy: 0,
    record: vi.fn(),
    reset: vi.fn(),
  } as unknown as ReturnType<typeof usePreflopStats>;
}

function briefed() {
  localStorage.setItem(BRIEFED_KEY, JSON.stringify(['facing']));
}

describe('FacingTrainer', () => {
  let dealSpy: MockInstance<typeof dealModule.dealFacingSpot>;

  beforeEach(() => {
    localStorage.clear();
    let n = 0;
    dealSpy = vi
      .spyOn(dealModule, 'dealFacingSpot')
      .mockImplementation(() => (n++ === 0 ? SPOT : NEXT));
  });

  afterEach(() => {
    cleanup();
    dealSpy.mockRestore();
  });

  describe('desktop', () => {
    it('shows the opener raise chip, the bucket on its plaque, and the hand', () => {
      briefed();
      renderAt('desktop', <FacingTrainer stats={fakeStats()} />);
      expect(screen.getByTestId('raise-chip')).toHaveTextContent('2.5');
      expect(screen.getByTestId('opener-tag')).toHaveTextContent('vs Late');
      expect(screen.getByText('raises 2.5bb')).toBeInTheDocument();
      expect(screen.getByText(/vs open · 50bb\+/)).toBeInTheDocument();
      expect(screen.getByText('A8s')).toBeInTheDocument();
    });

    it.each([
      ['Fold', false],
      ['Call', false],
      ['3-bet', true],
    ] as const)('%s button commits and records', (label, correct) => {
      briefed();
      const stats = fakeStats();
      renderAt('desktop', <FacingTrainer stats={stats} />);
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}$`) }));
      expect(stats.record).toHaveBeenCalledTimes(1);
      expect(stats.record).toHaveBeenCalledWith(correct);
      expect(screen.getByTestId('verdict')).toHaveTextContent(
        correct ? 'Correct — 3-bet (bluff)' : 'Wrong — this is a 3-bet (bluff)'
      );
      expect(screen.queryByRole('button', { name: /^F Fold$/ })).not.toBeInTheDocument();
    });

    it('Next hand deals a new spot', () => {
      briefed();
      renderAt('desktop', <FacingTrainer stats={fakeStats()} />);
      fireEvent.click(screen.getByRole('button', { name: /Call$/ }));
      fireEvent.click(screen.getByRole('button', { name: /Next hand/ }));
      expect(screen.getByText('72o')).toBeInTheDocument();
      expect(screen.getByTestId('opener-tag')).toHaveTextContent('vs Early');
    });

    it('range sheet shows the bucket chart in four colours with legend and footnote', () => {
      briefed();
      renderAt('desktop', <FacingTrainer stats={fakeStats()} />);
      fireEvent.click(screen.getByRole('button', { name: /3-bet$/ }));
      fireEvent.click(screen.getByRole('button', { name: /Range/ }));

      expect(
        screen.getByRole('heading', { name: 'BTN vs Late (UTG+2, LJ, HJ, CO)' })
      ).toBeInTheDocument();
      expect(screen.getByTestId('range-legend')).toBeInTheDocument();
      expect(screen.getByTestId('range-footnote')).toHaveTextContent(/HJ\/CO/);
      expect(screen.getByLabelText('A8s: 3-bet (bluff) (your hand)')).toBeInTheDocument();
      expect(screen.getByLabelText('AQo: 3-bet (value)')).toBeInTheDocument();
      expect(screen.getByLabelText('AJo: call')).toBeInTheDocument();
      expect(screen.getByLabelText('72o: fold')).toBeInTheDocument();
      // No RFI navigator on a fixed chart.
      expect(screen.queryByRole('tablist', { name: 'Position' })).not.toBeInTheDocument();
    });

    it('briefs once, then not again; Info reopens it', () => {
      const first = renderAt('desktop', <FacingTrainer stats={fakeStats()} />);
      expect(
        screen.getByRole('heading', { name: 'Fold, call or 3-bet on the button' })
      ).toBeInTheDocument();
      expect(screen.getByText(/J means call here/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /close situation info/i }));
      first.unmount();

      renderAt('desktop', <FacingTrainer stats={fakeStats()} />);
      expect(screen.queryByText(/Fold, call or 3-bet on the button/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Info/ }));
      expect(screen.getByText(/JJ and TT always call/)).toBeInTheDocument();
    });
  });

  describe('phone', () => {
    it('shows the opener on the ladder and commits via the three thumb buttons', () => {
      briefed();
      const stats = fakeStats();
      renderAt('phone', <FacingTrainer stats={stats} />);
      expect(screen.getByTestId('phone-facing-trainer')).toBeInTheDocument();
      const hj = screen
        .getAllByTestId('seat-slot')
        .find((s) => s.getAttribute('data-label') === 'HJ')!;
      expect(hj).toHaveAttribute('data-state', 'opener');
      expect(hj).toHaveTextContent('2.5');
      expect(screen.getByTestId('ladder-context')).toHaveTextContent('HJ raises 2.5bb · vs Late · 50bb+');

      expect(screen.getByTestId('decision-fold')).toBeInTheDocument();
      expect(screen.getByTestId('decision-call')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('decision-3bet'));
      expect(stats.record).toHaveBeenCalledWith(true);
      expect(screen.getByTestId('verdict')).toHaveTextContent('Correct — 3-bet (bluff)');
    });

    it('range view shows the fixed bucket chart', () => {
      briefed();
      renderAt('phone', <FacingTrainer stats={fakeStats()} />);
      fireEvent.click(screen.getByTestId('decision-call'));
      fireEvent.click(screen.getByRole('button', { name: /See range/ }));

      expect(screen.getByText('BTN vs Late (UTG+2, LJ, HJ, CO)')).toBeInTheDocument();
      const cells = screen.getByTestId('grid-cells');
      expect(within(cells).getByLabelText('A8s: 3-bet (bluff) (your hand)')).toBeInTheDocument();
      expect(screen.getByTestId('range-legend')).toBeInTheDocument();
      expect(screen.getByTestId('range-footnote')).toBeInTheDocument();
      expect(screen.queryByTestId('boundary-sentence')).not.toBeInTheDocument();
    });

    it('briefs once on phone too, without the key card', () => {
      const first = renderAt('phone', <FacingTrainer stats={fakeStats()} />);
      expect(screen.getByText(/JJ and TT always call/)).toBeInTheDocument();
      expect(screen.queryByText('Keys')).not.toBeInTheDocument();
      first.unmount();

      renderAt('phone', <FacingTrainer stats={fakeStats()} />);
      expect(screen.queryByText(/JJ and TT always call/)).not.toBeInTheDocument();
    });
  });
});
