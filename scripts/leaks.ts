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

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { collect, die } from './util.ts';
import {
  DATE_PATTERN,
  readArchive,
  selectWindow,
  type ArchiveFile,
  type Excluded,
} from '../src/lib/hh/archive.ts';
import { anthropicJudge } from '../src/lib/hh/anthropicJudge.ts';
import { claudeCliJudge } from '../src/lib/hh/claudeCliJudge.ts';
import type { FamilyBrief, FamilyVerdict, Judge } from '../src/lib/hh/judge.ts';
import { assertBlind, stubJudge, validateFamilyVerdict } from '../src/lib/hh/judge.ts';
import { LABELS, labelGroups } from '../src/lib/hh/labels.ts';
import { familyBriefs } from '../src/lib/hh/packet.ts';
import { rankGroups } from '../src/lib/hh/priority.ts';
import { bigSpots } from '../src/lib/hh/bigspots.ts';
import { coldCalls } from '../src/lib/hh/flats.ts';
import { faced3Bets } from '../src/lib/hh/faced3bets.ts';
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

const JUDGES = ['stub', 'anthropic', 'claude'] as const;
type JudgeName = (typeof JUDGES)[number];

const VARIANTS = ['cash', 'mtt'] as const;
type VariantName = (typeof VARIANTS)[number];

const DEFAULT_TARGET = 'hands';

const USAGE =
  'usage: npm run leaks -- [paths] [--mode leaks|pots|coach] [--variant cash|mtt] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--label NAME] [--judge stub|claude|anthropic] [--json] [--out FILE]';

// A live judge is flaky in ways a stub never is: it drops an instance, fences its JSON, or
// slips an outcome word into a note — all transient. Retry re-asks and re-validates the
// whole seam; only an exhausted family throws, so the run still fails loud rather than
// shipping an unjudged family as `clean`.
const JUDGE_ATTEMPTS = 3;

async function judgeFamily(judge: Judge, brief: FamilyBrief): Promise<FamilyVerdict> {
  let last = '';
  for (let attempt = 1; attempt <= JUDGE_ATTEMPTS; attempt++) {
    try {
      return assertBlind(validateFamilyVerdict(brief, await judge.evaluate(brief)));
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      if (attempt < JUDGE_ATTEMPTS) {
        console.error(`family "${brief.family}" attempt ${attempt}/${JUDGE_ATTEMPTS} failed, retrying: ${last}`);
      }
    }
  }
  throw new Error(`family "${brief.family}" after ${JUDGE_ATTEMPTS} attempts: ${last}`);
}

// ── argv ─────────────────────────────────────────────────────────────────────
//
// Every flag that takes a value must consume it, or the value lands in
// `targets` and gets statted as a path. Parsing positionally rather than
// filtering is the only way that stays true when a flag is added.

const VALUED = new Set(['--mode', '--from', '--to', '--out', '--label', '--judge', '--variant']);
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

// `--judge` picks the backend behind the Judge port: `stub` (offline, every hand `fine`
// — proves the wiring), `claude` (the local `claude` CLI, on your logged-in plan, no API
// key), or `anthropic` (the hosted API, needs ANTHROPIC_API_KEY).
const judge = (flags['--judge'] ?? null) as JudgeName | null;
if (judge !== null && !(JUDGES as readonly string[]).includes(judge)) {
  die(`--judge must be one of: ${JUDGES.join(', ')}, got: ${judge}`);
}
if (judge !== null && mode !== 'coach') die(`--judge applies only to --mode coach`);

// `--variant` narrows an archive that holds both games to one. Cash and MTT read
// different ranges and money units, so grading them in one report blends stats
// against a single band set — the filter is how you keep them apart at report
// time (the split-hands script does it on disk).
const variant = (flags['--variant'] ?? null) as VariantName | null;
if (variant !== null && !(VARIANTS as readonly string[]).includes(variant)) {
  die(`--variant must be one of: ${VARIANTS.join(', ')}, got: ${variant}`);
}

// Build the judge now, before parsing a single hand, so a bad setup fails loud up front
// rather than mid-run. `anthropicJudge()` owns its key check and throws a clear message;
// surface any construction error as a clean CLI error.
let judgeImpl: Judge | null = null;
try {
  if (judge === 'stub') judgeImpl = stubJudge;
  else if (judge === 'claude') judgeImpl = claudeCliJudge();
  else if (judge === 'anthropic') judgeImpl = anthropicJudge();
} catch (err) {
  die(err instanceof Error ? err.message : String(err));
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

// Filter to one game before windowing, so the window meta counts what the
// report actually grades. The archive meta still spans everything, as context.
const selectable = variant ? archive.hands.filter((h) => h.variant === variant) : archive.hands;
const { hands, window } = selectWindow(selectable, from, to);
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

  // `--label` means "all of this one" — Infinity sends every instance, not a sample.
  const briefs = familyBriefs(rankGroups(groups), label ? Infinity : undefined);

  // One judge call per family, fired concurrently — the families are independent and
  // each call is a slow model round-trip. The seam is validated not trusted: a malformed
  // verdict or a blindness breach throws. A live model is flaky (a dropped instance, a
  // fenced note) so each family is retried a few times; only when every attempt fails do
  // we fail loud (die) — never let a skipped family render as `clean`. `Promise.all`
  // rejects on the first exhausted family, preserving that fail-loud contract.
  let verdicts: FamilyVerdict[] = [];
  if (judgeImpl) {
    const judgeOne = judgeImpl;
    try {
      verdicts = await Promise.all(briefs.map((brief) => judgeFamily(judgeOne, brief)));
    } catch (err) {
      die(`judge failed on ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const payload = renderCoachJson(briefs, verdicts, meta);
  output = asJson ? JSON.stringify(payload, null, 2) : renderCoachText(payload);
} else {
  const summary = summarise(hands);
  const folds = rfiFolds(hands);
  const flats = coldCalls(hands);
  const faced3 = faced3Bets(hands);
  const big = bigSpots(hands);
  const all = labelGroups(hands);
  const groups = label ? all.filter((g) => g.label === label) : all;
  const perLabel = label ? Infinity : undefined;
  output = asJson
    ? JSON.stringify(renderJson(summary, meta, folds, flats, faced3, big, groups, perLabel), null, 2)
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
