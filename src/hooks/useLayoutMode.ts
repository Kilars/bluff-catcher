/**
 * useLayoutMode — the single decision point for phone vs desktop.
 *
 * Returns 'phone' | 'compact' | 'desktop' and, as a side effect, stamps the
 * answer onto <html> as `data-layout` so every stylesheet can key off it.  This
 * is the whole mechanism described in docs/DECISIONS.md ("Layout — two trees,
 * one behaviour"): one hook decides, one attribute publishes, and nothing else
 * in src/ is allowed to measure a viewport.  The numbers live in
 * src/lib/breakpoints.ts.
 *
 * Why matchMedia and not resize
 * ─────────────────────────────
 * A `resize` listener is the obvious implementation and the wrong one.  On iOS,
 * collapsing and expanding the URL bar changes the visual viewport height, and
 * `resize` fires on every frame of that scroll — a re-render storm during the
 * exact gesture the drill is used with.  `matchMedia` fires only when the
 * predicate's truth value flips, which for a device that is not being rotated
 * is never.  App.tsx keeps a resize listener for the desktop scale arithmetic,
 * because that genuinely is a continuous function of the viewport; the tree
 * choice is not, and must not be driven by one.
 *
 * The short-edge rule
 * ───────────────────
 * PHONE_QUERY is `(max-width: 599px), (max-height: 599px)`, so a landscape
 * phone at 844 × 390 resolves to 'phone' — it has a phone's short edge, and the
 * desktop tree wants 860px of height.  The rule is expressed as a media query
 * on purpose: no innerWidth read anywhere, so the browser stays the single
 * authority on what the viewport is and the whole thing is stubbable in a test
 * with one fake matchMedia (see src/test/renderAt.tsx).
 *
 * SSR / jsdom safety
 * ──────────────────
 * jsdom does **not** implement matchMedia, and there is no window at all during
 * a server render.  Both fall back to 'desktop', which matches the CSS: every
 * desktop rule is written `:root:not([data-layout="phone"])`, so an absent
 * attribute renders the desktop tree rather than nothing.  That fallback is
 * also why `renderAt()` exists — without it a jsdom test silently exercises the
 * desktop tree only, whatever the test's name claims.
 *
 * useSyncExternalStore is the right primitive here: a MediaQueryList *is* an
 * external store with a subscribe and a synchronously-readable current value,
 * and going through the hook rather than useState + useEffect means the first
 * committed render already carries the real answer instead of a desktop guess
 * that is corrected one paint later.
 */

import { useEffect, useSyncExternalStore } from 'react';
import {
  DESKTOP_QUERY,
  PHONE_QUERY,
  type LayoutMode,
} from '../lib/breakpoints';

// ─── Environment probes ───────────────────────────────────────────────────────

/**
 * matchMedia, or null when it cannot be used: no window (SSR) or no
 * implementation (jsdom's default DOM). Never throws, so callers can treat the
 * null as "assume desktop" rather than branching on the environment.
 */
function matchMediaOrNull(query: string): MediaQueryList | null {
  if (typeof window === 'undefined') return null;
  if (typeof window.matchMedia !== 'function') return null;
  try {
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Read the mode straight from the media queries. Pure and cheap — no cached
 * MediaQueryList, because a test that swaps window.matchMedia between renders
 * must see the swap, and matchMedia itself is a trivial call.
 *
 * The two queries are ordered, not combined: a landscape phone matches
 * PHONE_QUERY *and* fails DESKTOP_QUERY, but an 844-wide portrait tablet fails
 * both and is 'compact'. Phone wins first because the short edge is the
 * binding constraint.
 */
function readLayoutMode(): LayoutMode {
  const phone = matchMediaOrNull(PHONE_QUERY);
  if (phone === null) return 'desktop'; // SSR, or jsdom with no matchMedia
  if (phone.matches) return 'phone';
  return matchMediaOrNull(DESKTOP_QUERY)?.matches ? 'desktop' : 'compact';
}

/** SSR and the no-matchMedia case both render the desktop tree. */
function getServerSnapshot(): LayoutMode {
  return 'desktop';
}

/**
 * Subscribe to both queries. `change` (not `resize`) is the event a
 * MediaQueryList publishes, and it fires only on a truth-value flip.
 * The returned cleanup detaches both listeners; React calls it on unmount and
 * whenever `subscribe` itself changes identity, which it never does here.
 */
function subscribe(onStoreChange: () => void): () => void {
  const lists = [matchMediaOrNull(PHONE_QUERY), matchMediaOrNull(DESKTOP_QUERY)];
  const attached: MediaQueryList[] = [];

  for (const list of lists) {
    if (!list || typeof list.addEventListener !== 'function') continue;
    list.addEventListener('change', onStoreChange);
    attached.push(list);
  }

  return () => {
    for (const list of attached) {
      list.removeEventListener('change', onStoreChange);
    }
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * The layout mode, plus the `data-layout` stamp on <html> that lets CSS see it.
 *
 * Call it once, at the root. Calling it twice is harmless (both instances
 * subscribe to the same queries and write the same attribute), but a component
 * that needs the mode should be passed it rather than re-deriving it — the
 * point of one decision point is that there is one.
 */
export function useLayoutMode(): LayoutMode {
  const mode = useSyncExternalStore(subscribe, readLayoutMode, getServerSnapshot);

  // The stamp is a side effect on a node outside React's tree, so it belongs in
  // an effect rather than in the snapshot getter (which must stay pure).
  // index.html sets the same attribute inline before the bundle parses, so this
  // is a re-affirmation on mount and a correction on rotation, not the first
  // write — frame one is already right.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.layout = mode;
  }, [mode]);

  return mode;
}
