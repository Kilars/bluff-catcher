/**
 * Builds the blind FamilyBrief the judge reads — one per family, each carrying
 * its spots, their coaching rubric, and the enriched instances to judge. This is
 * the model's INPUT; the FamilyVerdict is its output (judge.ts). Nothing here
 * answers anything — that is the model's job.
 *
 * A label can carry a hundred instances, so a spot ships at most `PER_SPOT`,
 * every ⌈n/N⌉-th in archive order. `--label` passes Infinity to send them all.
 * The enriched math rides along mandatory: strip it and the model recomputes pot
 * odds it should only ever read.
 */

import { enrich } from './enrich.ts';
import type { FamilyBrief, HandFacts, SpotBrief } from './judge.ts';
import type { LabelledDecision } from './labels.ts';
import { familyRelevance, type Family, type Ranked } from './priority.ts';
import { HYPOTHESIS, rubricFor } from './rubric.ts';

const PER_SPOT = 5;

const r1 = (x: number): number => Number(x.toFixed(1));
const r2 = (x: number): number => Number(x.toFixed(2));

function strideFor(n: number, perSpot = PER_SPOT): number {
  return Math.max(1, Math.ceil(n / perSpot));
}

function everyNth<T>(xs: T[], stride: number): T[] {
  return xs.filter((_, i) => i % stride === 0);
}

/** One decision reduced to its blind facts, enriched math attached. `ref` is the
 * unique instance handle — one hand can check a draw on two streets, so the hand
 * id alone does not identify the instance. */
export function handFacts(d: LabelledDecision): HandFacts {
  return {
    id: d.id,
    ref: `${d.id}#${d.street}`,
    street: d.street,
    action: d.kind,
    position: d.position,
    depth: d.depth,
    spr: d.spr === null ? null : r1(d.spr),
    sizing: d.sizing === null ? null : r2(d.sizing),
    facedSizing: d.facedSizing === null ? null : r2(d.facedSizing),
    allIn: d.allIn,
    pfa: d.pfa,
    cards: d.cards,
    board: d.board,
    handClass: d.handClass,
    boardType: d.boardType,
    removals: d.removals,
    playersToFlop: d.playersToFlop ?? 0,
    line: d.line ?? '',
    enriched: enrich(d),
  };
}

export function spotBrief(r: Ranked, perSpot = PER_SPOT): SpotBrief {
  const rubric = rubricFor(r.label);
  const stride = strideFor(r.group.decisions.length, perSpot);
  return {
    label: r.label,
    cues: rubric.cues,
    unless: rubric.unless,
    count: r.group.decisions.length,
    instances: everyNth(r.group.decisions, stride).map(handFacts),
  };
}

/**
 * Bundle spots by family, families ordered by their strongest candidate — this
 * is only the order the model receives them in; the coaching payload is re-ranked
 * by what the model *found* (report.ts). Each family carries its hypothesis, a
 * claim the model tests rather than restates.
 */
export function familyBriefs(ranked: Ranked[], perSpot = PER_SPOT): FamilyBrief[] {
  const relevance = familyRelevance(ranked);
  const byFamily = new Map<Family, Ranked[]>();
  for (const r of ranked) byFamily.set(r.family, [...(byFamily.get(r.family) ?? []), r]);
  return [...byFamily.entries()]
    .sort((a, b) => (relevance[b[0]] ?? 0) - (relevance[a[0]] ?? 0))
    .map(([family, rs]) => ({
      family,
      hypothesis: HYPOTHESIS[family],
      spots: rs.map((r) => spotBrief(r, perSpot)),
    }));
}
