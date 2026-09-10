/**
 * PhoneStatsPill + PhoneStatsSheet — the collapsed pair of numbers, and the
 * sheet it expands into.
 *
 * The pill's contract is "two glanceable numbers, both of which move on
 * commit", and it differs per mode: streak + the three-dot band tally for odds,
 * streak + accuracy for preflop. That difference is the thing worth pinning —
 * a pill that shows an odds band tally in preflop mode is showing three zeros
 * forever.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderAt } from '../../test/renderAt';
import type { CategoryStat } from '../../hooks/useStats';
import PhoneStatsPill from './PhoneStatsPill';
import PhoneStatsSheet from './PhoneStatsSheet';

const noop = () => {};

describe('PhoneStatsPill', () => {
  it('odds mode: streak and the three band counts', () => {
    renderAt(
      'phone',
      <PhoneStatsPill
        mode="odds"
        streak={7}
        bands={{ green: 12, amber: 5, red: 2 }}
        onPress={noop}
      />
    );

    const pill = screen.getByTestId('phone-stats-pill');
    expect(pill).toHaveTextContent('Streak');
    expect(pill).toHaveTextContent('7');
    expect(pill).toHaveTextContent('12');
    expect(pill).toHaveTextContent('5');
    expect(pill).toHaveTextContent('2');
    // Dots carry the colour; the accessible name carries the meaning.
    expect(pill).toHaveAccessibleName(
      'Session stats. Streak 7. 12 on the money, 5 close, 2 off. Opens details.'
    );
  });

  it('preflop mode: streak and accuracy, not a band tally', () => {
    renderAt(
      'phone',
      <PhoneStatsPill mode="preflop" streak={4} accuracy={72.4} hands={25} onPress={noop} />
    );

    const pill = screen.getByTestId('phone-stats-pill');
    expect(pill).toHaveTextContent('4');
    expect(pill).toHaveTextContent('72%');
    expect(pill).toHaveAccessibleName(
      'Session stats. Streak 4. Accuracy 72%. Opens details.'
    );
  });

  it('preflop accuracy reads as — before the first hand', () => {
    renderAt(
      'phone',
      <PhoneStatsPill mode="preflop" streak={0} accuracy={0} hands={0} onPress={noop} />
    );
    expect(screen.getByTestId('phone-stats-pill')).toHaveTextContent('—');
  });

  it('tapping the pill opens the sheet', () => {
    const onPress = vi.fn();
    renderAt(
      'phone',
      <PhoneStatsPill mode="odds" streak={0} bands={{ green: 0, amber: 0, red: 0 }} onPress={onPress} />
    );

    fireEvent.click(screen.getByTestId('phone-stats-pill'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('PhoneStatsSheet', () => {
  function oddsSheet(overrides: { perCategory?: Record<string, CategoryStat> } = {}) {
    const props = {
      mode: 'odds' as const,
      hands: 20,
      streak: 3,
      bestStreak: 9,
      errors: [2, 4, 6, 8],
      bands: { green: 12, amber: 5, red: 3 },
      perCategory: {
        flushDraw: { n: 8, errors: [1, 3], bands: { green: 6, amber: 2, red: 0 } },
        gutshot: { n: 12, errors: [10, 20], bands: { green: 6, amber: 3, red: 3 } },
      },
      onClose: vi.fn(),
      onReset: vi.fn(),
      ...overrides,
    };
    renderAt('phone', <PhoneStatsSheet {...props} />);
    return props;
  }

  it('shows hands, streak, best streak and avg error', () => {
    oddsSheet();
    const body = within(screen.getByTestId('phone-sheet-body'));

    expect(body.getByText('Hands').nextElementSibling).toHaveTextContent('20');
    expect(body.getByText('Best streak').nextElementSibling).toHaveTextContent('9');
    // mean(2,4,6,8) = 5.0
    expect(body.getByText('Avg error').nextElementSibling).toHaveTextContent('±5.0');
  });

  it('shows the full band tally with its share of the session', () => {
    oddsSheet();
    const body = within(screen.getByTestId('phone-sheet-body'));

    expect(body.getByText('On the money')).toBeInTheDocument();
    expect(body.getByText('Close')).toBeInTheDocument();
    expect(body.getByText('Off')).toBeInTheDocument();
    // 12 of 20 committed hands.
    expect(body.getByText('60%')).toBeInTheDocument();
  });

  it('shows the per-category breakdown, most-drilled first', () => {
    oddsSheet();
    const body = within(screen.getByTestId('phone-sheet-body'));

    const names = [...screen.getByTestId('phone-sheet-body').querySelectorAll('[class*="catName"]')].map(
      (el) => el.textContent
    );
    expect(names).toEqual(['Gutshot', 'Flush draw']);
    expect(body.getByText('By draw')).toBeInTheDocument();
  });

  it('says so when there is no breakdown yet', () => {
    oddsSheet({ perCategory: {} });
    expect(screen.getByText('Nothing yet — commit a hand.')).toBeInTheDocument();
  });

  it('preflop mode swaps avg error for accuracy and the tally for correct/wrong', () => {
    renderAt(
      'phone',
      <PhoneStatsSheet
        mode="preflop"
        hands={25}
        correct={18}
        streak={2}
        bestStreak={6}
        accuracy={72}
        onClose={noop}
        onReset={noop}
      />
    );
    const body = within(screen.getByTestId('phone-sheet-body'));

    expect(body.getByText('Accuracy').nextElementSibling).toHaveTextContent('72%');
    expect(body.getByText('Correct').nextElementSibling).toHaveTextContent('18');
    expect(body.getByText('Wrong').nextElementSibling).toHaveTextContent('7');
    expect(body.queryByText('By draw')).toBeNull();
  });

  it('Reset lives here, and takes two taps', () => {
    const props = oddsSheet();

    fireEvent.click(screen.getByRole('button', { name: /Reset stats/ }));
    expect(props.onReset).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Tap again to reset/ }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('is a PhoneSheet — sticky footer, and the × closes it', () => {
    const props = oddsSheet();

    expect(screen.getByTestId('phone-sheet-footer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close Session stats' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
