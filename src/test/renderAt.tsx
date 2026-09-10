/**
 * renderAt — render a tree as if the viewport were a phone (or not).
 *
 * jsdom reports a 1024 × 768 window and does **not** implement matchMedia.
 * useLayoutMode therefore resolves to 'desktop' in every test that does not say
 * otherwise, and `data-layout` is never stamped, so every
 * `:root[data-layout="phone"]` rule is dead and every phone branch is unvisited.
 * That failure is silent: a test called "renders the phone stage" passes while
 * rendering the desktop one. This helper is the fix, and per PLAN-phone §4.3 it
 * is the third of the three anti-drift guards (shared hooks, the CI grep, this).
 *
 * It does two things, both of which are needed:
 *
 *   1. Stubs window.matchMedia so useLayoutMode's queries answer for the mode
 *      asked for. The stub honours the *real* query strings from
 *      lib/breakpoints.ts, so a change to a breakpoint cannot quietly make the
 *      stub disagree with the app.
 *   2. Writes document.documentElement.dataset.layout up front, before render,
 *      so CSS-module class assertions and anything reading the attribute during
 *      the first render see the right value — useLayoutMode's own stamp lands
 *      in an effect, which is one commit too late for that.
 *
 * Both are undone when the test file's cleanup runs, so a suite can mix modes
 * freely:
 *
 *     renderAt('phone', <App />);
 *     expect(screen.queryByTestId('felt')).toBeNull();
 *
 * The stubbed MediaQueryList is inert — it has addEventListener /
 * removeEventListener so subscription and cleanup are exercised, but it never
 * dispatches. A test that needs to simulate a rotation should call
 * `setLayoutMode()` and re-render, or drive the returned `dispatch` from
 * `stubMatchMedia`.
 */

import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { afterEach } from 'vitest';
import type { ReactElement } from 'react';
import {
  DESKTOP_QUERY,
  PHONE_QUERY,
  type LayoutMode,
} from '../lib/breakpoints';

// ─── Query answering ──────────────────────────────────────────────────────────

/**
 * What each of the two real queries should report for a given mode.
 *
 *   phone    short edge < 600 — portrait 390 × 844 or landscape 844 × 390
 *   compact  600 – 1023, e.g. a 768-wide iPad in portrait
 *   desktop  >= 1024
 *
 * Anything else the app asks matchMedia is answered `false`, which is the
 * right default for feature queries like `(hover: hover)` and
 * `(prefers-reduced-motion: reduce)` in a test.
 */
function answers(mode: LayoutMode): Record<string, boolean> {
  return {
    [PHONE_QUERY]: mode === 'phone',
    [DESKTOP_QUERY]: mode === 'desktop',
  };
}

// ─── matchMedia stub ──────────────────────────────────────────────────────────

interface StubbedMatchMedia {
  /** Fire a `change` on every list created so far, as a rotation would. */
  dispatch: (mode: LayoutMode) => void;
  /** Put back whatever window.matchMedia was (usually undefined). */
  restore: () => void;
}

/**
 * Replace window.matchMedia with one that answers for `mode`. Returned so a
 * test can drive a rotation; `renderAt` and the automatic afterEach hook handle
 * the common case where it is fire-and-forget.
 */
export function stubMatchMedia(mode: LayoutMode): StubbedMatchMedia {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  let current = mode;

  interface Entry {
    list: MediaQueryList;
    query: string;
    listeners: Set<(event: MediaQueryListEvent) => void>;
  }
  const entries: Entry[] = [];

  const make = (query: string): MediaQueryList => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const list = {
      get matches() {
        return answers(current)[query] ?? false;
      },
      media: query,
      onchange: null,
      addEventListener: (type: string, fn: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.add(fn);
      },
      removeEventListener: (type: string, fn: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.delete(fn);
      },
      // Deprecated Safari-era pair, present so nothing trips over its absence.
      addListener: (fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
      removeListener: (fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn),
      dispatchEvent: () => true,
    } as unknown as MediaQueryList;
    entries.push({ list, query, listeners });
    return list;
  };

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => make(query),
  });

  return {
    dispatch(next: LayoutMode) {
      current = next;
      for (const entry of entries) {
        const event = {
          matches: answers(next)[entry.query] ?? false,
          media: entry.query,
        } as MediaQueryListEvent;
        for (const fn of [...entry.listeners]) fn(event);
      }
    },
    restore() {
      if (previous) Object.defineProperty(window, 'matchMedia', previous);
      else Reflect.deleteProperty(window, 'matchMedia');
    },
  };
}

// ─── data-layout stamp ────────────────────────────────────────────────────────

/**
 * Set `data-layout` on <html> the way index.html's first-paint script does.
 * Exported for tests that assert on CSS-keyed structure without rendering the
 * hook at all.
 */
export function setLayoutMode(mode: LayoutMode): void {
  document.documentElement.dataset.layout = mode;
}

/** Remove the stamp, returning the document to its pre-test state. */
export function clearLayoutMode(): void {
  delete document.documentElement.dataset.layout;
}

// ─── renderAt ─────────────────────────────────────────────────────────────────

let activeStub: StubbedMatchMedia | null = null;

afterEach(() => {
  activeStub?.restore();
  activeStub = null;
  clearLayoutMode();
});

/**
 * Render `ui` with the environment configured for `mode`.
 *
 * Returns Testing Library's usual RenderResult plus `dispatch`, which flips the
 * stubbed queries and fires `change` on the live MediaQueryLists — i.e. it
 * simulates a rotation or a desktop window drag, and useLayoutMode will
 * re-render through it exactly as it would in a browser.
 */
export function renderAt(
  mode: LayoutMode,
  ui: ReactElement,
  options?: RenderOptions
): RenderResult & { dispatch: (next: LayoutMode) => void } {
  activeStub?.restore();
  const stub = stubMatchMedia(mode);
  activeStub = stub;
  setLayoutMode(mode);

  const result = render(ui, options);
  return Object.assign(result, {
    dispatch: (next: LayoutMode) => {
      stub.dispatch(next);
      setLayoutMode(next);
    },
  });
}
