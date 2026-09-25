/**
 * Guards the coach payload — the deliverable of --mode coach. Two things it must
 * never lose: the results-blindness every other payload here enforces, and the
 * brief→verdict join (each shown instance carries its judgment; families and
 * spots ranked by wrongness). Built from the same on-disk fixtures doc.test.ts
 * uses, plus synthetic briefs where a controlled shape is needed.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { readArchive, selectWindow, type ArchiveFile } from './archive.ts';
import { stubJudge, validateFamilyVerdict, type FamilyBrief, type FamilyVerdict } from './judge.ts';
import { labelGroups } from './labels.ts';
import { familyBriefs } from './packet.ts';
import { rankGroups } from './priority.ts';
import { renderCoachJson, renderCoachText, type ReportMeta } from './report.ts';

const FIXTURES = [
  'src/lib/hh/fixtures/t310296737/day1.txt',
  'src/lib/hh/fixtures/t310299999/day2.txt',
];

async function fixtureCoach() {
  const files = FIXTURES.map((path): ArchiveFile => ({ path, text: readFileSync(path, 'utf8') }));
  const archive = readArchive(files);
  const { hands, window } = selectWindow(archive.hands);
  const meta: ReportMeta = { archive: archive.meta, window };
  const briefs = familyBriefs(rankGroups(labelGroups(hands)));
  const verdicts: FamilyVerdict[] = [];
  for (const b of briefs) verdicts.push(validateFamilyVerdict(b, await stubJudge.evaluate(b)));
  return renderCoachJson(briefs, verdicts, meta);
}

const META = { archive: {}, window: {} } as unknown as ReportMeta;

describe('renderCoachJson — blindness', () => {
  it('produces findings from the fixtures', async () => {
    const payload = await fixtureCoach();
    const findings = payload.families.flatMap((f) => f.findings);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].decisions.length).toBeGreaterThan(0);
  });

  it('hands the coach no way to tell what anything returned — across the whole payload', async () => {
    const payload = await fixtureCoach();
    const money = /net|won|invested|cost|chips|BB\b/i;
    // The prior checkCost leak entered at the aggregation level, not the decision
    // level, so this scans the entire serialised payload, not just decisions[0].
    const leaked = JSON.stringify(payload).match(/"(\w*(?:net|won|invested|cost|BB))"\s*:/gi) ?? [];
    expect(leaked.filter((k) => !/stackBB/i.test(k) && money.test(k))).toEqual([]);
  });

  it('does not leak the result through the action line on a bet decision', async () => {
    // A bet/raise decision's line must end at Hero's own action; a trailing
    // villain fold (lower-case) would say Hero won the pot. Guarding the string
    // value, not just the key, since the leak lived inside `line`.
    const payload = await fixtureCoach();
    for (const fam of payload.families) {
      for (const f of fam.findings) {
        for (const d of f.decisions) {
          if (d.action !== 'bet' && d.action !== 'raise') continue;
          const letters = d.line.replace(/[^a-zA-Z]/g, '');
          const lastLetter = letters.at(-1) ?? '';
          expect(lastLetter, `${d.id}: ${d.line}`).toBe(lastLetter.toUpperCase());
        }
      }
    }
  });

  it('pins the family, finding and decision shapes', async () => {
    const payload = await fixtureCoach();
    const fam = payload.families[0];
    expect(Object.keys(fam).sort()).toEqual([
      'family',
      'findings',
      'leaks',
      'throughline',
      'top',
      'weight',
    ]);

    const finding = fam.findings[0];
    expect(Object.keys(finding).sort()).toEqual([
      'decisions',
      'instances',
      'label',
      'leaks',
      'shown',
      'top',
      'weight',
    ]);

    expect(Object.keys(finding.decisions[0]).sort()).toEqual([
      'action',
      'allIn',
      'board',
      'boardType',
      'cards',
      'depth',
      'enriched',
      'facedSizing',
      'handClass',
      'id',
      'line',
      'note',
      'pfa',
      'playersToFlop',
      'position',
      'ref',
      'removals',
      'severity',
      'sizing',
      'spr',
      'street',
      'verdict',
    ]);
  });
});

describe('renderCoachJson — join and ranking', () => {
  // Two families, one with a real leak, one clean, so ranking is observable.
  const brief: FamilyBrief = familyBriefs(
    rankGroups([
      { label: 'pfa-check-flop', decisions: [dec('a1'), dec('a2')], shared: {} },
      { label: 'check-draw', decisions: [dec('b1')], shared: {} },
      { label: 'donk-bet', decisions: [dec('c1')], shared: {} },
    ] as never),
  ) as never;

  function dec(id: string) {
    return {
      id,
      kind: 'check',
      position: 'CO',
      depth: 'deep',
      handClass: 'draw',
      boardType: 'wet-high-mine',
      sizing: 0.5,
      facedSizing: null,
      spr: 4,
      allIn: false,
      pfa: true,
      cards: ['Ah', 'Kh'],
      board: ['9h', '8c', '2d'],
      removals: [],
      line: 'R / X',
    };
  }

  it('attaches each verdict to its cited hand and ranks leaks first', () => {
    const briefs = brief as unknown as FamilyBrief[];
    const verdicts: FamilyVerdict[] = briefs.map((b) => ({
      family: b.family,
      throughline:
        b.family === 'PFR flop passivity'
          ? { thesis: 'passive', body: '…', evidenceRefs: ['a1', 'a2'] }
          : null,
      verdicts: b.spots.flatMap((s) =>
        s.instances.map((h) => ({
          label: s.label,
          ref: h.ref,
          verdict: s.label === 'pfa-check-flop' ? ('leak' as const) : ('fine' as const),
          severity: s.label === 'pfa-check-flop' ? 4 : 0,
          note: 'n',
        })),
      ),
    }));

    const payload = renderCoachJson(briefs, verdicts, META);
    // The family with a leak sorts to the front.
    expect(payload.families[0].family).toBe('PFR flop passivity');
    expect(payload.families[0].leaks).toBe(2);
    const leaky = payload.families[0].findings.find((f) => f.label === 'pfa-check-flop');
    expect(leaky?.decisions.every((d) => d.verdict === 'leak' && d.severity === 4)).toBe(true);
  });

  it('keeps the throughline only when two or more spots leak', () => {
    const briefs = brief as unknown as FamilyBrief[];
    // Only pfa-check-flop leaks → one spot → throughline dropped even though supplied.
    const verdicts: FamilyVerdict[] = briefs.map((b) => ({
      family: b.family,
      throughline: { thesis: 'x', body: 'y', evidenceRefs: [] },
      verdicts: b.spots.flatMap((s) =>
        s.instances.map((h) => ({
          label: s.label,
          ref: h.ref,
          verdict: s.label === 'pfa-check-flop' ? ('leak' as const) : ('fine' as const),
          severity: s.label === 'pfa-check-flop' ? 3 : 0,
          note: 'n',
        })),
      ),
    }));
    const payload = renderCoachJson(briefs, verdicts, META);
    const pfr = payload.families.find((f) => f.family === 'PFR flop passivity');
    expect(pfr?.throughline).toBeNull();
  });
});

describe('renderCoachText', () => {
  it('summarises the empty window without inventing a finding', () => {
    expect(renderCoachText(renderCoachJson([], [], META))).toBe(
      'no labelled decisions in this window',
    );
  });
});
