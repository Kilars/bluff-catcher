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

  /**
   * The vertical rhythm (PLAN-phone §5.1 height budget).
   *
   * The frame used to say `justify-content: space-between`, which handed the
   * whole slack budget to a single gap: 198px of nothing between the hero cards
   * and the readout at 390 × 844, 286px at 430 × 932. The proof it was
   * over-budgeted is that a 360 × 640 screen — less height, so less slack —
   * composed better than a 390 × 844 one.
   *
   * The replacement spends the slack in four places as one `dvh`-derived unit
   * and gives the leftover to the readout. These assertions hold the three
   * properties that makes the fix safe, and none of them is visible to a jsdom
   * render (vitest runs with `css: false`).
   */
  describe('the vertical rhythm — where the slack goes', () => {
    const frame = sources.find((s) => s.name === 'PhoneOddsFrame.module.css')!.css;
    const stage = sources.find((s) => s.name === 'PhoneStage.module.css')!.css;
    const bar = sources.find((s) => s.name === 'PhoneCommitBar.module.css')!.css;

    /** The declared `clamp(min, calc(<k>dvh - <c>px), max)`, evaluated at a height. */
    const rhythm = (() => {
      const m = frame.match(
        /--phone-odds-rhythm:\s*clamp\(\s*(-?[\d.]+)px\s*,\s*calc\(\s*([\d.]+)dvh\s*-\s*([\d.]+)px\s*\)\s*,\s*([\d.]+)px\s*\)/
      );
      if (!m) throw new Error('--phone-odds-rhythm is not a clamp(px, calc(dvh - px), px)');
      const [lo, k, c, hi] = m.slice(1).map(Number);
      return (viewportPx: number) => Math.min(hi, Math.max(lo, (k * viewportPx) / 100 - c));
    })();

    it('does not park the slack in one gap', () => {
      expect(frame).not.toMatch(/justify-content:\s*space-between/);
    });

    it('spends the slack in four places, off one dvh-derived unit', () => {
      // Declared once on the frame, consumed by the frame's own top padding…
      expect(frame).toMatch(/--phone-odds-rhythm:\s*clamp\(/);
      expect(frame).toMatch(/padding-top:\s*calc\([^;]*var\(--phone-odds-rhythm\)/);
      // …and by both of the read zone's gaps plus the new one under the chip.
      expect(stage).toMatch(/--phone-stage-gap:\s*calc\([^;]*var\(--phone-odds-rhythm/);
      expect(stage).toMatch(/--phone-stage-chip-gap:\s*calc\([^;]*var\(--phone-odds-rhythm/);
      expect(stage).toMatch(/\.streetChip\s*\{[^}]*margin-bottom:\s*var\(--phone-stage-chip-gap\)/);
    });

    it('keeps the read zone a function of viewport height alone, so it cannot move on commit', () => {
      // Every gap above the label row must resolve from `dvh` and nothing else.
      // A gap that flexed would differ between the 20px asking label and the
      // 108px answering one, and the cards would jump on commit — comparing the
      // answer *to the cards* is the learning act.
      const gapBlock = stage.slice(stage.indexOf('.gapBoardToHero'));
      expect(gapBlock.slice(0, gapBlock.indexOf('}'))).toMatch(/flex:\s*none/);
      expect(stage).not.toMatch(/--phone-stage-(gap|chip-gap):[^;]*flex/);
    });

    it('is exactly 0px on a 640px-tall screen, leaving a 360 × 640 Android as it was', () => {
      // That screen has ~5px of slack after the reveal — no room for a rhythm.
      expect(rhythm(640)).toBe(0);
      expect(rhythm(600)).toBe(0);
    });

    it('is exactly 0px in landscape, so 844 × 390 keeps its scroll behaviour', () => {
      expect(rhythm(390)).toBe(0);
    });

    it('grows with the slack it is there to spend, and is capped before it can pool', () => {
      // 390 × 844 had a 198px hole, 430 × 932 a 286px one. Four gaps share it.
      expect(rhythm(844)).toBeGreaterThan(30);
      expect(rhythm(932)).toBeGreaterThan(rhythm(844));
      // Capped, so a tall viewport cannot reopen the hole in the read zone.
      expect(rhythm(2000)).toBeLessThanOrEqual(61.6);
    });

    it('lets the commit bar grow into the slack but never shrink out of it', () => {
      // Growing puts the button in the thumb zone without `space-between`.
      // Not shrinking is what keeps 844 × 390 honest: there is no slack there,
      // the bar stays at content height, and the frame scrolls beneath it.
      const block = bar.slice(bar.indexOf('.commitBar {'));
      expect(block.slice(0, block.indexOf('}'))).toMatch(/flex:\s*1\s+0\s+auto/);
    });

    it('keeps the commit bar sticky over a scrolling frame — the landscape contract', () => {
      // At 844 × 390 roughly 530px (asking) / 580px (answering) of content does
      // not fit ~346px of frame. Without both halves of this the commit button
      // sits below the fold and the hand cannot be committed at all.
      expect(bar).toMatch(/\.commitBar\s*\{[^}]*position:\s*sticky/);
      expect(bar).toMatch(/\.commitBar\s*\{[^}]*bottom:\s*0/);
      expect(frame).toMatch(/\.frame\s*\{[^}]*overflow-y:\s*auto/);
    });

    it('makes the readout the one elastic slot, in both drill states', () => {
      for (const cls of ['readout', 'readoutRevealed']) {
        const block = bar.slice(bar.indexOf(`.${cls} {`));
        expect(block.slice(0, block.indexOf('}'))).toMatch(/flex:\s*1\s+0\s+auto/);
      }
      // Everything below it is fixed, so the bar, ruler and button hold still.
      for (const cls of ['dial', 'ruler', 'primaryBtn']) {
        const block = bar.slice(bar.indexOf(`.${cls} {`));
        expect(block.slice(0, block.indexOf('}'))).toMatch(/flex:\s*none/);
      }
    });

    it('centres the pending value in its slot rather than pinning it to the top', () => {
      // Top-pinned, the slot's extra height pooled between the number and the
      // bar — a hole with a number above it. Centred, it splits evenly and the
      // baseline sits *further* from the thumb's occlusion cone than before.
      const block = bar.slice(bar.indexOf('.readout {'));
      expect(block.slice(0, block.indexOf('}'))).toMatch(/align-items:\s*center/);
      expect(block.slice(0, block.indexOf('}'))).not.toMatch(/padding-top/);
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
