/**
 * Which stack tiers the player has already been briefed on.
 *
 * The situation sheet used to open on every mount, and App passes `key={depth}`
 * to the trainer, so it reappeared on every launch *and* every tier change. On
 * desktop that is a panel beside the felt. On phone it is full-screen, so it
 * became a wall of text standing between the player and the drill, every single
 * time — see docs/PLAN-phone.md §5.3.
 *
 * A tier is genuinely worth explaining once: 10bb jam-or-fold really is a
 * different game from 60bb open-or-fold. Explaining it a second time is not
 * teaching, it is a toll. So: first visit to a tier opens it, after that the
 * Info button (and the `I` key, where there is a keyboard) is how you get back.
 */

import type { Depth } from './ranges';

export const BRIEFED_KEY = 'bluff-catcher:briefed:v1';

function read(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(BRIEFED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    // Unreadable or corrupt: treat as "never briefed". Showing the sheet once
    // more is a far smaller cost than throwing on load.
    return [];
  }
}

/** True when this tier has never been briefed — i.e. the sheet should open. */
export function needsBriefing(depth: Depth): boolean {
  return !read().includes(depth);
}

/** Record that the player has now seen this tier's briefing. */
export function markBriefed(depth: Depth): void {
  try {
    if (typeof window === 'undefined') return;
    const seen = read();
    if (seen.includes(depth)) return;
    localStorage.setItem(BRIEFED_KEY, JSON.stringify([...seen, depth]));
  } catch {
    // localStorage might be disabled — the sheet simply opens again next time.
  }
}
