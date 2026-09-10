/**
 * useLayoutMode — the three modes, the short-edge rule, the stamp, the cleanup.
 *
 * The hook is the app's only viewport read, so these are the tests that stop a
 * landscape phone or a 768px tablet quietly landing on the wrong tree. They
 * drive matchMedia directly rather than through renderAt(), because the point
 * is to check what the hook does with a given set of query answers — renderAt
 * is what the *component* tests use, and it is exercised here only for the
 * parts of the contract it owns.
 */

import { renderHook, act, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLayoutMode } from './useLayoutMode';
import { renderAt } from '../test/renderAt';
import { DESKTOP_QUERY, PHONE_QUERY } from '../lib/breakpoints';

// ─── A matchMedia driven by a real viewport size ──────────────────────────────

interface FakeList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

/**
 * Answer the two real query strings from an actual width × height, so the tests
 * assert the *rule* (short edge under 600) and not a hand-written truth table
 * that could drift from the query the hook really asks.
 */
function installMatchMedia(width: number, height: number) {
  const lists = new Map<string, FakeList>();
  const listeners = new Map<string, Set<() => void>>();

  const evaluate = (query: string): boolean => {
    if (query === PHONE_QUERY) return width <= 599 || height <= 599;
    if (query === DESKTOP_QUERY) return width >= 1024;
    return false;
  };

  const matchMedia = vi.fn((query: string): MediaQueryList => {
    const existing = lists.get(query);
    if (existing) {
      existing.matches = evaluate(query);
      return existing as unknown as MediaQueryList;
    }
    const set = new Set<() => void>();
    listeners.set(query, set);
    const list: FakeList = {
      matches: evaluate(query),
      media: query,
      addEventListener: vi.fn((type: string, fn: () => void) => {
        if (type === 'change') set.add(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: () => void) => {
        if (type === 'change') set.delete(fn);
      }),
    };
    lists.set(query, list);
    return list as unknown as MediaQueryList;
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: matchMedia,
  });

  return {
    matchMedia,
    lists,
    /** Move the viewport and fire `change` the way a real rotation would. */
    resizeTo(nextWidth: number, nextHeight: number) {
      width = nextWidth;
      height = nextHeight;
      for (const [query, list] of lists) list.matches = evaluate(query);
      for (const set of listeners.values()) for (const fn of [...set]) fn();
    },
  };
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  delete document.documentElement.dataset.layout;
});

// ─── Mode selection ───────────────────────────────────────────────────────────

describe('useLayoutMode', () => {
  it('is phone on a portrait phone (390 × 844)', () => {
    installMatchMedia(390, 844);
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current).toBe('phone');
  });

  it('is phone on a landscape phone (844 × 390) — the short edge decides', () => {
    // 844 is wider than every old breakpoint, including the 820 this replaced.
    // Width-only detection puts this device on the desktop tree with 390px of
    // height for a layout that wants 860; the short-edge rule catches it.
    installMatchMedia(844, 390);
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current).toBe('phone');
  });

  it('is phone at 599 × 900, and compact one pixel wider', () => {
    installMatchMedia(599, 900);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('phone');

    installMatchMedia(600, 900);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('compact');
  });

  it('is compact on a portrait tablet (768 × 1024)', () => {
    installMatchMedia(768, 1024);
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current).toBe('compact');
  });

  it('is desktop at 1024 and above', () => {
    installMatchMedia(1024, 768);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('desktop');

    installMatchMedia(1920, 1080);
    expect(renderHook(() => useLayoutMode()).result.current).toBe('desktop');
  });

  it('falls back to desktop when matchMedia is missing (jsdom, SSR)', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    const { result } = renderHook(() => useLayoutMode());
    expect(result.current).toBe('desktop');
  });

  // ─── The data-layout side effect ────────────────────────────────────────────

  it('stamps data-layout on <html>', () => {
    installMatchMedia(390, 844);
    renderHook(() => useLayoutMode());
    expect(document.documentElement.dataset.layout).toBe('phone');
  });

  it('restamps when the viewport crosses the break', () => {
    const media = installMatchMedia(390, 844);
    const { result } = renderHook(() => useLayoutMode());
    expect(document.documentElement.dataset.layout).toBe('phone');

    act(() => media.resizeTo(1280, 860));

    expect(result.current).toBe('desktop');
    expect(document.documentElement.dataset.layout).toBe('desktop');
  });

  // ─── Subscription lifecycle ─────────────────────────────────────────────────

  it('listens on `change`, not `resize` — resize fires on every iOS URL-bar scroll', () => {
    const media = installMatchMedia(390, 844);
    renderHook(() => useLayoutMode());

    const phone = media.lists.get(PHONE_QUERY);
    expect(phone).toBeDefined();
    expect(phone?.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    for (const call of phone?.addEventListener.mock.calls ?? []) {
      expect(call[0]).toBe('change');
    }
  });

  it('removes both listeners on unmount', () => {
    const media = installMatchMedia(390, 844);
    const { unmount } = renderHook(() => useLayoutMode());

    const phone = media.lists.get(PHONE_QUERY);
    const desktop = media.lists.get(DESKTOP_QUERY);
    expect(phone?.removeEventListener).not.toHaveBeenCalled();

    unmount();

    expect(phone?.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(desktop?.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

// ─── The renderAt() helper ────────────────────────────────────────────────────
//
// The helper is the reason any of the above is reachable from a component test:
// jsdom has no matchMedia and claims 1024px, so without it every test in the
// repo covers the desktop tree only, whatever it is named. These two cases pin
// the contract the rest of the suite will lean on.

function Probe() {
  return createElement('span', { 'data-testid': 'mode' }, useLayoutMode());
}

describe('renderAt', () => {
  it('puts the hook on the phone tree and stamps <html> before render', () => {
    renderAt('phone', createElement(Probe));
    expect(screen.getByTestId('mode')).toHaveTextContent('phone');
    expect(document.documentElement.dataset.layout).toBe('phone');
  });

  it('puts the hook on the desktop tree, and dispatch() rotates it', () => {
    const { dispatch } = renderAt('desktop', createElement(Probe));
    expect(screen.getByTestId('mode')).toHaveTextContent('desktop');

    act(() => dispatch('phone'));

    expect(screen.getByTestId('mode')).toHaveTextContent('phone');
    expect(document.documentElement.dataset.layout).toBe('phone');
  });
});
