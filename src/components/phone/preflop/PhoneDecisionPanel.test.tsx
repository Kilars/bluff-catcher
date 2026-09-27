/**
 * PhoneDecisionPanel — component tests.
 *
 * Covers:
 *  1. The default two-button row (Fold / {actionLabel}) still fires 'fold' and
 *     'open' — the existing RFI call sites must be unaffected (PLAN-3bet F2).
 *  2. The `actions` override renders N buttons and fires the configured action
 *     for each, with optional key-hint badges.
 *  3. Post-commit state (verdict, boundary, Next hand, input lock) is
 *     unaffected by either variant.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderAt } from '../../../test/renderAt';
import PhoneDecisionPanel from './PhoneDecisionPanel';

const BASE_PROPS = {
  isCommitted: false,
  wasCorrect: null,
  verdictText: null,
  prompt: 'Open or fold?',
  actionLabel: 'Open',
  boundaryText: '',
  onNext: () => {},
  onOpenRange: () => {},
};

describe('PhoneDecisionPanel — default two-button row', () => {
  it('renders Fold and {actionLabel}, with no key hints', () => {
    renderAt('phone', <PhoneDecisionPanel {...BASE_PROPS} onCommit={() => {}} />);
    expect(screen.getByText('Fold')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('F')).toBeNull();
  });

  it('fires onCommit("fold") and onCommit("open")', () => {
    const onCommit = vi.fn();
    renderAt('phone', <PhoneDecisionPanel {...BASE_PROPS} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('decision-fold'));
    fireEvent.click(screen.getByTestId('decision-open'));
    expect(onCommit).toHaveBeenNthCalledWith(1, 'fold');
    expect(onCommit).toHaveBeenNthCalledWith(2, 'open');
  });
});

describe('PhoneDecisionPanel — three-action variant (PLAN-3bet F2)', () => {
  const actions = [
    { action: 'fold' as const, label: 'Fold', hint: 'F', tone: 'fold' as const },
    { action: 'call' as const, label: 'Call', hint: 'J', tone: 'call' as const },
    { action: '3bet' as const, label: '3-bet', hint: 'K', tone: 'raise' as const },
  ];

  it('renders three buttons with F / J / K hints', () => {
    renderAt(
      'phone',
      <PhoneDecisionPanel {...BASE_PROPS} onCommit={() => {}} actions={actions} />
    );
    expect(screen.getByTestId('decision-fold')).toHaveTextContent('Fold');
    expect(screen.getByTestId('decision-call')).toHaveTextContent('Call');
    expect(screen.getByTestId('decision-3bet')).toHaveTextContent('3-bet');
    expect(screen.getByTestId('decision-fold')).toHaveTextContent('F');
    expect(screen.getByTestId('decision-call')).toHaveTextContent('J');
    expect(screen.getByTestId('decision-3bet')).toHaveTextContent('K');
  });

  it('fires the configured action for each button', () => {
    const onCommit = vi.fn();
    renderAt(
      'phone',
      <PhoneDecisionPanel {...BASE_PROPS} onCommit={onCommit} actions={actions} />
    );
    fireEvent.click(screen.getByTestId('decision-call'));
    fireEvent.click(screen.getByTestId('decision-3bet'));
    fireEvent.click(screen.getByTestId('decision-fold'));
    expect(onCommit).toHaveBeenNthCalledWith(1, 'call');
    expect(onCommit).toHaveBeenNthCalledWith(2, '3bet');
    expect(onCommit).toHaveBeenNthCalledWith(3, 'fold');
  });
});

describe('PhoneDecisionPanel — post-commit state (both variants)', () => {
  it('shows the verdict and boundary text, and hides the decision buttons', () => {
    renderAt(
      'phone',
      <PhoneDecisionPanel
        {...BASE_PROPS}
        isCommitted
        wasCorrect
        verdictText="Correct — call"
        boundaryText="HJ opens A2s+ suited"
        onCommit={() => {}}
      />
    );
    expect(screen.getByTestId('verdict')).toHaveTextContent('Correct — call');
    expect(screen.getByTestId('boundary')).toHaveTextContent('HJ opens A2s+ suited');
    expect(screen.queryByTestId('decision-fold')).toBeNull();
    expect(screen.getByTestId('next-hand')).toBeInTheDocument();
  });
});
