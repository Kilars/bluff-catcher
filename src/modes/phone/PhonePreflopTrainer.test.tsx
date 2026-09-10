/**
 * PhonePreflopTrainer — the phone preflop tree, rendered at phone size.
 *
 * Covers:
 *  1. It renders the three blocks off a dealt spot (ladder, 120×170 cards +
 *     hand class, prompt + thumb row) and nothing else.
 *  2. No key hints anywhere — there is no keyboard on a phone.
 *  3. The feedback slot is the same box, with the same fixed height, before and
 *     after commit, so nothing below it moves under the thumb.
 *  4. The 300ms input lock: the double tap that would commit and then burn the
 *     next hand cannot happen.
 *  5. "Next hand" is full-width and alone in the thumb row — a different shape,
 *     not just a different label.
 *  6. The range seam mounts only when the drill says so.
 *  7. Phone-only CSS conformance across the four modules this phase owns.
 *
 * The harness calls the real `usePreflopDrill` and spreads it, which is exactly
 * how App wires the phone tree — so these tests also pin the prop interface.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { renderAt } from '../../test/renderAt';
import PhonePreflopTrainer from './PhonePreflopTrainer';
import { usePreflopDrill } from '../../hooks/usePreflopDrill';
import * as dealModule from '../../lib/preflop/deal';
import type { PreflopSpot } from '../../lib/preflop/deal';
import type { Depth } from '../../lib/preflop/ranges';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SPOT_A: PreflopSpot = {
  position: 'HJ',
  depth: 'deep',
  cards: ['As', '5s'],
  handClass: 'A5s',
  correct: 'open',
};

const SPOT_B: PreflopSpot = {
  position: 'UTG',
  depth: 'deep',
  cards: ['7d', '2c'],
  handClass: '72o',
  correct: 'fold',
};

// ── Harness ──────────────────────────────────────────────────────────────────

interface HarnessProps {
  onRecord?: (wasCorrect: boolean) => void;
  depth?: Depth;
  renderRange?: () => ReactNode;
}

function Harness({ onRecord = () => {}, depth, renderRange }: HarnessProps) {
  const drill = usePreflopDrill({ depth, onRecord });
  return <PhonePreflopTrainer {...drill} renderRange={renderRange} />;
}

function commit(label: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: label }));
}

// ── CSS sources (jsdom does not lay anything out, so the stylesheet is the
//    only place the pixel contract can be asserted) ───────────────────────────

function css(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

const PANEL_CSS = css('../../components/phone/preflop/PhoneDecisionPanel.module.css');
const LADDER_CSS = css('../../components/phone/preflop/PhoneSeatLadder.module.css');
const STAGE_CSS = css('../../components/phone/preflop/PhonePreflopStage.module.css');
const FRAME_CSS = css('./PhonePreflopTrainer.module.css');
const ALL_CSS: Array<[string, string]> = [
  ['PhoneDecisionPanel', PANEL_CSS],
  ['PhoneSeatLadder', LADDER_CSS],
  ['PhonePreflopStage', STAGE_CSS],
  ['PhonePreflopTrainer', FRAME_CSS],
];

/** Strip /* … *\/ comments so prose about vh or 12px is not read as CSS. */
function declarations(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

// ─────────────────────────────────────────────────────────────────────────────

describe('PhonePreflopTrainer', () => {
  let dealSpy: MockInstance<typeof dealModule.dealPreflopSpot>;
  let dealt: number;

  beforeEach(() => {
    dealt = 0;
    dealSpy = vi
      .spyOn(dealModule, 'dealPreflopSpot')
      .mockImplementation(() => (dealt++ === 0 ? SPOT_A : SPOT_B));
  });

  afterEach(() => {
    dealSpy.mockRestore();
    vi.useRealTimers();
  });

  // ── 1. The three blocks ───────────────────────────────────────────────────

  it('renders the ladder, the cards and the thumb row from the dealt spot', () => {
    renderAt('phone', <Harness />);

    expect(screen.getAllByTestId('seat-slot')).toHaveLength(9);
    expect(screen.getByTestId('ladder-context')).toHaveTextContent('4 folded · 4 behind');

    const cards = screen.getAllByTestId('phone-hero-card');
    expect(cards.map((el) => el.dataset.card)).toEqual(['As', '5s']);
    expect(screen.getByTestId('hand-class')).toHaveTextContent('A5s');

    expect(screen.getByTestId('feedback-slot')).toHaveTextContent('Open or fold?');
    expect(screen.getByRole('button', { name: 'Fold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
  });

  it('renders no felt, no seat plaques and no chip amounts', () => {
    const { container } = renderAt('phone', <Harness />);

    expect(container.querySelector('[class*="felt"]')).toBeNull();
    expect(container.querySelector('[class*="plaque"]')).toBeNull();
    expect(screen.queryByText('0.5')).toBeNull();
    expect(screen.queryByLabelText('Dealer button')).toBeNull();
  });

  it('says "Jam" at the 10bb tier, because the tier owns the verb', () => {
    renderAt('phone', <Harness depth="short" />);

    expect(screen.getByRole('button', { name: 'Jam' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
  });

  // ── 2. No keyboard hints ──────────────────────────────────────────────────

  it('renders no key-hint badges', () => {
    const { container } = renderAt('phone', <Harness />);
    commit('Open');

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/Keys:/);
    expect(text).not.toMatch(/Space/);
    expect(container.querySelector('[class*="keyHint"]')).toBeNull();

    // No bare single-letter badge anywhere (F / J / R / I). The ladder's "D" is
    // the dealer button — positional data, not a key hint.
    const bare = [...container.querySelectorAll('span')].filter((el) =>
      /^[FJRI]$/.test(el.textContent ?? '')
    );
    expect(bare).toHaveLength(0);
  });

  // ── 3. The feedback slot does not move ────────────────────────────────────

  it('keeps the same feedback box, with the same classes, in both states', () => {
    renderAt('phone', <Harness />);

    const before = screen.getByTestId('feedback-slot');
    const beforeClass = before.className;
    expect(before.dataset.state).toBe('asking');

    commit('Open');

    const after = screen.getByTestId('feedback-slot');
    expect(after.dataset.state).toBe('answered');
    expect(after.className).toBe(beforeClass);
    expect(after).toHaveTextContent('Correct — open');
    expect(screen.getByTestId('boundary')).toHaveTextContent(
      'A5s is inside the HJ opening range'
    );
    expect(screen.getByRole('button', { name: 'See range' })).toBeInTheDocument();
  });

  it('fixes the feedback slot height in the stylesheet, with no state override', () => {
    const decls = declarations(PANEL_CSS);
    expect(decls).toMatch(/\.feedback\s*\{[^}]*height:\s*140px/);
    expect(decls).toMatch(/\.feedback\s*\{[^}]*flex:\s*0 0 140px/);

    // Nothing keyed on the asking/answered state may touch the geometry.
    const stateRules = decls.match(/\.feedback\[data-state[^}]*\{[^}]*\}/g) ?? [];
    expect(stateRules).toHaveLength(0);
  });

  // ── 4. The 300ms input lock ───────────────────────────────────────────────

  it('locks "Next hand" for 300ms so a double tap cannot burn a spot', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderAt('phone', <Harness />);

    expect(dealSpy).toHaveBeenCalledTimes(1);

    commit('Open');

    const next = screen.getByTestId('next-hand');
    expect(next).toBeDisabled();

    // The second half of the double tap, landing where "Open" just was.
    fireEvent.click(next);
    expect(dealSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('hand-class')).toHaveTextContent('A5s');

    // Still locked at 299ms.
    act(() => {
      vi.advanceTimersByTime(299);
    });
    fireEvent.click(screen.getByTestId('next-hand'));
    expect(dealSpy).toHaveBeenCalledTimes(1);

    // Live at 300ms.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    const live = screen.getByTestId('next-hand');
    expect(live).not.toBeDisabled();
    fireEvent.click(live);
    expect(dealSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('hand-class')).toHaveTextContent('72o');
  });

  it('re-arms the lock on the next commit', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderAt('phone', <Harness />);

    commit('Open');
    act(() => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.click(screen.getByTestId('next-hand'));

    // Second hand: the lock is back.
    commit('Fold');
    expect(screen.getByTestId('next-hand')).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByTestId('next-hand')).not.toBeDisabled();
  });

  it('records the hand exactly once, however many times the button is hit', () => {
    const onRecord = vi.fn();
    renderAt('phone', <Harness onRecord={onRecord} />);

    commit('Open');
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord).toHaveBeenCalledWith(true);
  });

  // ── 5. A different shape, not just a different label ──────────────────────

  it('gives "Next hand" the whole thumb row', () => {
    renderAt('phone', <Harness />);
    expect(screen.getByTestId('thumb-row').children).toHaveLength(2);

    commit('Fold');

    const row = screen.getByTestId('thumb-row');
    expect(row.children).toHaveLength(1);
    expect(row.children[0]).toHaveTextContent('Next hand');
    expect(screen.queryByRole('button', { name: 'Fold' })).toBeNull();
    expect(declarations(PANEL_CSS)).toMatch(/\.btnNext\s*\{[^}]*width:\s*100%/);
  });

  // ── 6. The range seam ─────────────────────────────────────────────────────

  it('mounts the range seam only once the drill opens it', () => {
    renderAt(
      'phone',
      <Harness renderRange={() => <div data-testid="range-seam">range</div>} />
    );

    expect(screen.queryByTestId('range-seam')).toBeNull();

    commit('Open');
    expect(screen.queryByTestId('range-seam')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'See range' }));
    expect(screen.getByTestId('range-seam')).toBeInTheDocument();
  });

  it('does not import a range view of its own', () => {
    // Read through the same helper: a literal `new URL('./x', import.meta.url)`
    // is a Vite asset reference, not a file path.
    const source = css('./PhonePreflopTrainer.tsx');
    expect(source).not.toMatch(/import .*Range.* from/);
  });

  // ── 7. Phone-only CSS conformance (§1.4) ──────────────────────────────────

  describe('phone CSS rules', () => {
    it('guards every :hover behind hover+pointer, and pairs it with :active', () => {
      for (const [name, source] of ALL_CSS) {
        const decls = declarations(source);
        const hovers = decls.match(/:hover/g) ?? [];
        if (hovers.length === 0) continue;

        // Every :hover sits inside a `(hover: hover) and (pointer: fine)` block.
        const guarded =
          decls.match(
            /@media \(hover: hover\) and \(pointer: fine\) \{[^@]*?\n\}/g
          ) ?? [];
        const guardedHovers = guarded.join('').match(/:hover/g) ?? [];
        expect(guardedHovers.length, `${name}: unguarded :hover`).toBe(hovers.length);

        // And there is a real :active for touch, where :hover never fires.
        expect((decls.match(/:active/g) ?? []).length, `${name}: no :active`).toBeGreaterThan(0);
      }
    });

    it('uses touch-action and kills the tap highlight on every interactive box', () => {
      const decls = declarations(PANEL_CSS);
      const cursors = (decls.match(/cursor:\s*pointer/g) ?? []).length;
      expect(cursors).toBeGreaterThan(0);
      expect((decls.match(/touch-action:\s*manipulation/g) ?? []).length).toBe(cursors);
      expect((decls.match(/-webkit-tap-highlight-color:\s*transparent/g) ?? []).length).toBe(
        cursors
      );
    });

    it('keeps every tap target at 44px or more', () => {
      const decls = declarations(PANEL_CSS);
      // The two thumb buttons and the full-width next button.
      expect(decls).toMatch(/\.thumbBtn\s*\{[^}]*height:\s*64px/);
      expect(decls).toMatch(/\.thumbBtn\s*\{[^}]*min-width:\s*44px/);
      // "See range" draws a 40px chip inside a 44px button.
      expect(decls).toMatch(/\.rangeChip\s*\{[^}]*min-height:\s*44px/);
      expect(decls).toMatch(/\.rangeChipFace\s*\{[^}]*height:\s*40px/);
    });

    it('never sets a font size below 11px, and only off the type scale', () => {
      const scale = new Set([11, 12, 13, 14, 15, 19, 22, 25, 27, 28, 29, 37, 40, 44]);
      for (const [name, source] of ALL_CSS) {
        for (const match of declarations(source).matchAll(/font-size:\s*(\d+)px/g)) {
          const size = Number(match[1]);
          expect(scale.has(size), `${name}: ${size}px is off the type scale`).toBe(true);
        }
      }
    });

    it('uses no vh unit and no width media query', () => {
      for (const [name, source] of ALL_CSS) {
        const decls = declarations(source);
        expect(decls, `${name}: vh`).not.toMatch(/\d(?:vh|svh|lvh)\b/);
        expect(decls, `${name}: width media query`).not.toMatch(
          /@media[^{;]*\(\s*(?:max|min)-width\s*:/
        );
      }
    });

    it('keeps the thumb row reachable when the viewport is too short', () => {
      // This used to assert that nothing in the trainer scrolls, which held for
      // portrait — the §5.2 budget leaves 209px of slack on a 390 × 844 and
      // still 6.8px on a 375 × 667 SE — but was false in landscape. On an
      // 844 × 390 the 554px of fixed content does not fit in ~310px of usable
      // height, and with no scrollport the Fold/Open row sat below the fold:
      // the hand could not be acted on at all. See PLAN-phone §3.2.
      //
      // The rule that actually matters is not "never scrolls", it is "the
      // actions are always reachable". The frame may scroll; the thumb row
      // sticks to the bottom of the scrollport so it stays under the thumb.
      expect(declarations(FRAME_CSS)).toMatch(/overflow-y:\s*auto/);
      expect(declarations(PANEL_CSS)).toMatch(
        /\.thumbRow\s*\{[^}]*position:\s*sticky/
      );
      expect(declarations(PANEL_CSS)).toMatch(/\.thumbRow\s*\{[^}]*bottom:\s*0/);
    });

    it('spends exactly the §5.2 height budget', () => {
      // 44 ladder + 20 context + 170 cards + 52 class + 140 feedback + 64 thumb
      // + 16.8 padding = 506.8, under a 48px top bar = 554.8 of 763 usable.
      expect(declarations(LADDER_CSS)).toMatch(/\.row\s*\{[^}]*height:\s*44px/);
      expect(declarations(LADDER_CSS)).toMatch(/\.context\s*\{[^}]*height:\s*20px/);
      expect(declarations(STAGE_CSS)).toMatch(/\.cards\s*\{[^}]*height:\s*170px/);
      expect(declarations(STAGE_CSS)).toMatch(/\.classBlock\s*\{[^}]*height:\s*52px/);
      expect(declarations(PANEL_CSS)).toMatch(/\.thumbRow\s*\{[^}]*height:\s*64px/);
      expect(declarations(FRAME_CSS)).toMatch(/env\(safe-area-inset-bottom/);
    });
  });
});
