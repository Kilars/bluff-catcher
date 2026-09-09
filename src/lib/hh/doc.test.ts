/**
 * Guards docs/leak-coaching.md against drift.
 *
 * The doc is grounding for an agent: its triggers are conditions over report
 * fields, and a renamed key or a retuned band silently turns them into
 * fiction. These tests make that a failing build instead.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { parseHands } from './parse.ts';
import { heroHands } from './hero.ts';
import { summarise } from './stats.ts';
import { renderJson } from './report.ts';

// Relative to the repo root, which is vitest's working directory.
const DOC = readFileSync('docs/leak-coaching.md', 'utf8');

/** The §3 band table: | `key` | lo–hi | … */
function docBands(): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  for (const m of DOC.matchAll(/^\| `(\w+)` \| (\d+)–(\d+) \|/gm)) {
    out.set(m[1], [Number(m[2]), Number(m[3])]);
  }
  return out;
}

/** A report built from a hand that reaches showdown, so every section is populated. */
function sampleReport() {
  const hand = `Poker Hand #TM1: Tournament #1, Daily Special $2.50 Hold'em No Limit - Level7(175/350(45)) - 2026/09/08 20:03:09
Table '19' 8-max Seat #6 is the button
Seat 3: Villain (27,060 in chips)
Seat 6: Hero (18,094 in chips)
Seat 7: p7 (7,485 in chips)
Seat 8: p8 (9,910 in chips)
Hero: posts the ante 45
Villain: posts the ante 45
p7: posts the ante 45
p8: posts the ante 45
p7: posts small blind 175
p8: posts big blind 350
*** HOLE CARDS ***
Dealt to Hero [4s Ac]
Villain: raises 525 to 875
Hero: calls 875
p7: folds
p8: folds
*** FLOP *** [3h 2c As]
Villain: bets 1,050
Hero: calls 1,050
*** TURN *** [3h 2c As] [2d]
Villain: bets 2,368
Hero: calls 2,368
*** RIVER *** [3h 2c As 2d] [8s]
Villain: bets 5,000
Hero: calls 5,000
Villain: shows [Ad Kh] (two pair, Aces and Twos)
Hero: shows [4s Ac] (two pair, Aces and Twos)
*** SHOWDOWN ***
Villain collected 19,111 from pot
*** SUMMARY ***
Total pot 19,111 | Rake 0 | Jackpot 0 | Bingo 0 | Fortune 0 | Tax 0
`;
  const { hands } = parseHands(hand);
  return renderJson(summarise(heroHands(hands)), { game: 'test', date: '2026-09-08' });
}

describe('docs/leak-coaching.md', () => {
  const report = sampleReport();

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
    for (const key of ['meta', 'chipFlow', 'stats', 'byRole', 'worstPots', 'biggestCalls']) {
      expect(report, key).toHaveProperty(key);
    }
    expect(Object.keys(report.chipFlow).sort()).toEqual([
      'investedBB',
      'netBB',
      'netChips',
      'nonShowdownBB',
      'showdownBB',
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
