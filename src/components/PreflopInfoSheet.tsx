/**
 * PreflopInfoSheet — sheet overlay explaining the drill: what the situation is,
 * what the decision is, and which keys do what.
 *
 * Reuses ExplainSheet's CSS module (backdrop, sheet, sheetInner, sheetHeader,
 * closeBtn, divider, step, footer, btnAccent) without forking the animation.
 *
 * Opens with the same riseSheet animation (220ms) defined in ExplainSheet.module.css.
 * Closes via backdrop click, × button, or Escape (Esc handled by parent).
 *
 * The copy is depth-aware: the 60bb+ and 20bb tiers brief an open-or-fold
 * decision, the 10bb tier briefs a jam-or-fold one. The per-tier wording lives
 * in DEPTH_BRIEF below, next to the layout that renders it, rather than in the
 * range data — it is presentation, not poker.
 *
 * Props:
 *   depth   — the tier being drilled.
 *   content — optional: replaces the tier briefing with another drill's copy
 *             (the facing-open drill uses this), keeping the same chrome.
 *   onClose — called when the sheet should close.
 */

import type { ReactNode } from 'react';
import { CHART_META, DEFAULT_DEPTH, type ChartKey } from '../lib/preflop/ranges';
import styles from './ExplainSheet.module.css';
import { useLayoutMode } from '../hooks/useLayoutMode';

// ─── Per-tier briefing copy ───────────────────────────────────────────────────

interface DepthBrief {
  /** Sheet title. */
  title: string;
  /** One line under the title: the table and the stack. */
  subline: string;
  /** Step 01 — the table. */
  table: string;
  /** Step 03 — the decision. */
  decision: string;
  /** Step 04 — the thing this tier specifically teaches. */
  lessonTitle: string;
  lesson: string;
}

const DEPTH_BRIEF: Record<ChartKey, DepthBrief> = {
  deep: {
    subline: '9-handed tournament table · 60bb+ effective',
    title: 'Open or fold, first in',
    table:
      '9-handed tournament, 60 big blinds. Hand selection barely moves between 40bb and 100bb, so this one chart covers all of it.',
    decision:
      'Open-raise to ~2.2–2.5bb, or fold. No limping — those are the only two options.',
    lessonTitle: 'Why position matters',
    lesson:
      'The earlier you sit, the more players act behind you, so the tighter you open. UTG is the tightest; the button has only the blinds left and opens widest.',
  },
  mid: {
    subline: '9-handed tournament table · 20bb effective',
    title: 'Open or fold, first in',
    table:
      '9-handed tournament, 20 big blinds. Deep enough to raise and fold, too shallow to win a big pot after the flop.',
    decision:
      'Open-raise to ~2bb, or fold. You can still fold to a re-raise — that changes at 10bb.',
    lessonTitle: 'What changes at 20bb',
    lesson:
      'Implied odds are gone: 65s has no stack left to win, so hands like that come out and suited kings and offsuit broadways go in. The surprise is where the range shrinks. UTG barely moves — it was never opening for implied odds. The button drops seven points, because its widest hands were only ever profitable for the position it had after the flop, and there is no meaningful after-the-flop left.',
  },
  short: {
    subline: '9-handed tournament table · 10bb effective',
    title: 'Jam or fold, first in',
    table:
      '9-handed tournament, 10 big blinds. A normal raise would commit a third of your stack, so raising and folding is no longer a real option.',
    decision:
      'Shove all-in, or fold. Nothing in between — if the hand is worth playing, it is worth all 10bb.',
    lessonTitle: 'What changes at 10bb',
    lesson:
      'You win two ways: everyone folds, or you get called and win a showdown. So every pocket pair and every suited ace jams from every seat, while small suited connectors stay out until late position — they are the worst hands to be called by. Note the ranges are about as wide as the 60bb+ ones, not wider: fold equity buys the bottom of the range, and being unable to fold to a re-raise sells the top back. Different hands, similar count.',
  },
  cash: {
    subline: '6-max cash table · 100bb effective, no ante',
    title: 'Open or fold, first in',
    table:
      '6-max cash game, 100 big blinds, no ante. The first seat is the LJ — GGPoker calls it UTG.',
    decision: 'Open-raise to 2.5bb (3bb from the SB), or fold. No limping, not even from the SB.',
    lessonTitle: 'Why cash is tighter',
    lesson:
      'Same seats as the tournament charts, fewer hands: LJ opens 17% here against 24% at a 9-max table with antes. No ante means less dead money to win, and rake taxes small pots. The SB is the new seat — only the BB is behind, so it opens 43%, but it raises or folds.',
  },
};

// ─── Sheet content ────────────────────────────────────────────────────────────

/**
 * Everything the sheet says. The RFI drill builds this from its tier
 * (`rfiBriefing` below); another drill — the facing-open one — passes its own
 * through `content`, so both share one piece of chrome rather than a fork.
 */
export interface InfoSheetContent {
  /** Small caps line above the title. */
  kicker: string;
  title: string;
  /** One line under the title. */
  subline: string;
  /** Numbered steps, 01… in order. */
  steps: { title: string; body: ReactNode }[];
  /** The desktop key card (hidden on phone). */
  keys: { key: string; label: string }[];
  /** Optional line under the key card. */
  keysNote?: string;
  /** Footer button label. */
  cta: string;
}

/** The RFI drill's briefing for one stack tier. */
function rfiBriefing(depth: ChartKey): InfoSheetContent {
  const meta = CHART_META[depth];
  const brief = DEPTH_BRIEF[depth];
  return {
    kicker: 'The situation',
    title: brief.title,
    subline: brief.subline,
    steps: [
      { title: 'The table', body: brief.table },
      {
        title: 'The action',
        body: 'Everyone before you has folded — you are first in. Only the blinds and the seats behind you are left.',
      },
      { title: 'Your decision', body: brief.decision },
      { title: brief.lessonTitle, body: brief.lesson },
    ],
    keys: [
      { key: 'F', label: 'Fold' },
      { key: 'J', label: meta.actionLabel },
      { key: 'Space', label: 'Next hand' },
      { key: 'R', label: 'Range grid' },
      { key: 'I', label: 'This page' },
    ],
    cta: 'Start drilling',
  };
}

interface PreflopInfoSheetProps {
  depth?: ChartKey;
  /** Replaces the tier briefing entirely (`depth` is then ignored). */
  content?: InfoSheetContent;
  onClose: () => void;
}

export default function PreflopInfoSheet({
  depth = DEFAULT_DEPTH,
  content,
  onClose,
}: PreflopInfoSheetProps) {
  const brief = content ?? rfiBriefing(depth);
  const layout = useLayoutMode();

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <>
      {/* Backdrop — reuses ExplainSheet backdrop class for identical styling */}
      <div className={styles.backdrop} onClick={handleBackdropClick} />

      {/* Sheet — a centred dialog on desktop (the briefing is short, and a
          full-height panel left the bottom half of the screen empty); the
          phone media query turns it back into the usual full-height sheet. */}
      <div className={`${styles.sheet} ${styles.sheetCentered}`}>
        <div className={styles.sheetInner}>
          {/* Header */}
          <div className={styles.sheetHeader}>
            <div className={styles.headerLeft}>
              <span className={styles.headerKicker}>{brief.kicker}</span>
              <h1 className={styles.headerTitle}>{brief.title}</h1>
              <p className={styles.headerSubline}>{brief.subline}</p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close situation info"
            >
              ×
            </button>
          </div>

          {/* Divider */}
          <div className={styles.divider} />

          {/* Body — numbered steps, same shape as ExplainSheet */}
          <div className={styles.body}>
            <div className={styles.leftCol}>
              {brief.steps.map((step, i) => (
                <div className={styles.step} key={step.title}>
                  <span className={styles.stepIndex}>{String(i + 1).padStart(2, '0')}</span>
                  <div className={styles.stepContent}>
                    <h2 className={styles.stepTitle}>{step.title}</h2>
                    {typeof step.body === 'string' ? (
                      <p className={styles.stepBody}>{step.body}</p>
                    ) : (
                      <div className={styles.stepBody}>{step.body}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Right: key hints — desktop only. A phone has no keyboard, so
                listing F/J/Space/R/I there is instructions for hardware the
                reader does not have. */}
            {layout !== 'phone' && (
            <div className={styles.rightCol}>
              <div className={styles.memoriseCard}>
                <span className={styles.memoriseKicker}>Keys</span>
                <div className={styles.memoriseGrid}>
                  {brief.keys.map((k) => (
                    <div className={styles.memoriseRow} key={k.key}>
                      <span>{k.key}</span>
                      <span className={styles.memoriseValue}>{k.label}</span>
                    </div>
                  ))}
                </div>
                {brief.keysNote && (
                  <p className={styles.keysNote}>{brief.keysNote}</p>
                )}
              </div>
            </div>
            )}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button type="button" className={styles.btnAccent} onClick={onClose}>
              {brief.cta}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
