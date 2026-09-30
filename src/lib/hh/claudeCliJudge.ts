/**
 * A `Judge` backed by the local `claude` CLI in headless print mode — the backend to use
 * when you have Claude Code logged in and would rather spend your existing plan than wire an
 * `ANTHROPIC_API_KEY`. It shells out to `claude -p --output-format json`, which authenticates
 * with whatever account `claude` is logged in as; there is no API key here.
 *
 * It implements the same port as the stub and the API judge, so nothing downstream changes —
 * the contract is still enforced at the call site (`validateFamilyVerdict` + `assertBlind`).
 * Unlike the API backend there is no JSON-Schema enforcement, so the shared prompt spells out
 * the exact shape (see judgePrompt.ts) and `evaluate` extracts the JSON object defensively.
 *
 * Node-only (spawns a child process): imported by the CLI, never by the React app.
 */

import { spawn } from 'node:child_process';

import type { FamilyBrief, FamilyVerdict, Judge } from './judge.ts';
import { JUDGE_SYSTEM } from './judgePrompt.ts';

/** Runs one blind grading turn and returns the model's raw text answer (the `.result`). */
export type CliRunner = (system: string, user: string) => Promise<string>;

export interface ClaudeCliJudgeOptions {
  /** The `claude` binary. Defaults to `claude` on PATH. */
  bin?: string;
  /** `--model`. Defaults to `CLAUDE_JUDGE_MODEL`, else the account's configured default. */
  model?: string;
  /** Inject the CLI call — lets the unit tests run without spawning a process. */
  run?: CliRunner;
}

/** Spawns `claude -p`, feeds the prompt on stdin, and returns the model's answer text. */
function spawnClaude(bin: string, model: string | undefined, system: string, user: string): Promise<string> {
  const args = ['-p', '--output-format', 'json', '--system-prompt', system];
  if (model) args.push('--model', model);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => reject(new Error(`could not run ${bin}: ${e.message}`)));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${bin} exited ${code}: ${err.trim() || out.trim()}`));
      // `--output-format json` wraps the answer in an envelope; the model's text is `.result`.
      let env: { is_error?: boolean; subtype?: string; result?: string };
      try {
        env = JSON.parse(out);
      } catch {
        return reject(new Error(`${bin} did not return JSON: ${out.slice(0, 200)}`));
      }
      if (env.is_error || env.subtype !== 'success' || typeof env.result !== 'string') {
        return reject(new Error(`${bin} run failed: ${env.subtype ?? 'unknown'}`));
      }
      resolve(env.result);
    });
    child.stdin.write(user);
    child.stdin.end();
  });
}

/** The model may wrap the JSON in prose or ```fences; take the outermost object. */
function extractJson(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('no JSON object in the model output');
  return raw.slice(start, end + 1);
}

export function claudeCliJudge(opts: ClaudeCliJudgeOptions = {}): Judge {
  const bin = opts.bin ?? 'claude';
  const model = opts.model ?? process.env.CLAUDE_JUDGE_MODEL;
  const run = opts.run ?? ((system, user) => spawnClaude(bin, model, system, user));

  return {
    async evaluate(brief: FamilyBrief): Promise<FamilyVerdict> {
      const raw = await run(JUDGE_SYSTEM, JSON.stringify(brief));
      try {
        return JSON.parse(extractJson(raw)) as FamilyVerdict;
      } catch (err) {
        throw new Error(`claude judge returned unparseable output on family ${brief.family}: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}
