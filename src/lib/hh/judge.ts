/**
 * The one seam a model sits behind. One call per family: the model reads the
 * family's blind bundle and returns a verdict on each INSTANCE — not one verdict
 * per label, because a player checks a nut flush draw on a monotone flop (fine)
 * and a gutshot into a range-ahead raiser (leak) under the same label, and a
 * single label-level answer is wrong for one of them.
 *
 * Jev, an LLM, a solver or the stub are interchangeable; the harness never learns
 * which answered. The old choice/score/noul primitives were shaped to fit a
 * type-safe backend and are gone — a regular LLM fills these shapes in one
 * structured-output call.
 *
 * `confidence: 0` used to be the "no model plugged in" tell; its replacement is
 * `validateFamilyVerdict`. A backend that returns a malformed shape, an unknown
 * hand id, or a label not in the brief fails validation — that is the degraded-
 * backend signal, and it is enforced at the seam, not trusted from the caller.
 */

import type { Enriched } from './enrich.ts';
import type { Label } from './labels.ts';
import type { Family } from './priority.ts';

/**
 * The blind facts of one decision. Every field is knowable before the next card;
 * `enriched` carries the deterministic math (pot odds, alpha, MDF) so the model
 * reads the number instead of hallucinating it, and `line` the action sequence.
 * No outcome, no villain cards, ever.
 */
export interface HandFacts {
  id: string;
  street: string;
  action: string;
  position: string;
  depth: string;
  spr: number | null;
  sizing: number | null;
  /** The bet Hero faced or led into, pot-fraction; null when none. */
  facedSizing: number | null;
  allIn: boolean;
  pfa: boolean;
  cards: string[];
  board: string[];
  handClass: string;
  boardType: string | null;
  removals: string[];
  /** Compact blind action line up to Hero's street — see lines.ts. */
  line: string;
  enriched: Enriched;
}

/** One spot within a family: its coaching rubric and the instances to judge. */
export interface SpotBrief {
  label: Label;
  /** What to check — names the enriched fields to read (rubric.ts). */
  cues: string[];
  /** When the play is standard, not a leak. */
  unless: string;
  /** Total instances in the candidate group, before sampling to `instances`. */
  count: number;
  instances: HandFacts[];
}

/** The blind family bundle handed to one judge call. */
export interface FamilyBrief {
  family: Family;
  /** The family thesis, phrased as a claim to test against the hands. */
  hypothesis: string;
  spots: SpotBrief[];
}

export type Verdict = 'leak' | 'fine' | 'mixed';

/**
 * One judged hand. `id` must be an id supplied in the brief — the verdict is
 * forced to cite a specific hand, which is what keeps the coaching off generic
 * platitudes. `severity` is 0 when fine, 1..5 for how much a leak costs.
 */
export interface InstanceVerdict {
  label: Label;
  id: string;
  verdict: Verdict;
  severity: number;
  note: string;
}

export interface FamilyVerdict {
  family: Family;
  verdicts: InstanceVerdict[];
  /** The cross-spot lesson. Fires only when the family holds a real pattern; null otherwise. */
  throughline: { thesis: string; body: string } | null;
}

export interface Judge {
  evaluate(brief: FamilyBrief): Promise<FamilyVerdict>;
}

const VERDICTS = new Set<Verdict>(['leak', 'fine', 'mixed']);

/**
 * The seam's contract, enforced not trusted. Throws on any shape a downstream
 * consumer would silently misread: an id the brief never supplied, a label not
 * in the brief, a verdict outside the enum, a severity out of 0..5. This is the
 * replacement for the old `confidence: 0` tell — a broken or degraded backend
 * fails here rather than emitting plausible-looking nonsense.
 */
export function validateFamilyVerdict(brief: FamilyBrief, v: FamilyVerdict): FamilyVerdict {
  if (v.family !== brief.family) throw new Error(`verdict family ${v.family} ≠ brief ${brief.family}`);
  const ids = new Map<Label, Set<string>>();
  for (const s of brief.spots) ids.set(s.label, new Set(s.instances.map((h) => h.id)));
  for (const iv of v.verdicts) {
    const known = ids.get(iv.label);
    if (!known) throw new Error(`verdict for label ${iv.label} not in brief`);
    if (!known.has(iv.id)) throw new Error(`verdict cites hand ${iv.id} not in ${iv.label}`);
    if (!VERDICTS.has(iv.verdict)) throw new Error(`bad verdict ${iv.verdict} on ${iv.id}`);
    if (!Number.isInteger(iv.severity) || iv.severity < 0 || iv.severity > 5) {
      throw new Error(`severity ${iv.severity} out of 0..5 on ${iv.id}`);
    }
  }
  return v;
}

/**
 * A deterministic non-answer: every instance `fine` at severity 0, no throughline.
 * It proves the wiring end to end and runs the harness offline with no network
 * and no backend chosen; a payload of all-`fine`, `stub` notes is the tell.
 */
export const stubJudge: Judge = {
  evaluate(brief) {
    const verdicts = brief.spots.flatMap((s) =>
      s.instances.map(
        (h): InstanceVerdict => ({
          label: s.label,
          id: h.id,
          verdict: 'fine',
          severity: 0,
          note: 'stub: no model plugged in',
        }),
      ),
    );
    return Promise.resolve({ family: brief.family, verdicts, throughline: null });
  },
};
