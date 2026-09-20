/**
 * One smoke check for the leaks CLI. `npm run smoke`, exit 0 or 1.
 *
 * Not a test suite — that is its own follow-up plan. This covers the four
 * things that fail *silently*: an argv that swallows a flag's value into the
 * target list, a date window that filters the wrong way (or not at all), a
 * raise read as a bet, and the same hand counted twice when a tournament is
 * exported again.
 *
 * It shells out to the real CLI rather than importing it, because the argv
 * handling is half of what is being checked.
 */

import { execFileSync } from 'node:child_process';

import { readArchive } from '../src/lib/hh/archive.ts';
import { readFileSync } from 'node:fs';

const FIXTURES = 'src/lib/hh/fixtures';
const DAY1 = `${FIXTURES}/t310296737/day1.txt`;

const failures: string[] = [];

function check(what: string, ok: boolean, detail = ''): void {
  if (ok) console.log(`  ok    ${what}`);
  else {
    console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ''}`);
    failures.push(what);
  }
}

function leaks(...args: string[]): string {
  return execFileSync('node', ['--experimental-strip-types', 'scripts/leaks.ts', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

console.log('smoke: leaks CLI');

// ── argv survives its flags ──────────────────────────────────────────────────
// `--mode pots --from …` used to put "pots" and the date into the target list,
// where statSync threw ENOENT on them.
const pots = JSON.parse(leaks(FIXTURES, '--mode', 'pots', '--from', '2026-09-08', '--json'));
// Length, not just shape: an empty `pots` array would satisfy Array.isArray
// while the window quietly matched nothing.
check('argv: --mode and --from consume their values', pots.pots?.length === 4);

// ── the window filters, in both directions ───────────────────────────────────
// Against the slash-formatted timestamp these silently returned everything
// (--from) and nothing (--to).
const all = JSON.parse(leaks(FIXTURES, '--mode', 'pots', '--json')).pots as { id: string }[];
const later = JSON.parse(
  leaks(FIXTURES, '--mode', 'pots', '--from', '2026-09-09', '--json'),
).pots as { id: string }[];
const earlier = JSON.parse(
  leaks(FIXTURES, '--mode', 'pots', '--to', '2026-09-08', '--json'),
).pots as { id: string }[];

check('window: the fixture spans two days', all.length === 4, `${all.length} hands`);
check(
  'window: --from keeps only the later day',
  later.length === 2 && later.every((h) => ['TM3', 'TM4'].includes(h.id)),
  later.map((h) => h.id).join(','),
);
check(
  'window: --to keeps only the earlier day',
  earlier.length === 2 && earlier.every((h) => ['TM1', 'TM2'].includes(h.id)),
  earlier.map((h) => h.id).join(','),
);

// ── a raise is read as a raise ───────────────────────────────────────────────
// "raises 525 to 875" is a raise *to* 875, not a bet of 525. Getting it
// backwards inflates every pot, and the pot check is what catches it. TM1 is
// Hero's whole stack: 45 ante + 875 + 1,050 + 2,368 + 13,756 = 18,094, which
// over a 350 big blind is 51.7bb.
const day1 = readArchive([{ path: DAY1, text: readFileSync(DAY1, 'utf8') }]);
const tm1 = day1.hands.find((h) => h.id === 'TM1');
check('raise: TM1 reconciles against its printed total pot', day1.excluded.length === 0);
check('raise: TM1 cost Hero 51.7bb gross', tm1 !== undefined && tm1.grossBB.toFixed(1) === '51.7');

// A pot Hero took down with an uncalled bet still cost what it cost: TM2's
// 1,200 chip 3-bet is 6.1bb gross even though 800 came straight back.
const tm2 = day1.hands.find((h) => h.id === 'TM2');
check('raise: an uncalled 3-bet still ranks by what went in', tm2?.grossBB.toFixed(1) === '6.1');

// ── the default mode renders end to end ──────────────────────────────────────
// The JSON payload is covered by doc.test.ts; this is the terminal path, and
// the chart-fold line is the one finding that is sound at n=1.
const text = leaks(FIXTURES);
check('leaks: the text report names the CO fold of AJo', text.includes('TM3') && text.includes('(AJo)'));

// ── the same export read twice is still one archive ──────────────────────────
const day1Text = readFileSync(DAY1, 'utf8');
const twice = readArchive([
  { path: DAY1, text: day1Text },
  { path: `${DAY1}.copy`, text: day1Text },
]);
check(
  'dedupe: a re-exported file adds no hands',
  twice.hands.length === day1.hands.length && twice.excluded.length === day1.hands.length,
  `${twice.hands.length} hands, ${twice.excluded.length} excluded`,
);

if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log('\nall smoke checks passed');
