/**
 * The real backend behind the `Judge` port — a hosted Anthropic model reading one blind
 * `FamilyBrief` and returning graded per-instance verdicts. It is one implementation of
 * the same interface the stub satisfies; nothing else in the pipeline changes, and the
 * contract is still enforced at the call site (`validateFamilyVerdict` + `assertBlind`),
 * not trusted from here.
 *
 * Node-only: it reads `ANTHROPIC_API_KEY` and calls the network, so it is imported by the
 * CLI (`scripts/leaks.ts`), never by the React app — the SDK stays out of the browser
 * bundle. The default model is `claude-opus-4-8` because grading poker strategy is
 * intelligence-sensitive; `ANTHROPIC_MODEL` overrides it.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { FamilyBrief, FamilyVerdict, Judge } from './judge.ts';
import { JUDGE_SYSTEM } from './judgePrompt.ts';
import { LABELS } from './labels.ts';
import { FAMILIES } from './priority.ts';

const DEFAULT_MODEL = 'claude-opus-4-8';

/**
 * The structured-output schema. It guarantees shape only — the verdict↔severity coupling,
 * one-verdict-per-instance, and ref validity are enforced by `validateFamilyVerdict`, which
 * a JSON Schema cannot express. `severity` is an integer enum because structured outputs
 * reject numeric `minimum`/`maximum`; every object sets `additionalProperties: false` or
 * the request is rejected.
 */
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    family: { type: 'string', enum: Object.keys(FAMILIES) },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          label: { type: 'string', enum: [...LABELS] },
          ref: { type: 'string' },
          verdict: { type: 'string', enum: ['leak', 'fine', 'mixed'] },
          severity: { type: 'integer', enum: [0, 1, 2, 3, 4, 5] },
          note: { type: 'string' },
        },
        required: ['label', 'ref', 'verdict', 'severity', 'note'],
      },
    },
    throughline: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            thesis: { type: 'string' },
            body: { type: 'string' },
            evidenceRefs: { type: 'array', items: { type: 'string' } },
          },
          required: ['thesis', 'body', 'evidenceRefs'],
        },
      ],
    },
  },
  required: ['family', 'verdicts', 'throughline'],
};

export interface AnthropicJudgeOptions {
  /** Defaults to `process.env.ANTHROPIC_API_KEY`. */
  apiKey?: string;
  /** Defaults to `process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8'`. */
  model?: string;
  /** Inject a client (or a stub) — lets the unit tests run with no network. */
  client?: Anthropic;
}

/**
 * Builds a `Judge` backed by the Anthropic API. Throws at construction when no key and no
 * client is available, so the CLI fails before it parses a single hand rather than mid-run.
 */
export function anthropicJudge(opts: AnthropicJudgeOptions = {}): Judge {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!opts.client && !apiKey) {
    throw new Error('anthropic judge needs ANTHROPIC_API_KEY in the environment (or an injected client)');
  }
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = opts.client ?? new Anthropic({ apiKey });

  return {
    async evaluate(brief: FamilyBrief): Promise<FamilyVerdict> {
      const res = await client.messages.create({
        model,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        // `effort: medium` bounds adaptive thinking so the JSON fits under max_tokens
        // without streaming; `format` forces the FamilyVerdict shape.
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system: JUDGE_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(brief) }],
      });

      if (res.stop_reason === 'refusal') throw new Error(`judge refused on family ${brief.family}`);
      if (res.stop_reason === 'max_tokens') throw new Error(`judge output truncated on family ${brief.family} — raise max_tokens`);

      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') throw new Error(`judge returned no text block on family ${brief.family}`);

      return JSON.parse(text.text) as FamilyVerdict;
    },
  };
}
