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
import { bigSpots } from './bigspots.ts';
import { coldCalls } from './flats.ts';
import { faced3Bets } from './faced3bets.ts';
import { LABELS, labelGroups } from './labels.ts';
import { depthFor, rfiFolds } from './rfi.ts';
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
  const meta = { archive: archive.meta, window };
  return renderJson(
    summarise(hands),
    meta,
    rfiFolds(hands),
    coldCalls(hands),
    faced3Bets(hands),
    bigSpots(hands),
    labelGroups(hands),
  );
}

describe('docs/leak-coaching.md', () => {
  const report = sampleReport();

  it('builds a report with every documented section populated', () => {
    expect(report.rfiFolds.length).toBeGreaterThan(0);
    expect(report.labels.length).toBeGreaterThan(0);
    expect(report.byBoard.splits.length).toBeGreaterThan(0);
    expect(report.byRole.length).toBeGreaterThan(0);
  });

  /**
   * The payload's whole premise. An agent that can see what a hand returned
   * coaches the hands that lost, and those are not the hands played worst —
   * so every route from the payload to a result is closed, and stays closed.
   */
  it('hands the agent no way to tell what anything returned', () => {
    expect(report).not.toHaveProperty('chipFlow');
    expect(report).not.toHaveProperty('worstPots');
    expect(report).not.toHaveProperty('biggestCalls');
    for (const r of report.byRole) {
      expect(Object.keys(r).sort(), `byRole ${r.role}`).toEqual(['hands', 'role']);
    }
    for (const key of ['wwsf', 'wtsd', 'wsd']) {
      expect(report.stats.map((x) => x.key), key).not.toContain(key);
    }
    // Nothing that survives may carry a result. Big-blind figures are allowed
    // only where they are a decision-time fact: the stack, and bigSpots' chips
    // committed, pot and price — never a net, a win or a showdown.
    const money = /net|won|invested|cost|chips|BB\b/i;
    const decisionTime = /^"(stackBB|committedBB|amountBB|potBB|toCallBB)"/;
    const leaked = JSON.stringify(report).match(/"(\w*(?:net|won|invested|cost|BB))"\s*:/gi) ?? [];
    expect(leaked.filter((k) => !decisionTime.test(k) && money.test(k))).toEqual([]);
    for (const spot of report.bigSpots) {
      for (const key of ['showdown', 'netBB', 'grossBB', 'won', 'streetReached']) {
        expect(spot, key).not.toHaveProperty(key);
      }
    }
  });

  it('orders byRole by hand count, which says nothing about results', () => {
    // Sorted by net, the order alone told the agent which entry lost most.
    const files = FIXTURES.map((path): ArchiveFile => ({ path, text: readFileSync(path, 'utf8') }));
    const archive = readArchive(files);
    const { hands, window } = selectWindow(archive.hands);
    const s = summarise(hands);
    const rigged = {
      ...s,
      byRole: [
        { role: 'open' as const, hands: 1, netBB: -100 },
        { role: 'fold' as const, hands: 5, netBB: 3 },
        { role: '3bet' as const, hands: 5, netBB: -1 },
      ],
    };
    const out = renderJson(rigged, { archive: archive.meta, window }, [], [], [], [], []);
    expect(out.byRole).toEqual([
      { role: '3bet', hands: 5 },
      { role: 'fold', hands: 5 },
      { role: 'open', hands: 1 },
    ]);
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
    for (const key of ['meta', 'stats', 'byBoard', 'rfiFolds', 'labels', 'byRole']) {
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
    expect(Object.keys(report.labels[0]).sort()).toEqual([
      'decisions',
      'instances',
      'label',
      'shared',
      'stride',
    ]);
    expect(Object.keys(report.labels[0].decisions[0]).sort()).toEqual([
      'action',
      'allIn',
      'board',
      'boardType',
      'cards',
      'depth',
      'facedBet',
      'facedSizing',
      'handClass',
      'id',
      'labels',
      'line',
      'mdf',
      'pfa',
      'playersToFlop',
      'position',
      'removals',
      'requiredEquity',
      'sizing',
      'spr',
      'stackBB',
      'street',
    ]);
  });

  it('gives the tournament depth tiers depthFor uses', () => {
    // The doc once said 60bb+/20bb/10bb — the charts, not the cut-offs.
    expect(depthFor(40)).toBe('deep');
    expect(depthFor(39.9)).toBe('mid');
    expect(depthFor(15)).toBe('mid');
    expect(depthFor(14.9)).toBe('short');
    expect(DOC.replace(/\s+/g, ' ')).toContain(
      '`deep` (40bb+, read against the 60bb chart), `mid` (15–40bb, the 20bb chart) or `short` (under 15bb, the 10bb chart)',
    );
  });

  it('carries the price the fold-to-barrel entries tell the agent to read', () => {
    // §4 sends the reader to facedSizing, requiredEquity, mdf and the line;
    // the standard --json payload is what the hand-review skill reads.
    const text = readFileSync('src/lib/hh/fixtures/rc/round2.txt', 'utf8');
    const archive = readArchive([{ path: 'src/lib/hh/fixtures/rc/round2.txt', text }]);
    const { hands, window } = selectWindow(archive.hands);
    const meta = { archive: archive.meta, window };
    const rc = renderJson(summarise(hands), meta, [], [], [], [], labelGroups(hands));
    const d = rc.labels.flatMap((g) => g.decisions).find((x) => x.id === 'RC4851719710')!;
    expect(d).toMatchObject({ facedSizing: 0.75, requiredEquity: 0.3, mdf: 0.57, playersToFlop: 2 });
    expect(d.line).toMatch(/ \/ /);
  });

  /**
   * §4 names labels the agent is told to coach from. A label the code cannot
   * emit is an instruction to look for something that will never arrive, and
   * the agent would then either invent it or say nothing — so the two lists
   * are pinned to each other in both directions.
   */
  it('names exactly the labels the code can emit', () => {
    const emitted = new Set<string>(LABELS);
    const documented = new Set([...DOC.matchAll(/^- \*\*`([a-z-]+)`\*\* —/gm)].map((m) => m[1]));
    expect([...documented].sort()).toEqual([...emitted].sort());
    for (const g of report.labels) expect(emitted, `label ${g.label}`).toContain(g.label);
  });

  it('only names roles the classifier can produce', () => {
    const known = new Set([
      'no-decision',
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
