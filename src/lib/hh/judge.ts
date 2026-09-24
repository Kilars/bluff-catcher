/**
 * PLAN-coach.md §4, "the judgment seam": the one port everything a model touches
 * goes through. Jev, an LLM, a solver, or the stub below are interchangeable and
 * the harness never learns which answered.
 *
 * The primitives are ours, not a vendor's — `choice` / `score` / `noul` map 1:1
 * to Jev's three question types (see scripts/probe-typesafe.ts), and an LLM
 * adapter renders the same shapes to a JSON schema. Selecting a real backend is
 * the one deferred decision; `stubJudge` stands in until it is made, so the
 * harness runs and tests offline with no network and no vendor chosen.
 */

export type Question =
  | { kind: 'choice'; instructions: string; criteria: Record<string, string> }
  /** `levels` is ordered low → high; the answer may land between two. */
  | { kind: 'score'; instructions: string; levels: string[] }
  | { kind: 'noul'; instructions: string };

export type QuestionSet = Record<string, Question>;

// An adapter must return `choice` as one of the question's `criteria` keys and
// `score` as a position within its `levels` — the legend stays on the Question,
// so answers are index-only and a consumer keeps the QuestionSet to read them
// back. `noul` carries no confidence on purpose: it is a probability, and the
// probability *is* the belief (this mirrors Jev, whose noul has no confidence).
export type Answer =
  | { kind: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  | { kind: 'score'; score: number; confidence: number }
  | { kind: 'noul'; noul: number };

export type AnswerSet = Record<string, Answer>;

/**
 * The whole contract. `state` is the enriched, blind facts of one decision; the
 * port is deliberately ignorant of its shape so any backend can accept it.
 */
export interface Judge {
  evaluate(state: unknown, questions: QuestionSet): Promise<AnswerSet>;
}

/**
 * A deterministic non-answer: the first option, the middle level, an even coin,
 * all at zero confidence. It proves the wiring end to end without pretending to
 * a judgment — a `confidence: 0` is the tell that no model has been plugged in.
 */
function stubAnswer(q: Question): Answer {
  switch (q.kind) {
    case 'choice': {
      const keys = Object.keys(q.criteria);
      const p = 1 / keys.length;
      return {
        kind: 'choice',
        choice: keys[0],
        confidence: 0,
        probabilities: Object.fromEntries(keys.map((k) => [k, p])),
      };
    }
    case 'score':
      return { kind: 'score', score: (q.levels.length - 1) / 2, confidence: 0 };
    case 'noul':
      return { kind: 'noul', noul: 0.5 };
  }
}

export const stubJudge: Judge = {
  evaluate(_state, questions) {
    return Promise.resolve(
      Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, stubAnswer(q)])),
    );
  },
};
