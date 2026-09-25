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
  /** The hand id, so the user can find it in the client — may repeat across a
   * label's instances when one hand checks a draw on two streets. */
  id: string;
  /** Unique instance handle within the brief — what a verdict cites. */
  ref: string;
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
  /** Players who saw the flop — heads-up vs multiway changes every threshold. */
  playersToFlop: number;
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

export type Severity = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * One judged instance. `ref` must be a handle supplied in the brief — the verdict
 * is forced to cite a specific instance, which is what keeps the coaching off
 * generic platitudes. `severity` is 0 when `fine`, 1..5 for how much a leak
 * costs; `validateFamilyVerdict` enforces that pairing, so a leak can't hide at 0.
 */
export interface InstanceVerdict {
  label: Label;
  ref: string;
  verdict: Verdict;
  severity: Severity;
  note: string;
}

/**
 * The cross-spot lesson. `evidenceIds` are the leak hands it generalises from —
 * required and non-empty, so the family prose is forced to name the instances it
 * is built on rather than deliver a free-floating lecture.
 */
export interface Throughline {
  thesis: string;
  body: string;
  /** Instance refs this generalises from — each must be a leak in this family. */
  evidenceRefs: string[];
}

export interface FamilyVerdict {
  family: Family;
  verdicts: InstanceVerdict[];
  /** Fires only when the family holds a real pattern; null otherwise. */
  throughline: Throughline | null;
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
  const refs = new Map<Label, Set<string>>();
  for (const s of brief.spots) refs.set(s.label, new Set(s.instances.map((h) => h.ref)));

  const seen = new Set<string>();
  const leakRefs = new Set<string>();
  for (const iv of v.verdicts) {
    const known = refs.get(iv.label);
    if (!known) throw new Error(`verdict for label ${iv.label} not in brief`);
    if (!known.has(iv.ref)) throw new Error(`verdict cites ${iv.ref} not in ${iv.label}`);
    const key = `${iv.label}|${iv.ref}`;
    if (seen.has(key)) throw new Error(`duplicate verdict for ${key}`);
    seen.add(key);
    if (!VERDICTS.has(iv.verdict)) throw new Error(`bad verdict ${iv.verdict} on ${iv.ref}`);
    if (!Number.isInteger(iv.severity) || iv.severity < 0 || iv.severity > 5) {
      throw new Error(`severity ${iv.severity} out of 0..5 on ${iv.ref}`);
    }
    // A verdict and its severity must agree, or a real leak hides at 0 (invisible
    // to ranking) and a fine spot inflates the weight.
    if (iv.verdict === 'fine' && iv.severity !== 0) throw new Error(`fine at severity ${iv.severity} on ${iv.ref}`);
    if (iv.verdict !== 'fine' && iv.severity < 1) throw new Error(`${iv.verdict} at severity 0 on ${iv.ref}`);
    if (typeof iv.note !== 'string' || iv.note.trim() === '') throw new Error(`empty note on ${iv.ref}`);
    if (iv.verdict !== 'fine') leakRefs.add(iv.ref);
  }

  // Every instance the model was handed must come back judged — a silent drop
  // reads as a clean spot when the model simply said nothing.
  for (const s of brief.spots) {
    for (const h of s.instances) {
      if (!seen.has(`${s.label}|${h.ref}`)) throw new Error(`no verdict for ${s.label}/${h.ref}`);
    }
  }

  const t = v.throughline;
  if (t !== null) {
    if (typeof t.thesis !== 'string' || t.thesis.trim() === '') throw new Error('empty throughline thesis');
    if (typeof t.body !== 'string' || t.body.trim() === '') throw new Error('empty throughline body');
    if (!t.evidenceRefs.length) throw new Error('throughline cites no evidence');
    for (const ref of t.evidenceRefs) {
      if (!leakRefs.has(ref)) throw new Error(`throughline cites ${ref}, not a leak in this family`);
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
          ref: h.ref,
          verdict: 'fine',
          severity: 0,
          note: 'stub: no model plugged in',
        }),
      ),
    );
    return Promise.resolve({ family: brief.family, verdicts, throughline: null });
  },
};
