/**
 * npm run leaks -- [paths] [--mode leaks|pots] [--from YYYY-MM-DD] [--to …]
 *                 [--label NAME] [--json] [--out FILE]
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

import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';

import {
  DATE_PATTERN,
  readArchive,
  selectWindow,
  type ArchiveFile,
  type Excluded,
} from '../src/lib/hh/archive.ts';
import { batteryFor } from '../src/lib/hh/battery.ts';
import type { AnswerSet } from '../src/lib/hh/judge.ts';
import { stubJudge } from '../src/lib/hh/judge.ts';
import { LABELS, labelGroups } from '../src/lib/hh/labels.ts';
import { rankGroups } from '../src/lib/hh/priority.ts';
import { rfiFolds } from '../src/lib/hh/rfi.ts';
import { summarise } from '../src/lib/hh/stats.ts';
import {
  renderCoachJson,
  renderCoachText,
  renderJson,
  renderPotsJson,
  renderPotsText,
  renderText,
  type ReportMeta,
} from '../src/lib/hh/report.ts';

const MODES = ['leaks', 'pots', 'coach'] as const;
type Mode = (typeof MODES)[number];

const DEFAULT_TARGET = 'hands';

const USAGE =
  'usage: npm run leaks -- [paths] [--mode leaks|pots|coach] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--label NAME] [--judge stub] [--json] [--out FILE]';

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

/**
 * Every .txt under a directory, recursively — tournaments live in subfolders.
 *
 * Symlinked directories are followed, because pointing `hands/` at the folder
 * the client downloads into is the obvious way to use this. `seen` holds real
 * paths so a symlink that points back up its own tree terminates instead of
 * recursing forever.
 */
function isDirectory(path: string, entry: Dirent): boolean {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    // statSync follows the link, so a stale one — an unmounted drive, a
    // renamed download folder — throws instead of answering. Skipping it is
    // right; crashing the whole run over one dead link is not.
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function collect(target: string, seen = new Set<string>()): string[] {
  if (!existsSync(target)) die(`no such path: ${target}`);
  if (statSync(target).isFile()) return [target];

  const real = realpathSync(target);
  if (seen.has(real)) return [];
  seen.add(real);

  return readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const path = join(target, entry.name);
    if (isDirectory(path, entry)) return collect(path, seen);
    return entry.name.toLowerCase().endsWith('.txt') ? [path] : [];
  });
}

// ── argv ─────────────────────────────────────────────────────────────────────
//
// Every flag that takes a value must consume it, or the value lands in
// `targets` and gets statted as a path. Parsing positionally rather than
// filtering is the only way that stays true when a flag is added.

const VALUED = new Set(['--mode', '--from', '--to', '--out', '--label', '--judge']);
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
    // A flag is never a value. `--out --json` would otherwise write a file
    // called "--json" and drop the --json the user asked for.
    if (value === undefined || value.startsWith('--')) die(`${arg} needs a value\n${USAGE}`);
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

// `--label` narrows to one label and drops the stride: the whole point of
// asking for a label by name is that the five sampled instances were not
// enough. Validated against the vocabulary rather than silently returning an
// empty report, which reads identically to "you never did this".
const label = flags['--label'] ?? null;
if (label !== null && !(LABELS as readonly string[]).includes(label)) {
  die(`unknown label: ${label}\nknown labels: ${LABELS.join(', ')}`);
}

// `--judge` is deliberately limited to the stub until a model backend is chosen
// (PLAN-coach.md §4, "the judgment seam"): it proves the batteries answer end to
// end, offline, so swapping in Jev or an LLM is the one remaining step.
const judge = flags['--judge'] ?? null;
if (judge !== null && judge !== 'stub') {
  die(`--judge only supports "stub" until a model backend is chosen, got: ${judge}`);
}

// ── read ─────────────────────────────────────────────────────────────────────

const paths = targets.length ? targets : [DEFAULT_TARGET];
if (!targets.length && !existsSync(DEFAULT_TARGET)) {
  die(`no ${DEFAULT_TARGET}/ directory and no path given\n${USAGE}`);
}

const files = paths.flatMap((path) => collect(path));
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
} else if (mode === 'coach') {
  const all = labelGroups(hands);
  const groups = label ? all.filter((g) => g.label === label) : all;

  // Only the stub runs here, and only when asked. Answering every appearing
  // label's battery once is enough — the payload keys answers by label.
  const answers: Record<string, AnswerSet> = {};
  if (judge === 'stub') {
    for (const g of rankGroups(groups)) answers[g.label] = await stubJudge.evaluate({}, batteryFor(g.label));
  }

  const payload = renderCoachJson(groups, meta, answers);
  output = asJson ? JSON.stringify(payload, null, 2) : renderCoachText(payload);
} else {
  const summary = summarise(hands);
  const folds = rfiFolds(hands);
  const all = labelGroups(hands);
  const groups = label ? all.filter((g) => g.label === label) : all;
  const perLabel = label ? Infinity : undefined;
  output = asJson
    ? JSON.stringify(renderJson(summary, meta, folds, groups, perLabel), null, 2)
    : renderText(summary, meta, folds, groups, perLabel);
}

const outFile = flags['--out'] ?? null;
if (outFile) {
  writeFileSync(outFile, output + '\n');
  console.error(`wrote ${outFile}`);
} else {
  console.log(output);
}

// The text report says this in the body; JSON has nowhere to put it.
if (hands.length === 0 && asJson) {
  console.error(`\nwarning: the window ${from ?? '…'} → ${to ?? '…'} selected 0 of ${archive.meta.hands} hands`);
}

// Name the hands, not just the count. In an archive that accumulates, a hand
// whose pot does not reconcile is dropped from every future report too, so
// which file it is in is the actionable half.
const byReason = new Map<string, Excluded[]>();
for (const e of archive.excluded) byReason.set(e.reason, [...(byReason.get(e.reason) ?? []), e]);
for (const [reason, dropped] of byReason) {
  const shown = dropped.slice(0, 5).map((e) => `${e.id} (${e.file})`).join(', ');
  const more = dropped.length > 5 ? `, +${dropped.length - 5} more` : '';
  console.error(`excluded — ${dropped.length} ${reason}: ${shown}${more}`);
}
if (archive.meta.skipped) console.error(`excluded — ${archive.meta.skipped} unparsed block(s)`);
