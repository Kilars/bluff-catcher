/**
 * PhoneStage — the read zone (PLAN-phone §5.1).
 *
 * Covers:
 *  1. Five board slots on the flop — 3 cards + Turn/River blanks.
 *  2. Five board slots on the turn — 4 cards + a River blank.
 *  3. The street chip carries the ×4 / ×2 distinction in words.
 *  4. Both hero cards render.
 *  5. The component cannot know about the commit: it has no such prop, so the
 *     same props always produce the same markup. (The end-to-end version of
 *     this — the read zone not moving when a real commit lands — is in
 *     PhoneOddsTrainer.test.tsx.)
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAt } from '../../../test/renderAt';
import PhoneStage from './PhoneStage';

const FLOP_BOARD = ['Ks', '4s', '9d'];
const TURN_BOARD = ['Ks', '4s', '9d', '2c'];
const HERO = ['As', '7s'];

describe('PhoneStage', () => {
  describe('board row — always exactly five slots', () => {
    it('renders 3 cards and 2 blanks on the flop', () => {
      renderAt('phone', <PhoneStage hero={HERO} board={FLOP_BOARD} street="flop" />);

      expect(screen.getAllByTestId('phone-board-slot')).toHaveLength(5);
      const blanks = screen.getAllByTestId('phone-board-blank');
      expect(blanks).toHaveLength(2);
      expect(blanks.map((b) => b.textContent)).toEqual(['Turn', 'River']);
    });

    it('renders 4 cards and 1 blank on the turn', () => {
      renderAt('phone', <PhoneStage hero={HERO} board={TURN_BOARD} street="turn" />);

      expect(screen.getAllByTestId('phone-board-slot')).toHaveLength(5);
      const blanks = screen.getAllByTestId('phone-board-blank');
      expect(blanks).toHaveLength(1);
      // The turn is already dealt, so only the River placeholder is left.
      expect(blanks[0]).toHaveTextContent('River');
      expect(screen.getByTestId('phone-board-row')).not.toHaveTextContent('Turn');
    });
  });

  describe('street chip — how the learner knows ×4 from ×2', () => {
    it('says "Flop · 2 to come" on the flop', () => {
      renderAt('phone', <PhoneStage hero={HERO} board={FLOP_BOARD} street="flop" />);
      expect(screen.getByTestId('phone-street-chip')).toHaveTextContent('Flop · 2 to come');
    });

    it('says "Turn · 1 to come" on the turn', () => {
      renderAt('phone', <PhoneStage hero={HERO} board={TURN_BOARD} street="turn" />);
      expect(screen.getByTestId('phone-street-chip')).toHaveTextContent('Turn · 1 to come');
    });
  });

  it('renders both hero cards', () => {
    renderAt('phone', <PhoneStage hero={HERO} board={FLOP_BOARD} street="flop" />);
    const heroRow = screen.getByTestId('phone-hero-row');
    expect(heroRow.children).toHaveLength(2);
    expect(heroRow).toHaveTextContent('A');
    expect(heroRow).toHaveTextContent('7');
  });

  it('renders the same markup for the same spot every time', () => {
    const first = renderAt('phone', <PhoneStage hero={HERO} board={FLOP_BOARD} street="flop" />);
    const before = screen.getByTestId('phone-stage').outerHTML;
    first.unmount();

    renderAt('phone', <PhoneStage hero={HERO} board={FLOP_BOARD} street="flop" />);
    expect(screen.getByTestId('phone-stage').outerHTML).toBe(before);
  });
});
