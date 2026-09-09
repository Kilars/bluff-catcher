/**
 * npm run leaks -- <file-or-directory> [...] [--json] [--out FILE]
 *
 * Reads GGPoker hand-history exports, computes the leak report, and prints it.
 * `--json` emits the machine-readable version, which is what a coaching prompt
 * should be fed rather than the raw history.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseHands } from '../src/lib/hh/parse.ts';
import { heroHands } from '../src/lib/hh/hero.ts';
import { summarise } from '../src/lib/hh/stats.ts';
import { renderJson, renderText } from '../src/lib/hh/report.ts';

function collect(target: string): string[] {
  const s = statSync(target);
  if (s.isFile()) return [target];
  return readdirSync(target)
    .filter((f) => f.toLowerCase().endsWith('.txt'))
    .map((f) => join(target, f));
}

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const outIdx = args.indexOf('--out');
const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
const outValueIdx = outIdx >= 0 ? outIdx + 1 : -1;
const targets = args.filter((a, i) => !a.startsWith('--') && i !== outValueIdx);

if (targets.length === 0) {
  console.error('usage: npm run leaks -- <file-or-directory> [--json] [--out FILE]');
  process.exit(1);
}

const files = targets.flatMap(collect);
if (files.length === 0) {
  console.error('no .txt hand-history files found');
  process.exit(1);
}

const text = files.map((f) => readFileSync(f, 'utf8')).join('\n\n');
const { hands, skipped } = parseHands(text);

if (hands.length === 0) {
  console.error(`parsed 0 hands from ${files.length} file(s)`);
  for (const s of skipped.slice(0, 5)) console.error(`  skipped: ${s.reason} — ${s.head}`);
  process.exit(1);
}

// The pot check is the parser's own smoke test: every hand's actions must add
// up to the printed "Total pot". A mismatch means the format moved.
const mismatched = hands.filter((h) => !h.potMatches);
const noHero = hands.filter((h) => !h.hero);

const hero = heroHands(hands);
const summary = summarise(hero);
const meta = { game: hands[0].gameName, date: hands[0].timestamp.split(' ')[0] };

const output = asJson
  ? JSON.stringify(renderJson(summary, meta), null, 2)
  : renderText(summary, meta);

if (outFile) {
  writeFileSync(outFile, output + '\n');
  console.error(`wrote ${outFile}`);
} else {
  console.log(output);
}

const warnings: string[] = [];
if (skipped.length) warnings.push(`${skipped.length} block(s) skipped (${skipped[0].reason})`);
if (mismatched.length) warnings.push(`${mismatched.length} hand(s) failed the pot check`);
if (noHero.length) warnings.push(`${noHero.length} hand(s) had no face-up hole cards`);
if (warnings.length) console.error(`\nwarnings: ${warnings.join('; ')}`);
