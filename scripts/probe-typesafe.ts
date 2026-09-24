/**
 * THROWAWAY probe — delete when it has answered its question.
 *
 * Does a *typed-decision* model (Jev / TypeSafe AI) hold up against a cheap
 * *LLM-with-structured-output* (Gemini free tier) when both are fed the SAME
 * pre-conditioned poker facts? This is the 20-spot test from the design chat.
 *
 * What it feeds them: one already-enriched `LabelledDecision` per spot — Hero's
 * cards, the truncated board, hand class, texture, SPR, position, depth, and
 * the deterministic facts. No result, no villain cards: the payload is already
 * blind (PLAN-coach.md §1.5), so the probe inherits that for free.
 *
 * What it asks (Jev's three primitives; Gemini gets the mirror schema):
 *   label      choice — which of the 9 labels names Hero's action  [HAS ground truth]
 *   deviation  score  — how far from GTO (the "furthest from GTO" sort key)
 *   mistake    noul   — is this a clear error worth coaching (0..1)
 *   sizing     score  — is the bet/raise size right   [only when Hero chose a size]
 *
 * The ONLY hard metric is `label`: the code already assigned labels
 * deterministically, so agreement = model's pick is one of them. `deviation`,
 * `mistake` and `sizing` have no ground truth here — they are eyeballed and
 * cross-checked between the two models. Calibration is NOT tested (that needs
 * hand-graded verdicts; see the note the script prints at the end).
 *
 * Run (both keys optional — pass --only to run one; Jev has $5 free credit,
 * Gemini Flash is free with no card):
 *
 *   TYPESAFE_API_KEY=sk-... GEMINI_API_KEY=... \
 *     node --experimental-strip-types scripts/probe-typesafe.ts \
 *       [paths] [--n 20] [--from YYYY-MM-DD] [--to YYYY-MM-DD] \
 *       [--label NAME] [--only jev|gemini]
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { readArchive, selectWindow, type ArchiveFile } from '../src/lib/hh/archive.ts';
import { LABELS, labelledDecisions, type LabelledDecision } from '../src/lib/hh/labels.ts';

// ── the rubrics both models see, kept identical for a fair comparison ─────────

const DEVIATION_LEVELS = [
  'on strategy',
  'minor deviation from GTO',
  'clear deviation from GTO',
  'punt / large blunder',
] as const;

const SIZING_LEVELS = [
  'much too small',
  'somewhat too small',
  'about right',
  'somewhat too large',
  'much too large',
] as const;

/** One line per label, straight from the predicates in labels.ts. */
const LABEL_CRITERIA: Record<string, string> = {
  'pfa-check-flop': 'The preflop raiser checked the flop (and it was not a check-raise).',
  'check-draw': 'Checked while holding a strong draw (8+ outs).',
  'donk-bet': 'As the caller (not the preflop raiser), led into the aggressor on the flop.',
  'check-raise-flop': 'As the caller, check-raised the flop.',
  'overbet-strong': 'Bet or raised larger than the pot while holding a strong made hand.',
  'river-bluff-with-blocker':
    'River bet with no showdown value (air), holding a board-relevant blocker.',
  'river-bluff-no-blocker': 'River bet with no showdown value (air) and no blocker.',
  'river-call-marginal': 'Called a river bet with a marginal made hand.',
  'river-check-value': 'Checked the river through with a made hand (possible missed value).',
  none: 'None of the labels fit this action.',
};

// ── args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags: Record<string, string> = {};
const targets: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) flags[a.slice(2)] = args[++i] ?? '';
  else targets.push(a);
}
const n = Number(flags.n ?? '20');
const from = flags.from ?? null;
const to = flags.to ?? null;
const onlyLabel = flags.label ?? null;
const only = flags.only ?? null; // 'jev' | 'gemini' | null
const paths = targets.length ? targets : ['hands'];

const JEV_KEY = process.env.TYPESAFE_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const runJev = only !== 'gemini' && !!JEV_KEY;
const runGemini = only !== 'jev' && !!GEMINI_KEY;
if (!runJev && !runGemini) {
  console.error(
    'no model to run: set TYPESAFE_API_KEY and/or GEMINI_API_KEY (and pass --only to pin one)',
  );
  process.exit(1);
}

// ── read the archive exactly the way leaks.ts does ───────────────────────────

function collect(target: string): string[] {
  if (!existsSync(target)) {
    console.error(`no such path: ${target}`);
    process.exit(1);
  }
  if (statSync(target).isFile()) return [target];
  return readdirSync(target, { withFileTypes: true }).flatMap((e) => {
    const p = join(target, e.name);
    if (e.isDirectory()) return collect(p);
    return e.name.toLowerCase().endsWith('.txt') ? [p] : [];
  });
}

const files = paths.flatMap(collect);
const archive = readArchive(files.map((path): ArchiveFile => ({ path, text: readFileSync(path, 'utf8') })));
const { hands } = selectWindow(archive.hands, from, to);

let spots = hands.flatMap(labelledDecisions);
if (onlyLabel) {
  if (!(LABELS as readonly string[]).includes(onlyLabel)) {
    console.error(`unknown label: ${onlyLabel}\nknown: ${LABELS.join(', ')}`);
    process.exit(1);
  }
  spots = spots.filter((s) => s.labels.includes(onlyLabel));
}

// Round-robin by first label so 20 spots span the taxonomy instead of being 20
// of whatever is commonest.
const byLabel = new Map<string, LabelledDecision[]>();
for (const s of spots) byLabel.set(s.labels[0], [...(byLabel.get(s.labels[0]) ?? []), s]);
const queues = [...byLabel.values()];
const picked: LabelledDecision[] = [];
for (let round = 0; picked.length < Math.min(n, spots.length); round++) {
  for (const q of queues) if (q[round] && picked.length < n) picked.push(q[round]);
  if (queues.every((q) => q.length <= round + 1)) break;
}

if (picked.length === 0) {
  console.error('no labelled decisions in this window — nothing to probe');
  process.exit(1);
}

// ── the pre-conditioned state fed to both models ─────────────────────────────

function stateOf(d: LabelledDecision) {
  return {
    street: d.street,
    heroAction: d.kind,
    position: d.position,
    stackDepthBB: d.stackBB,
    depthBucket: d.depth,
    spr: d.spr,
    heroWasPreflopRaiser: d.pfa,
    facingABet: d.facedBet,
    betSizeAsPotFraction: d.sizing, // null when Hero chose no size (check/call/fold)
    allIn: d.allIn,
    handClass: d.handClass,
    boardTexture: d.boardType,
    holeCards: d.cards.join(' '),
    board: d.board.join(' '),
    boardRelevantBlockers: d.removals.map((r) => `${r.card}: ${r.removes}`),
  };
}

// ── Jev: POST https://api.typesafe.ai/v1/systemone ───────────────────────────

async function askJev(d: LabelledDecision) {
  const questions: Record<string, unknown> = {
    label: {
      type: 'choice',
      instructions: 'Which single label best names what Hero did? Choose "none" only if nothing fits.',
      criteria: LABEL_CRITERIA,
    },
    deviation: {
      type: 'score',
      instructions: 'How far is Hero’s action from a solid GTO strategy in this spot?',
      criteria: [...DEVIATION_LEVELS],
    },
    mistake: {
      type: 'noul',
      instructions: 'Is Hero’s action a clear strategic error worth coaching (vs a standard/defensible play)?',
      criteria: { true: 'a clear error', false: 'standard or defensible' },
    },
  };
  if (d.sizing !== null) {
    questions.sizing = {
      type: 'score',
      instructions: `Hero's bet/raise was ${(d.sizing * 100).toFixed(0)}% of the pot. Is that sizing right here?`,
      criteria: [...SIZING_LEVELS],
    };
  }
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${JEV_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-latest', state: stateOf(d), questions }),
  });
  if (!res.ok) throw new Error(`Jev ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { answers: Record<string, any> };
  const a = body.answers;
  return {
    label: a.label?.choice as string,
    labelConf: a.label?.confidence as number,
    deviation: a.deviation?.score as number,
    mistake: a.mistake?.noul as number,
    sizing: a.sizing?.score as number | undefined,
  };
}

// ── Gemini: structured output via responseSchema (the mirror of Jev) ─────────

function geminiSchema(withSizing: boolean) {
  const props: Record<string, unknown> = {
    label: { type: 'STRING', enum: [...LABELS, 'none'] },
    deviation: { type: 'STRING', enum: [...DEVIATION_LEVELS] },
    mistakeProbability: { type: 'NUMBER' },
  };
  if (withSizing) props.sizing = { type: 'STRING', enum: [...SIZING_LEVELS] };
  return { type: 'OBJECT', properties: props, required: Object.keys(props) };
}

async function askGemini(d: LabelledDecision) {
  const defs = Object.entries(LABEL_CRITERIA)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');
  const prompt =
    'You are a poker coach grading one Hero decision from pre-computed facts. ' +
    'Do not recompute anything; judge from the fields given.\n\n' +
    `Labels:\n${defs}\n\n` +
    `deviation = how far from GTO, one of: ${DEVIATION_LEVELS.join(' | ')}\n` +
    `mistakeProbability = 0..1, chance this is a clear error worth coaching\n` +
    (d.sizing !== null ? `sizing = is the bet size right, one of: ${SIZING_LEVELS.join(' | ')}\n` : '') +
    `\nSPOT:\n${JSON.stringify(stateOf(d), null, 2)}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': GEMINI_KEY as string, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: geminiSchema(d.sizing !== null) },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as any;
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const out = JSON.parse(text) as {
    label: string;
    deviation: string;
    mistakeProbability: number;
    sizing?: string;
  };
  return out;
}

// ── run ──────────────────────────────────────────────────────────────────────

const pad = (s: string, w: number) => (s + ' '.repeat(w)).slice(0, w);

let jevHit = 0;
let gemHit = 0;
let labelMatch = 0;
let scored = 0;

console.log(
  `\nProbing ${picked.length} spot(s) from ${archive.meta.hands} hands` +
    `${from || to ? ` [${from ?? '…'} → ${to ?? '…'}]` : ''}` +
    `  (Jev: ${runJev ? 'on' : 'off'}, Gemini ${GEMINI_MODEL}: ${runGemini ? 'on' : 'off'})\n`,
);
console.log(
  pad('id', 10) +
    pad('street', 7) +
    pad('gold labels', 26) +
    pad('jev', 26) +
    pad('gemini', 26),
);
console.log('-'.repeat(95));

for (const d of picked) {
  const gold = d.labels;
  let jev: Awaited<ReturnType<typeof askJev>> | null = null;
  let gem: Awaited<ReturnType<typeof askGemini>> | null = null;
  try {
    [jev, gem] = await Promise.all([
      runJev ? askJev(d) : Promise.resolve(null),
      runGemini ? askGemini(d) : Promise.resolve(null),
    ]);
  } catch (e) {
    console.log(pad(d.id.slice(-8), 10) + `ERROR: ${(e as Error).message}`);
    continue;
  }

  scored++;
  if (jev && gold.includes(jev.label)) jevHit++;
  if (gem && gold.includes(gem.label)) gemHit++;
  if (jev && gem && jev.label === gem.label) labelMatch++;

  const jevCell = jev
    ? `${jev.label}${gold.includes(jev.label) ? '✓' : '✗'} d=${jev.deviation?.toFixed(1)} m=${jev.mistake?.toFixed(2)}${jev.sizing !== undefined ? ` sz=${jev.sizing.toFixed(1)}` : ''}`
    : '—';
  const gemCell = gem
    ? `${gem.label}${gold.includes(gem.label) ? '✓' : '✗'} d=${gem.deviation?.slice(0, 5)} m=${gem.mistakeProbability?.toFixed(2)}${gem.sizing ? ` sz=${gem.sizing.slice(0, 5)}` : ''}`
    : '—';

  console.log(
    pad(d.id.slice(-8), 10) +
      pad(d.street, 7) +
      pad(gold.join(','), 26) +
      pad(jevCell, 26) +
      pad(gemCell, 26),
  );
}

// ── verdict ──────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`spots scored:            ${scored}`);
if (runJev) console.log(`Jev label agreement:     ${jevHit}/${scored} (${((100 * jevHit) / scored).toFixed(0)}%)`);
if (runGemini) console.log(`Gemini label agreement:  ${gemHit}/${scored} (${((100 * gemHit) / scored).toFixed(0)}%)`);
if (runJev && runGemini)
  console.log(`Jev↔Gemini same label:   ${labelMatch}/${scored} (${((100 * labelMatch) / scored).toFixed(0)}%)`);
console.log('='.repeat(60));
console.log(
  'Reading it: label ✓/✗ is the only hard metric — did the model recover a\n' +
    'label the code already proved true from the digested facts. d= deviation\n' +
    '(furthest-from-GTO sort key), m= mistake prob, sz= sizing verdict have no\n' +
    'ground truth here; compare the two columns and sanity-check by eye.\n\n' +
    'NOT tested: calibration. To test it, hand-grade ~30 spots as error/ok and\n' +
    'check whether m sorts them — that is the follow-up if the labels agree.',
);
