/**
 * npm run split-hands -- [paths] [--out DIR]
 *
 * Sorts GGPoker exports into per-variant folders by header: cash hands to
 * `<out>/cash/`, tournament hands to `<out>/mtt/`, one output file per input
 * file. Non-destructive — inputs are left in place.
 *
 * With no path it reads `hands/`. Default `--out` is `hands`, so a plain run
 * fills `hands/cash/` and `hands/mtt/` alongside the originals. Because a single
 * export can interleave both games (rare, but Rush & Cash and a running MTT can
 * land in one download), each file is split block by block, not by filename.
 *
 * The classification is the parser's own `detectVariant`, so a hand sorts here
 * exactly as it parses in the report.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';

import { detectVariant, HAND_BLOCK_SPLIT, type GameVariant } from '../src/lib/hh/parse.ts';
import { collectAll, die } from './util.ts';

const DEFAULT_TARGET = 'hands';
const USAGE = 'usage: npm run split-hands -- [paths] [--out DIR]';

// ── argv ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const targets: string[] = [];
let out = DEFAULT_TARGET;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--out') {
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) die(`--out needs a value\n${USAGE}`);
    out = value;
  } else if (arg.startsWith('--')) {
    die(`unknown flag: ${arg}\n${USAGE}`);
  } else {
    targets.push(arg);
  }
}

const paths = targets.length ? targets : [DEFAULT_TARGET];
if (!targets.length && !existsSync(DEFAULT_TARGET)) {
  die(`no ${DEFAULT_TARGET}/ directory and no path given\n${USAGE}`);
}

// Sorting into the same tree we read from would re-ingest the split copies on
// the next run; refuse it so the output never overlaps the input.
const outDirs: Record<GameVariant, string> = { cash: join(out, 'cash'), mtt: join(out, 'mtt') };

// ── split ──────────────────────────────────────────────────────────────────

const files = collectAll(paths);
if (files.length === 0) die(`no .txt hand-history files found under ${paths.join(', ')}`);

const totals: Record<GameVariant, number> = { cash: 0, mtt: 0 };
let unknown = 0;

const outRoots = [resolve(outDirs.cash), resolve(outDirs.mtt)];
const under = (path: string, root: string): boolean => {
  const p = resolve(path);
  return p === root || p.startsWith(root + sep);
};

for (const file of files) {
  // Don't re-split our own output. Compare resolved paths, not substrings, so a
  // real input that merely spells "…/cash/…" is not skipped, and a nested rerun
  // that reads a prior output dir is.
  if (outRoots.some((root) => under(file, root))) continue;

  const blocks = readFileSync(file, 'utf8')
    .trim()
    .split(HAND_BLOCK_SPLIT)
    .map((b) => b.trim())
    .filter(Boolean);

  const buckets: Record<GameVariant, string[]> = { cash: [], mtt: [] };
  for (const block of blocks) {
    // trimEnd the header line: a CRLF export leaves a trailing \r that the
    // `$`-bearing cash regex would reject, sorting every hand as unrecognised.
    const variant = detectVariant(block.split('\n')[0].trimEnd());
    if (!variant) {
      unknown += 1;
      continue;
    }
    buckets[variant].push(block);
  }

  for (const variant of ['cash', 'mtt'] as const) {
    if (!buckets[variant].length) continue;
    mkdirSync(outDirs[variant], { recursive: true });
    writeFileSync(join(outDirs[variant], basename(file)), buckets[variant].join('\n\n') + '\n');
    totals[variant] += buckets[variant].length;
  }
}

console.error(
  `sorted ${totals.cash} cash + ${totals.mtt} tournament hands into ${outDirs.cash}/ and ${outDirs.mtt}/` +
    (unknown ? ` (${unknown} unrecognised block(s) skipped)` : ''),
);
