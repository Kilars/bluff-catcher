/**
 * The archive layer: many export files in, one clean set of Hero hands out.
 *
 * Pure — it takes file *text*, never touches the filesystem, so the same code
 * runs in the CLI and (later) in the browser. Walking `hands/` is the caller's
 * job; see `scripts/leaks.ts`.
 *
 * Two jobs, kept apart on purpose:
 *
 *   readArchive()  decides what is *parsed*. It drops duplicates and garbage,
 *                  permanently — an accumulating archive that keeps a hand whose
 *                  pot does not reconcile carries that error into every future
 *                  report.
 *   selectWindow() decides what is *reported on*. It never drops anything from
 *                  the archive counts, so a report can always say "23 hands of
 *                  the 512 on file".
 *
 * Only the window may be described to a reader. `meta.archive` is context.
 */

import { parseHands, type Hand } from './parse.ts';
import { heroHand, type HeroHand } from './hero.ts';

export interface ArchiveFile {
  path: string;
  text: string;
}

/** A hand read but deliberately kept out of every denominator. */
export interface Excluded {
  id: string;
  file: string;
  reason: 'pot check failed' | 'no face-up hole cards' | 'duplicate';
}

export interface ArchiveMeta {
  files: number;
  /** Hands kept. */
  hands: number;
  excluded: number;
  /** Blocks that did not parse at all. */
  skipped: number;
  first: string | null;
  last: string | null;
  tournaments: number;
  /** Every distinct game name in the archive — a multi-tournament file has no single one. */
  games: string[];
  timezone: string;
}

export interface WindowMeta {
  requestedFrom: string | null;
  requestedTo: string | null;
  first: string | null;
  last: string | null;
  hands: number;
  /** Voluntary Hero actions in the window. */
  decisions: number;
}

export interface Archive {
  hands: HeroHand[];
  meta: ArchiveMeta;
  excluded: Excluded[];
}

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GGPoker prints no zone on the timestamp, so every date here is the export's
 * own local day. Stated rather than guessed: a window is off by a few hours at
 * the edges if the client clock is not the reader's.
 */
const TIMEZONE = 'export-local (no zone printed)';

/**
 * Identity of a hand, for dedupe. `Hand` keeps no raw text, so this is a
 * structural key: the same hand id with the same pot and the same number of
 * actions is the same hand exported twice.
 */
function key(h: Hand): string {
  return `${h.id}|${h.totalPot}|${h.actions.length}`;
}

export function readArchive(files: ArchiveFile[]): Archive {
  const hands: HeroHand[] = [];
  const excluded: Excluded[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  const games = new Set<string>();
  const tournaments = new Set<string>();

  for (const file of files) {
    const parsed = parseHands(file.text);
    skipped += parsed.skipped.length;

    for (const hand of parsed.hands) {
      const k = key(hand);
      if (seen.has(k)) {
        excluded.push({ id: hand.id, file: file.path, reason: 'duplicate' });
        continue;
      }
      seen.add(k);

      if (!hand.potMatches) {
        excluded.push({ id: hand.id, file: file.path, reason: 'pot check failed' });
        continue;
      }
      const hero = heroHand(hand);
      if (!hero) {
        excluded.push({ id: hand.id, file: file.path, reason: 'no face-up hole cards' });
        continue;
      }

      games.add(hand.gameName);
      tournaments.add(hand.tournamentId);
      hands.push(hero);
    }
  }

  // `YYYY/MM/DD HH:MM:SS` is fixed-width, so a plain compare is chronological.
  // localeCompare is not: ICU can weight the punctuation differently per locale.
  hands.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));

  return {
    hands,
    excluded,
    meta: {
      files: files.length,
      hands: hands.length,
      excluded: excluded.length,
      skipped,
      first: hands[0]?.handDate ?? null,
      last: hands.at(-1)?.handDate ?? null,
      tournaments: tournaments.size,
      games: [...games].sort(),
      timezone: TIMEZONE,
    },
  };
}

/**
 * Narrow to a date window. Both bounds are inclusive and either works alone.
 * Dates are `YYYY-MM-DD`, which sorts lexically, so the comparison is a string
 * compare — validate the input before calling (see `scripts/leaks.ts`).
 */
export function selectWindow(
  hands: HeroHand[],
  from?: string | null,
  to?: string | null,
): { hands: HeroHand[]; window: WindowMeta } {
  const kept = hands.filter(
    (h) => (!from || h.handDate >= from) && (!to || h.handDate <= to),
  );

  return {
    hands: kept,
    window: {
      requestedFrom: from ?? null,
      requestedTo: to ?? null,
      first: kept[0]?.handDate ?? null,
      last: kept.at(-1)?.handDate ?? null,
      hands: kept.length,
      decisions: kept.reduce((t, h) => t + h.decisions.length, 0),
    },
  };
}
