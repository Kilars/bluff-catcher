/**
 * breakpoints.ts — the only place in src/ that knows a viewport number.
 *
 * The app renders two component trees (docs/DECISIONS.md, "Layout — two trees,
 * one behaviour"): a phone-native tree and the desktop tree with its
 * --ui-scale / --felt-scale system.  Which one runs is decided *once*, in
 * useLayoutMode(), and published as `data-layout` on <html>.  Every stylesheet
 * keys off that attribute; no component and no width media query ever measures
 * the viewport itself.  CI greps src/ for width media queries and fails the
 * build on a hit — including on this comment, which is why it spells the thing
 * out in prose instead of quoting it.
 *
 * Why 600 and not the old 820
 * ───────────────────────────
 * 820 was the felt sprite's asset width — a design asset governing a layout
 * decision.  Its consequences were a 768px iPad in portrait getting the *phone*
 * layout when it wants desktop chrome with a smaller felt, and a landscape
 * phone (844 wide) getting the *desktop* tree with 390px of height.
 *
 * 600 is the real cliff: below it two columns of 13px text cannot sit side by
 * side.  600–1023 needs no new design — it is the desktop tree with
 * --felt-scale doing exactly the job it was built for.
 *
 *   phone    short edge < 600    360, 390, 393, 430, and 844 × 390 landscape
 *   compact  600 – 1023          744, 768, 834 portrait
 *   desktop  ≥ 1024              1024, 1280, and up
 *
 * The short-edge rule
 * ───────────────────
 * The phone tree is chosen when min(width, height) < 600, not when width < 600.
 * A phone held sideways is 844 × 390: wider than any desktop threshold, but with
 * a phone's height, and the desktop tree wants 860 of it.  Expressed as a media
 * query rather than an innerWidth read, so the browser owns the measurement —
 * `resize` fires on every iOS URL-bar scroll, `matchMedia` does not.
 *
 *   (max-width: 599px), (max-height: 599px)
 *
 * That comma is an `or`.  It is the whole short-edge rule.
 *
 * Anything importing these constants gets them as numbers; anything that cannot
 * import (the first-paint script in index.html) carries a copy with a comment
 * pointing back here.  Those two must be kept in step by hand — there are
 * exactly two of them, and useLayoutMode.test.ts pins the query strings.
 */

// ─── The numbers ──────────────────────────────────────────────────────────────

/** Largest short edge, in CSS px, that still gets the phone tree. */
export const PHONE_MAX = 599;

/** Smallest width, in CSS px, that gets the full desktop scaling. */
export const DESKTOP_MIN = 1024;

// ─── Derived media queries ────────────────────────────────────────────────────

/**
 * Phone tree. Short-edge rule: either dimension under 600 is a phone posture,
 * so portrait (390 × 844) and landscape (844 × 390) both match.
 */
export const PHONE_QUERY = `(max-width: ${PHONE_MAX}px), (max-height: ${PHONE_MAX}px)`;

/**
 * Desktop proper. Only meaningful once PHONE_QUERY has been ruled out — a
 * landscape phone is 844 wide, which is not desktop, but it is also not 1024.
 */
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN}px)`;

// ─── Modes ────────────────────────────────────────────────────────────────────

/**
 * Which tree is rendering.
 *
 *   phone    the phone-native tree; no felt, no scale transform anywhere
 *   compact  the desktop tree at --ui-scale 1, --felt-scale shrinking the felt
 *   desktop  the desktop tree with both scales live
 *
 * `compact` and `desktop` are the *same* tree — they differ only in how much
 * magnification App.tsx grants it. CSS that means "not the phone tree" should
 * say `:root:not([data-layout="phone"])`, which also covers the attribute being
 * absent (SSR, a stripped document, jsdom before renderAt() runs).
 */
export type LayoutMode = 'phone' | 'compact' | 'desktop';
