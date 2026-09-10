/**
 * usePreflopDrill — all behaviour of the preflop RFI drill, with no presentation.
 *
 * Extracted verbatim from `modes/PreflopTrainer.tsx`. Per `DECISIONS.md` —
 * "two trees, one behaviour" — the drill's state machine, its double-record
 * guard and its verdict copy live here so a phone view and the desktop view
 * cannot disagree about what happened on a hand.
 *
 * Owns spot state:
 *  - Calls dealPreflopSpot() on mount and on "next" to get a new spot.
 *  - Tracks committed state: null (awaiting input) | 'open' | 'fold'.
 *  - Commit locks buttons + keys until the user advances to the next spot.
 *
 * Keyboard bindings:
 *  - F = Fold (when uncommitted)
 *  - J = Open / Jam (when uncommitted — the label depends on stack depth,
 *    the key does not)
 *  - Space / Enter = Next hand (when committed)
 *  - R = Range grid (when committed)
 *  - I = Situation info sheet (always)
 *  - Escape = close whichever sheet is open
 *
 * The situation info sheet opens on every mount so the player always knows the
 * scenario they are being drilled on. While a sheet is open the game keys are
 * inert.
 *
 * Options:
 *  - depth: which stack tier to drill (40bb+ / 20bb / 10bb). At 10bb the
 *    aggressive action is a jam, not an open; the decision is still binary, so
 *    only the wording changes. App remounts the trainer on a depth change
 *    (via `key`), which re-deals and re-opens the briefing for the new tier.
 *  - onRecord(wasCorrect): called exactly once per commit to record the result
 *    in the preflop stats hook lifted to App root. The double-record guard is
 *    the committedRef check in handleCommit (already committed → early return).
 *  - keysSuspended: true while an App-level overlay (the menu's range-chart
 *    browser) is on top, so game keys do not fire behind it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { dealPreflopSpot, type PreflopSpot } from '../lib/preflop/deal';
import { needsBriefing, markBriefed } from '../lib/preflop/briefed';
import { DEFAULT_DEPTH, DEPTH_META, type Depth } from '../lib/preflop/ranges';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommittedAction = 'open' | 'fold';

export interface UsePreflopDrillOptions {
  /** Stack tier to drill. Default: the 40bb+ chart. */
  depth?: Depth;
  /** Called once per committed hand with true = correct, false = wrong. */
  onRecord: (wasCorrect: boolean) => void;
  /** True while an overlay owned by App is open — all game keys go inert. */
  keysSuspended?: boolean;
  /**
   * Open the situation briefing only the first time the player meets a tier,
   * remembering across sessions. On phone the sheet is full-screen, so opening
   * it on every launch and every tier switch puts a wall of text between the
   * player and the drill.
   *
   * Off by default: the desktop tree still briefs on every mount, where the
   * sheet is a panel rather than the whole screen. Bringing desktop into line
   * is a deliberate follow-up — it would rewrite ~19 existing behaviour tests,
   * which is not something to fold into the phone break.
   */
  briefOncePerTier?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePreflopDrill({
  depth = DEFAULT_DEPTH,
  onRecord,
  keysSuspended = false,
  briefOncePerTier = false,
}: UsePreflopDrillOptions) {
  const meta = DEPTH_META[depth];

  // Current spot — initialised on mount via lazy initialiser
  const [spot, setSpot] = useState<PreflopSpot>(() => dealPreflopSpot({ depth }));

  // null = waiting for input; 'open'|'fold' = committed
  const [committed, setCommitted] = useState<CommittedAction | null>(null);

  // Range sheet open/close state — only available after commit
  const [rangeOpen, setRangeOpen] = useState(false);

  // Situation info sheet — opens the first time you meet a tier, then never
  // again on its own. App remounts this hook on every depth change (key={depth}),
  // so "on mount" used to mean "every launch and every tier switch"; full-screen
  // on phone, that is a wall between the player and the drill. See
  // lib/preflop/briefed.ts.
  const [infoOpen, setInfoOpen] = useState(
    () => !briefOncePerTier || needsBriefing(depth)
  );

  useEffect(() => {
    if (infoOpen && briefOncePerTier) markBriefed(depth);
    // Marking on open rather than on close: dismissing by any route (×, Escape,
    // the footer button) should count, and they all land here eventually.
  }, [infoOpen, depth, briefOncePerTier]);

  // Ref so keyboard handler always sees up-to-date committed value
  const committedRef = useRef<CommittedAction | null>(null);
  committedRef.current = committed;

  // Keep a stable ref to the current spot so handleCommit closure can read it
  const spotRef = useRef<PreflopSpot>(spot);
  spotRef.current = spot;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCommit = useCallback((action: CommittedAction) => {
    // Double-record guard: if already committed, do nothing.
    if (committedRef.current !== null) return;

    setCommitted(action);

    // Compute verdict against the current spot and record the result once.
    const wasCorrect = action === spotRef.current.correct;
    onRecord(wasCorrect);
  }, [onRecord]);

  const handleNext = useCallback(() => {
    setSpot(dealPreflopSpot({ depth }));
    setCommitted(null);
    setRangeOpen(false);
  }, [depth]);

  // Only one sheet at a time — opening one closes the other.
  const openInfo = useCallback(() => {
    setRangeOpen(false);
    setInfoOpen(true);
  }, []);

  const openRange = useCallback(() => {
    setInfoOpen(false);
    setRangeOpen(true);
  }, []);

  const closeInfo = useCallback(() => setInfoOpen(false), []);

  const closeRange = useCallback(() => setRangeOpen(false), []);

  // ── Keyboard handler ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // An App-level overlay owns the keyboard while it is open.
      if (keysSuspended) return;

      // Ignore when a modifier is held or when the event comes from an input
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.repeat) return;

      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      // Escape closes whichever sheet is open
      if (e.key === 'Escape') {
        if (infoOpen) {
          e.preventDefault();
          setInfoOpen(false);
        } else if (rangeOpen) {
          e.preventDefault();
          setRangeOpen(false);
        }
        return;
      }

      // Don't handle game keys while a sheet is open
      if (rangeOpen || infoOpen) return;

      // I opens the situation info sheet, committed or not
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        openInfo();
        return;
      }

      const current = committedRef.current;

      if (current === null) {
        // Awaiting input
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          handleCommit('fold');
        } else if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          handleCommit('open');
        }
      } else {
        // Already committed — advance to next hand or open range with R
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          openRange();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCommit, handleNext, openInfo, openRange, rangeOpen, infoOpen, keysSuspended]);

  // ── Verdict (derived) ────────────────────────────────────────────────────

  const isCommitted = committed !== null;

  // Verdict copy — only defined after commit
  const wasCorrect = isCommitted ? committed === spot.correct : null;
  // 'open' is the data layer's word for the aggressive action at every tier;
  // at 10bb the player knows it as a jam, so read the verb off the tier.
  const correctWord = spot.correct === 'open' ? meta.action : 'fold';
  const correctNoun = spot.correct === 'open' ? meta.actionNoun : 'a fold';
  const verdictText = isCommitted
    ? wasCorrect
      ? `Correct — ${correctWord}`
      : `Wrong — this is ${correctNoun}`
    : null;

  return {
    depth,
    meta,
    spot,
    committed,
    rangeOpen,
    infoOpen,
    isCommitted,
    wasCorrect,
    correctWord,
    correctNoun,
    verdictText,
    handleCommit,
    handleNext,
    openInfo,
    openRange,
    closeInfo,
    closeRange,
  };
}

export type UsePreflopDrillReturn = ReturnType<typeof usePreflopDrill>;
