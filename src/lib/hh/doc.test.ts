/**
 * Guards docs/leak-coaching.md against drift.
 *
 * The doc is grounding for an agent: its triggers are conditions over report
 * fields, and a renamed key or a retuned band silently turns them into
 * fiction. These tests make that a failing build instead.
 *
 * The report is built from the same on-disk fixtures the smoke check uses, so
 * every section it documents is actually populated — an inline one-hand
 * literal left `rfiFolds` and `byBoard.splits` empty, and a field list that is
 * never reached is not a guard.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { readArchive, selectWindow, type ArchiveFile } from './archive.ts';
import { rfiFolds } from './rfi.ts';
import { summarise } from './stats.ts';
import { renderJson } from './report.ts';

// Relative to the repo root, which is vitest's working directory.
const DOC = readFileSync('docs/leak-coaching.md', 'utf8');

const FIXTURES = [
  'src/lib/hh/fixtures/t310296737/day1.txt',
  'src/lib/hh/fixtures/t310299999/day2.txt',
];

/**
 * The §3 band table. The trailing columns are matched but not captured: they
 * pin the table's shape, so a row that loses its high/low/minN cells stops
 * parsing and fails the "documents exactly the stats" test rather than
 * silently reading as a band-only row.
 */
function docBands(): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  for (const m of DOC.matchAll(/^\| `(\w+)` \| (\d+)–(\d+) \| .+? \| .+? \| \d+ \|/gm)) {
    out.set(m[1], [Number(m[2]), Number(m[3])]);
  }
  return out;
}

function sampleReport() {
  const files = FIXTURES.map((path): ArchiveFile => ({ path, text: readFileSync(path, 'utf8') }));
  const archive = readArchive(files);
  const { hands, window } = selectWindow(archive.hands);
  return renderJson(summarise(hands), { archive: archive.meta, window }, rfiFolds(hands));
}

describe('docs/leak-coaching.md', () => {
  const report = sampleReport();

  it('builds a report with every documented section populated', () => {
    expect(report.rfiFolds.length).toBeGreaterThan(0);
    expect(report.byBoard.splits.length).toBeGreaterThan(0);
    expect(report.worstPots[0].decisions.length).toBeGreaterThan(0);
    expect(report.biggestCalls.length).toBeGreaterThan(0);
  });

  it('documents exactly the stats the report emits', () => {
    expect([...docBands().keys()].sort()).toEqual(report.stats.map((s) => s.key).sort());
  });

  it('quotes the same bands the code uses', () => {
    const doc = docBands();
    for (const s of report.stats) {
      expect(doc.get(s.key), `band for ${s.key}`).toEqual(s.band);
    }
  });

  it('describes the input contract with keys that exist', () => {
    for (const key of [
      'meta',
      'chipFlow',
      'stats',
      'byBoard',
      'rfiFolds',
      'byRole',
      'worstPots',
      'biggestCalls',
    ]) {
      expect(report, key).toHaveProperty(key);
    }

    // Only meta.window may be described to a reader; meta.archive is context.
    expect(Object.keys(report.meta.window).sort()).toEqual([
      'decisions',
      'first',
      'hands',
      'last',
      'requestedFrom',
      'requestedTo',
    ]);
    expect(Object.keys(report.meta.archive).sort()).toEqual([
      'excluded',
      'files',
      'first',
      'games',
      'hands',
      'last',
      'skipped',
      'timezone',
      'tournaments',
    ]);
    expect(Object.keys(report.chipFlow).sort()).toEqual([
      'investedBB',
      'netBB',
      'netChips',
      'nonShowdownBB',
      'showdownBB',
    ]);
    expect(Object.keys(report.byBoard.splits[0]).sort()).toEqual([
      'board',
      'key',
      'made',
      'opportunities',
      'pct',
    ]);
    expect(Object.keys(report.rfiFolds[0]).sort()).toEqual([
      'action',
      'cards',
      'caveat',
      'depth',
      'hand',
      'id',
      'position',
      'stackBB',
    ]);
    expect(Object.keys(report.worstPots[0].decisions[0]).sort()).toEqual([
      'action',
      'chips',
      'equityNeeded',
      'potBefore',
      'street',
      'toCall',
    ]);
    expect(Object.keys(report.biggestCalls[0]).sort()).toEqual([
      'board',
      'cards',
      'costBB',
      'equityNeeded',
      'id',
      'street',
    ]);
  });

  it('only names roles the classifier can produce', () => {
    const known = new Set([
      'fold',
      'bb-check',
      'limp',
      'open',
      'iso-raise',
      'cold-call',
      'blind-defend',
      '3bet',
      'squeeze',
      '4bet+',
    ]);
    for (const m of DOC.matchAll(/role='([a-z0-9+-]+)'/g)) {
      expect(known, `role '${m[1]}' in doc`).toContain(m[1]);
    }
  });

  it('only uses verdict and flag values the code emits', () => {
    const verdicts = new Set(['low', 'ok', 'high', 'thin', 'none']);
    for (const m of DOC.matchAll(/verdict (?:=|!=) '(\w+)'/g)) {
      expect(verdicts, `verdict '${m[1]}' in doc`).toContain(m[1]);
    }
    const flags = new Set(['bleed', 'missed', 'null']);
    for (const m of DOC.matchAll(/flag = '(\w+)'/g)) {
      expect(flags, `flag '${m[1]}' in doc`).toContain(m[1]);
    }
  });
});
