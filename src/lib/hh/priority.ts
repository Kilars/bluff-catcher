/**
 * PLAN-coach.md §4, "priority" and "families". A session ranks what to coach by
 * `base × evidence`, and this is where the harness — never the model — computes
 * it. Labels are the first-class unit; families are only the teaching container.
 *
 * `base` is a per-label weight; `evidence` is how alike a label's instances look
 * in Hero's own data (its dominant cell's share), never a rate. Empty labels
 * drop out.
 */

import type { LabelGroup, LabelledDecision } from './labels.ts';
import { LABELS, type Label } from './labels.ts';

/**
 * Provisional per-label weights. Aggression is an input, not an axis: the target
 * is an amateur who skews passive, so the missed-aggression labels outweigh the
 * defensive bluff-catch. Ordering matters more than the exact numbers here.
 *
 * TODO: calibrate against the two small-stakes videos (lSvyX-Ryi0M, 4wGRlpNxDBs)
 * — these are a first draft, not measured bb/100.
 */
export const BASE_PRIORITY: Record<Label, number> = {
  'pfa-check-flop': 8,
  'check-draw': 7,
  'river-check-value': 7,
  'river-bluff-no-blocker': 5,
  'donk-bet': 5,
  'check-raise-flop': 5,
  'overbet-strong': 4,
  'river-bluff-with-blocker': 4,
  'river-call-marginal': 3,
};

export type Family =
  | 'PFR flop passivity'
  | 'Caller aggression'
  | 'River bluffing'
  | 'River value / bluff-catch';

/** The four spot-based families (unanimous 5-judge panel, §4). */
export const FAMILIES: Record<Family, Label[]> = {
  'PFR flop passivity': ['pfa-check-flop', 'check-draw'],
  'Caller aggression': ['donk-bet', 'check-raise-flop'],
  'River bluffing': ['river-bluff-with-blocker', 'river-bluff-no-blocker'],
  'River value / bluff-catch': ['river-call-marginal', 'river-check-value', 'overbet-strong'],
};

const FAMILY_OF: Record<Label, Family> = Object.fromEntries(
  (Object.entries(FAMILIES) as [Family, Label[]][]).flatMap(([fam, labels]) =>
    labels.map((l) => [l, fam]),
  ),
) as Record<Label, Family>;

export function familyOf(label: Label): Family {
  return FAMILY_OF[label];
}

const FACETS = ['position', 'depth', 'handClass', 'boardType'] as const;

export interface DominantCell {
  /** The most common facet combination among the instances. */
  cell: Partial<Record<(typeof FACETS)[number], string>>;
  /** Its share of the instances, 0..1. */
  share: number;
}

/**
 * The modal facet-tuple and how much of the group sits in it. A group whose
 * instances all share a position/depth/hand/texture concentrates at share 1.0;
 * scattered instances spread thin. This is the shape `shared` reports as facts;
 * `share` is what turns it into a strength.
 */
export function dominantCell(ds: LabelledDecision[]): DominantCell {
  const counts = new Map<string, { cell: DominantCell['cell']; n: number }>();
  for (const d of ds) {
    const cell: DominantCell['cell'] = {};
    for (const f of FACETS) {
      const v = d[f];
      if (v !== null) cell[f] = String(v);
    }
    const key = FACETS.map((f) => cell[f] ?? '∅').join('|');
    const hit = counts.get(key) ?? { cell, n: 0 };
    hit.n++;
    counts.set(key, hit);
  }
  let best = { cell: {} as DominantCell['cell'], n: 0 };
  for (const hit of counts.values()) if (hit.n > best.n) best = hit;
  return { cell: best.cell, share: ds.length ? best.n / ds.length : 0 };
}

/** A lone instance trivially agrees with itself, so it earns only this floor. */
const LONE_EVIDENCE = 0.5;

/** How alike the instances look: the dominant cell's share, floored at n = 1. */
export function evidence(ds: LabelledDecision[]): number {
  if (ds.length < 2) return LONE_EVIDENCE;
  return dominantCell(ds).share;
}

export interface Ranked {
  label: Label;
  family: Family;
  base: number;
  evidence: number;
  /** base × evidence — the sort key. */
  priority: number;
  group: LabelGroup;
}

/** Every non-empty label group scored and ordered by priority, highest first. */
export function rankGroups(groups: LabelGroup[]): Ranked[] {
  return groups
    .filter((g) => g.decisions.length > 0 && (LABELS as readonly string[]).includes(g.label))
    .map((g): Ranked => {
      const label = g.label as Label;
      const base = BASE_PRIORITY[label];
      const ev = evidence(g.decisions);
      return { label, family: familyOf(label), base, evidence: ev, priority: base * ev, group: g };
    })
    .sort((a, b) => b.priority - a.priority);
}

/** The strongest priority seen in each family — a family surfaces on its best label. */
export function familyRelevance(ranked: Ranked[]): Partial<Record<Family, number>> {
  const out: Partial<Record<Family, number>> = {};
  for (const r of ranked) out[r.family] = Math.max(out[r.family] ?? 0, r.priority);
  return out;
}
