/**
 * PLAN-coach.md §4, layer 4: scenario packets. One packet per finding, carrying
 * the whole label group — every instance enriched, the shared facets, the
 * dominant cell, the priority, and the label's verification battery — bundled by
 * family and pre-ranked. It is the self-contained unit a coach (or a judge)
 * reads; nothing here answers the battery, that is the model's job later.
 */

import { batteryFor } from './battery.ts';
import { enrich, type Enriched } from './enrich.ts';
import type { QuestionSet } from './judge.ts';
import type { LabelledDecision } from './labels.ts';
import { familyRelevance, type DominantCell, type Family, type Ranked } from './priority.ts';

export interface EnrichedDecision {
  decision: LabelledDecision;
  enriched: Enriched;
}

export interface Packet {
  label: string;
  family: Family;
  base: number;
  evidence: number;
  priority: number;
  instances: number;
  shared: Ranked['group']['shared'];
  dominantCell: DominantCell;
  /** The closed questions, left unanswered — a backend fills these, not us. */
  battery: QuestionSet;
  /** Every instance, enriched. The renderer strides these for output. */
  decisions: EnrichedDecision[];
}

export interface FamilyBundle {
  family: Family;
  /** The family's strongest packet priority — what it surfaces on. */
  relevance: number;
  packets: Packet[];
}

/** Turn one ranked label group into its self-contained packet. */
export function scenarioPacket(r: Ranked): Packet {
  return {
    label: r.label,
    family: r.family,
    base: r.base,
    evidence: r.evidence,
    priority: r.priority,
    instances: r.group.decisions.length,
    shared: r.group.shared,
    dominantCell: r.dominantCell,
    battery: batteryFor(r.label),
    decisions: r.group.decisions.map((decision) => ({ decision, enriched: enrich(decision) })),
  };
}

/**
 * Bundle packets by family, each family ordered by priority and the families
 * themselves ordered by their strongest finding — so the most coachable family
 * leads and its most coachable label leads it.
 */
export function packetsByFamily(ranked: Ranked[]): FamilyBundle[] {
  const relevance = familyRelevance(ranked);
  const byFamily = new Map<Family, Packet[]>();
  for (const r of ranked) {
    byFamily.set(r.family, [...(byFamily.get(r.family) ?? []), scenarioPacket(r)]);
  }
  return [...byFamily.entries()]
    .map(([family, packets]) => ({ family, relevance: relevance[family] ?? 0, packets }))
    .sort((a, b) => b.relevance - a.relevance);
}
