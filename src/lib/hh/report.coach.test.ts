/**
 * Guards the coach payload — the deliverable of --mode coach. Two things it must
 * never lose: the results-blindness every other payload here enforces, and the
 * shape (enriched decisions, strided instances, spliced battery answers) a coach
 * reads. Built from the same on-disk fixtures doc.test.ts uses, plus synthetic
 * groups where a controlled instance count is needed.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { readArchive, selectWindow, type ArchiveFile } from './archive.ts';
import { batteryFor } from './battery.ts';
import { stubJudge } from './judge.ts';
import { labelGroups, type LabelGroup, type LabelledDecision } from './labels.ts';
import { renderCoachJson, renderCoachText, type ReportMeta } from './report.ts';

const FIXTURES = [
  'src/lib/hh/fixtures/t310296737/day1.txt',
  'src/lib/hh/fixtures/t310299999/day2.txt',
];

function fixtureCoach() {
  const files = FIXTURES.map((path): ArchiveFile => ({ path, text: readFileSync(path, 'utf8') }));
  const archive = readArchive(files);
  const { hands, window } = selectWindow(archive.hands);
  const meta: ReportMeta = { archive: archive.meta, window };
  return renderCoachJson(labelGroups(hands), meta);
}

function d(over: Partial<LabelledDecision>): LabelledDecision {
  return {
    id: 'h1',
    street: 'flop',
    kind: 'check',
    position: 'CO',
    depth: 'deep',
    handClass: 'draw',
    boardType: 'wet-high-mine',
    stackBB: 50,
    spr: 4,
    sizing: 0.5,
    facedSizing: null,
    allIn: false,
    pfa: true,
    facedBet: false,
    cards: ['Ah', 'Kh'],
    board: ['9h', '8c', '2d'],
    removals: [],
    labels: ['check-draw'],
    ...over,
  } as LabelledDecision;
}

const META = { archive: {}, window: {} } as unknown as ReportMeta;

describe('renderCoachJson — blindness', () => {
  const payload = fixtureCoach();
  const findings = payload.families.flatMap((f) => f.findings);

  it('produces findings from the fixtures', () => {
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].decisions.length).toBeGreaterThan(0);
  });

  it('hands the coach no way to tell what anything returned', () => {
    const money = /net|won|invested|cost|chips|BB\b/i;
    const leaked = JSON.stringify(payload).match(/"(\w*(?:net|won|invested|cost|BB))"\s*:/gi) ?? [];
    expect(leaked.filter((k) => !/stackBB/i.test(k) && money.test(k))).toEqual([]);
  });

  it('pins the finding and enriched-decision shape', () => {
    expect(Object.keys(findings[0]).sort()).toEqual([
      'base',
      'battery',
      'decisions',
      'dominantCell',
      'evidence',
      'instances',
      'label',
      'priority',
      'shared',
      'stride',
    ]);
    // The blind decision keys from doc.test.ts, plus the enriched block — and
    // nothing result-bearing riding in through the spread.
    expect(Object.keys(findings[0].decisions[0]).sort()).toEqual([
      'action',
      'allIn',
      'board',
      'boardType',
      'cards',
      'depth',
      'enriched',
      'facedBet',
      'handClass',
      'id',
      'labels',
      'pfa',
      'position',
      'removals',
      'sizing',
      'spr',
      'stackBB',
      'street',
    ]);
  });
});

describe('renderCoachJson — striding and answers', () => {
  const group: LabelGroup = {
    label: 'check-draw',
    decisions: Array.from({ length: 12 }, () => d({})),
    shared: {},
  } as LabelGroup;

  it('strides a large group but reports every instance', () => {
    const [finding] = renderCoachJson([group], META).families[0].findings;
    expect(finding.instances).toBe(12); // the whole group is counted
    expect(finding.stride).toBe(3); // ceil(12 / 5)
    expect(finding.decisions).toHaveLength(4); // every 3rd of 12
  });

  it('splices battery answers only when a judge supplied them', async () => {
    const answered = await stubJudge.evaluate({}, batteryFor('check-draw'));
    const withJudge = renderCoachJson([group], META, { 'check-draw': answered }).families[0]
      .findings[0];
    expect(Object.keys(withJudge.answers ?? {})).toEqual(Object.keys(withJudge.battery));

    const without = renderCoachJson([group], META).families[0].findings[0];
    expect(without).not.toHaveProperty('answers');
  });
});

describe('renderCoachText', () => {
  it('summarises the empty window without inventing a finding', () => {
    expect(renderCoachText(renderCoachJson([], META))).toBe(
      'no labelled decisions in this window',
    );
  });
});
