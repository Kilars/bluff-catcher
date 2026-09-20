/**
 * npm run leaks -- [paths] [--mode leaks|pots] [--from YYYY-MM-DD] [--to …]
 *                 [--json] [--out FILE]
 *
 * Reads GGPoker hand-history exports, computes the report, and prints it.
 * `--json` emits the machine-readable version, which is what a coaching prompt
 * should be fed rather than the raw history.
 *
 * With no path it reads `hands/` at the repo root — the archive is the default
 * target, because the archive is the asset. It grows whether or not anything
 * gets built on top of it, and it is gitignored.
 *
 * The date window selects what is *reported on*, never what is parsed: the
 * archive spans are printed either way, so a report can always say how small a
 * slice it is looking at.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DATE_PATTERN, readArchive, selectWindow, type ArchiveFile } from '../src/lib/hh/archive.ts';
import { rfiFolds } from '../src/lib/hh/rfi.ts';
import { summarise } from '../src/lib/hh/stats.ts';
import {
  renderJson,
  renderPotsJson,
  renderPotsText,
  renderText,
  type ReportMeta,
} from '../src/lib/hh/report.ts';

const MODES = ['leaks', 'pots'] as const;
type Mode = (typeof MODES)[number];

const DEFAULT_TARGET = 'hands';

const USAGE =
  'usage: npm run leaks -- [paths] [--mode leaks|pots] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--json] [--out FILE]';

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Every .txt under a directory, recursively — tournaments live in subfolders. */
function collect(target: string): string[] {
  if (!existsSync(target)) die(`no such path: ${target}`);
  if (statSync(target).isFile()) return [target];

  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const path = join(target, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.name.toLowerCase().endsWith('.txt') ? [path] : [];
  });
}

// ── argv ─────────────────────────────────────────────────────────────────────
//
// Every flag that takes a value must consume it, or the value lands in
// `targets` and gets statted as a path. Parsing positionally rather than
// filtering is the only way that stays true when a flag is added.

const VALUED = new Set(['--mode', '--from', '--to', '--out']);
const args = process.argv.slice(2);

const targets: string[] = [];
const flags: Record<string, string> = {};
let asJson = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--json') {
    asJson = true;
  } else if (VALUED.has(arg)) {
    const value = args[++i];
    if (value === undefined) die(`${arg} needs a value\n${USAGE}`);
    flags[arg] = value;
  } else if (arg.startsWith('--')) {
    die(`unknown flag: ${arg}\n${USAGE}`);
  } else {
    targets.push(arg);
  }
}

const mode = (flags['--mode'] ?? 'leaks') as Mode;
if (!MODES.includes(mode)) die(`unknown mode: ${mode}\n${USAGE}`);

const from = flags['--from'] ?? null;
const to = flags['--to'] ?? null;
for (const [flag, value] of [
  ['--from', from],
  ['--to', to],
] as const) {
  if (value !== null && !DATE_PATTERN.test(value)) die(`${flag} must be YYYY-MM-DD, got: ${value}`);
}
if (from && to && from > to) die(`--from ${from} is after --to ${to}`);

// ── read ─────────────────────────────────────────────────────────────────────

const paths = targets.length ? targets : [DEFAULT_TARGET];
if (!targets.length && !existsSync(DEFAULT_TARGET)) {
  die(`no ${DEFAULT_TARGET}/ directory and no path given\n${USAGE}`);
}

const files = paths.flatMap(collect);
if (files.length === 0) die(`no .txt hand-history files found under ${paths.join(', ')}`);

const archive = readArchive(
  files.map((path): ArchiveFile => ({ path, text: readFileSync(path, 'utf8') })),
);
if (archive.hands.length === 0) {
  die(`parsed 0 usable hands from ${files.length} file(s) (${archive.meta.excluded} excluded)`);
}

const { hands, window } = selectWindow(archive.hands, from, to);
const meta: ReportMeta = { archive: archive.meta, window };

// ── render ───────────────────────────────────────────────────────────────────

let output: string;
if (mode === 'pots') {
  output = asJson
    ? JSON.stringify(renderPotsJson(hands, meta), null, 2)
    : renderPotsText(hands, meta);
} else {
  const summary = summarise(hands);
  const folds = rfiFolds(hands);
  output = asJson
    ? JSON.stringify(renderJson(summary, meta, folds), null, 2)
    : renderText(summary, meta, folds);
}

const outFile = flags['--out'] ?? null;
if (outFile) {
  writeFileSync(outFile, output + '\n');
  console.error(`wrote ${outFile}`);
} else {
  console.log(output);
}

if (hands.length === 0) {
  console.error(`\nwarning: the window ${from ?? '…'} → ${to ?? '…'} selected 0 of ${archive.meta.hands} hands`);
}

const counts = new Map<string, number>();
for (const e of archive.excluded) counts.set(e.reason, (counts.get(e.reason) ?? 0) + 1);
if (archive.meta.skipped) counts.set('unparsed block', archive.meta.skipped);
if (counts.size) {
  const parts = [...counts].map(([reason, n]) => `${n} ${reason}`);
  console.error(`\nexcluded from every count: ${parts.join('; ')}`);
}
