/**
 * The phone-only correctness rules (PLAN-phone §1.4), asserted against the
 * stylesheets themselves.
 *
 * These are the defects that exist *only* on a phone, and none of them is
 * visible to a jsdom render: vitest runs with `css: false`, so a rule that is
 * wrong is a rule no component test can see. The audit found 21 unguarded
 * `:hover` rules, touch targets down to 32px, `vh` units that jump with the iOS
 * URL bar, and `touch-action` missing almost everywhere — all of it in CSS.
 * Reading the files is the only way to hold the line.
 *
 * Scope is this directory: the three modules that make up the phone odds tree.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = 'src/components/phone/odds';

const FILES = [
  'PhoneStage.module.css',
  'PhoneCommitBar.module.css',
  'PhoneOddsFrame.module.css',
] as const;

/**
 * Strip block comments before asserting.
 *
 * These files carry long explanatory headers, and those headers necessarily
 * quote the very things being guarded against — "the only `touch-action: none`
 * is on the drag field", "Full-bleed with no transform". Matching raw source
 * flags the prose describing the rule as though it were the rule, so the guard
 * fails on a file that is entirely correct. Assert against the declarations.
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const sources = FILES.map((name) => ({
  name,
  css: stripComments(readFileSync(resolve(DIR, name), 'utf8')),
}));

/** The DECISIONS.md type scale, with everything under 11px removed. */
const TYPE_SCALE = [11, 12, 13, 14, 15, 19, 22, 25, 27, 28, 29, 37, 40, 44];

describe('phone odds stylesheets', () => {
  describe.each(sources)('$name', ({ css }) => {
    it('guards every :hover behind hover + pointer: fine', () => {
      const blocks = css.split('@media (hover: hover) and (pointer: fine)');
      // Anything before the first guarded block must contain no :hover at all;
      // the guarded blocks are the only place one may appear.
      expect(blocks[0]).not.toMatch(/:hover/);
    });

    it('pairs every hovered selector with an :active state', () => {
      const hovered = [...css.matchAll(/\.(\w+)[^{]*:hover/g)].map((m) => m[1]);
      for (const cls of hovered) {
        expect(css).toMatch(new RegExp(`\\.${cls}[^{]*:active`));
      }
    });

    it('uses no width media query — the break lives in data-layout', () => {
      expect(css).not.toMatch(/@media[^{;]*\(\s*(max|min)-width\s*:/);
    });

    it('uses dvh, never vh — vh does not exclude the iOS URL bar', () => {
      expect(css.replace(/dvh/g, '')).not.toMatch(/\d\s*vh\b/);
    });

    it('applies no transform — the felt was the only thing that needed one', () => {
      expect(css).not.toMatch(/(^|[^-\w])transform\s*:/);
    });

    it('sets no font size below 11px, and none off the type scale', () => {
      const sizes = [...css.matchAll(/font-size:\s*(?:[^;]*?\b)?(\d+(?:\.\d+)?)px/g)].map((m) =>
        Number(m[1])
      );
      for (const size of sizes) {
        expect(TYPE_SCALE).toContain(size);
      }
    });
  });

  describe('PhoneCommitBar.module.css — the touch contract', () => {
    const css = sources.find((s) => s.name === 'PhoneCommitBar.module.css')!.css;

    it('gives every button touch-action: manipulation, killing double-tap zoom', () => {
      for (const cls of ['explainBtn', 'primaryBtn']) {
        const block = css.slice(css.indexOf(`.${cls} {`));
        expect(block.slice(0, block.indexOf('}'))).toMatch(/touch-action:\s*manipulation/);
      }
    });

    it('reserves touch-action: none for the drag field alone', () => {
      const none = [...css.matchAll(/touch-action:\s*none/g)];
      expect(none).toHaveLength(1);
      const fieldBlock = css.slice(css.indexOf('.field {'));
      expect(fieldBlock.slice(0, fieldBlock.indexOf('}'))).toMatch(/touch-action:\s*none/);
    });

    it('kills the tap highlight on everything a finger lands on', () => {
      const highlights = [...css.matchAll(/-webkit-tap-highlight-color:\s*transparent/g)];
      expect(highlights.length).toBeGreaterThanOrEqual(3); // ? button, primary, field
    });

    it('keeps every tap target at 44px or more', () => {
      expect(css).toMatch(/\.explainBtn\s*{[^}]*width:\s*44px/);
      expect(css).toMatch(/\.explainBtn\s*{[^}]*height:\s*44px/);
      expect(css).toMatch(/\.primaryBtn\s*{[^}]*height:\s*56px/);
      expect(css).toMatch(/\.drawHeading\s*{[^}]*min-height:\s*44px/);
    });

    it('is 72px of bar inside a 120px drag field', () => {
      expect(css).toMatch(/\.dial\s*{[^}]*height:\s*72px/);
      // 24px of slop above and below the 72px bar = 120px of contact area.
      expect(css).toMatch(/\.field\s*{[^}]*top:\s*-24px/);
      expect(css).toMatch(/\.field\s*{[^}]*bottom:\s*-24px/);
    });

    it('runs the bar and its ruler full-bleed, for the 8 points of resolution', () => {
      expect(css).toMatch(/\.dial\s*{[^}]*margin-inline:\s*calc\(50% - 50vw\)/);
      expect(css).toMatch(/\.ruler\s*{[^}]*margin-inline:\s*calc\(50% - 50vw\)/);
    });

    it('pads for the home indicator', () => {
      expect(css).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom/);
    });
  });

  describe('PhoneOddsFrame.module.css — the shell', () => {
    const css = sources.find((s) => s.name === 'PhoneOddsFrame.module.css')!.css;

    it('pads for the notch', () => {
      expect(css).toMatch(/padding-top:.*safe-area-inset-top/);
    });

    it('claims no fixed viewport height, so phone chrome can sit above it', () => {
      expect(css).not.toMatch(/height:\s*100dvh/);
    });
  });

  describe('PhoneStage.module.css — the board arithmetic', () => {
    const css = sources.find((s) => s.name === 'PhoneStage.module.css')!.css;

    it('clamps the board card width so a 360px Android degrades, not overflows', () => {
      expect(css).toMatch(/--phone-board-card-w:\s*clamp\(52px, calc\(20vw - 11\.52px\), 66px\)/);
    });

    it('keeps the 8.4px board gap the 363.6px row depends on', () => {
      expect(css).toMatch(/\.boardRow\s*{[^}]*gap:\s*var\(--space-3\)/);
    });

    it('renders hero cards larger than the desktop 82 × 116', () => {
      expect(css).toMatch(/\.heroSlot\s*{[^}]*width:\s*96px/);
      expect(css).toMatch(/\.heroSlot\s*{[^}]*height:\s*136px/);
    });
  });
});
