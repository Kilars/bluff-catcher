/**
 * Renders a Summary as plain text for the terminal, and as a compact JSON
 * object suitable for handing to a coach (human or model) as grounding.
 *
 * Two rules the JSON side exists to enforce:
 *
 *   - **Only `meta.window` may be described.** `meta.archive` is there so the
 *     coach knows how small a slice it is looking at, not so it can talk about
 *     hands it was not given.
 *   - **The board stops where Hero did.** `board` on a parsed hand is all five
 *     cards, including the ones dealt after Hero folded. Handing those over
 *     invites a read of a runout Hero never saw.
 *
 * Villain hole cards (`shows[]`) are not in any payload here, and must not be.
 */

import type { ArchiveMeta, WindowMeta } from './archive.ts';
import { BOARD_SEEN } from './board.ts';
import type { HeroHand } from './hero.ts';
import type { LabelGroup, LabelledDecision } from './labels.ts';
import type { RfiFold } from './rfi.ts';
import { SPLIT_CAVEAT, type Flag, type Stat, type Summary } from './stats.ts';

export interface ReportMeta {
  archive: ArchiveMeta;
  window: WindowMeta;
}

const MARK: Record<string, string> = {
  bleed: 'BLEED',
  missed: 'MISSED',
};

function boardSeen(h: HeroHand): string[] {
  return h.board.slice(0, BOARD_SEEN[h.streetReached]);
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function padLeft(s: string, w: number): string {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

function chips(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function bb(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;
}

function pct(p: number | null): string {
  return p === null ? '—' : `${p.toFixed(1)}%`;
}

function statLine(s: Stat): string {
  const frac = `${s.made}/${s.opp}`;
  const band = s.band ? `${s.band[0]}–${s.band[1]}%` : '';
  const verdict =
    s.verdict === 'thin'
      ? 'thin sample'
      : s.flag
        ? MARK[s.flag]
        : s.verdict === 'ok'
          ? 'ok'
          : '';
  return `  ${pad(s.label, 24)}${padLeft(frac, 8)}${padLeft(pct(s.pct), 9)}   ${pad(band, 9)}${verdict}`;
}

function handLine(h: HeroHand): string {
  const cards = h.cards ? h.cards.join(' ') : '??';
  return `  ${pad(h.id, 15)}${pad(h.position, 5)}${pad(cards, 7)}${padLeft(bb(h.netBB), 8)} bb   ${pad(h.role, 13)}${h.streetReached}${h.showdown ? ' · showdown' : ''}`;
}

/** The two spans, always both, always labelled. */
function headerLines(m: ReportMeta): string[] {
  const w = m.window;
  const span = w.first ? `${w.first} → ${w.last}` : 'no hands';
  const asked =
    w.requestedFrom || w.requestedTo
      ? `  (asked for ${w.requestedFrom ?? '…'} → ${w.requestedTo ?? '…'})`
      : '';
  return [
    `window   ${w.hands} hands · ${span}${asked}`,
    `archive  ${m.archive.hands} hands in ${m.archive.files} file(s) · ${m.archive.first ?? '—'} → ${m.archive.last ?? '—'} · ${m.archive.excluded} excluded · dates are ${m.archive.timezone}`,
    `games    ${m.archive.games.join(', ') || '—'}`,
  ];
}

export function renderText(
  s: Summary,
  meta: ReportMeta,
  folds: RfiFold[],
  groups: LabelGroup[],
): string {
  const out: string[] = [];
  const flags = s.stats.filter((x) => x.flag);
  const bleeds = flags.filter((x) => x.flag === 'bleed');
  const missed = flags.filter((x) => x.flag === 'missed');

  out.push('BLUFF-CATCHER · LEAK REPORT');
  out.push(...headerLines(meta));

  // Every stat below would read 0/0 and every span 0–0. A table of dashes looks
  // like a finding; one sentence does not.
  if (!s.hands) {
    out.push('', 'The window selected no hands. Widen --from / --to.');
    return out.join('\n');
  }

  out.push(`levels ${s.levels[0]}–${s.levels[1]} · ${s.tournaments} tournament(s) in window`);
  out.push('');

  // Labels and chart folds lead. They name what Hero did. Everything below
  // is how often or how much, which is context rather than the point --
  // leading with the percentages taught the reader to start there.
  out.push('LABELLED DECISIONS  (what happened, not whether it was right)');
  if (!groups.length) out.push('  no postflop decision in this window carried a label.');
  for (const g of groups) {
    const shared = Object.entries(g.shared).map(([k, v]) => `${k}=${v}`).join(' · ');
    out.push(`  ${pad(g.label, 26)}${padLeft(String(g.decisions.length), 4)}   ${shared || 'nothing in common'}`);
    for (const d of everyNth(g.decisions, strideFor(g.decisions))) {
      out.push(`  ${' '.repeat(15)}${pad(d.id, 15)}${pad(d.street, 7)}${d.cards.join(' ')} on ${d.board.join(' ')}`);
    }
  }
  out.push('');

  out.push('CHART FOLDS  (first in, and the chart plays it)');
  if (!folds.length) out.push('  none: every first-in fold was outside the chart, or too close to call.');
  for (const f of folds) {
    out.push(
      `  ${pad(f.id, 15)}${pad(f.position, 5)}${pad(f.cards.join(' '), 7)}${pad(`(${f.hand})`, 6)}${padLeft(`${f.stackBB}bb`, 7)}   the ${f.depth} chart makes this ${f.action}`,
    );
    if (f.caveat) out.push(`  ${' '.repeat(15)}↳ ${f.caveat}`);
  }
  out.push('');

  out.push('CHIP FLOW');
  out.push(`  ${pad('Net', 24)}${padLeft(chips(s.netChips), 12)}${padLeft(bb(s.netBB), 10)} bb`);
  out.push(`  ${pad('  at showdown', 24)}${padLeft('', 12)}${padLeft(bb(s.showdownBB), 10)} bb`);
  out.push(
    `  ${pad('  without showdown', 24)}${padLeft('', 12)}${padLeft(bb(s.nonShowdownBB), 10)} bb`,
  );
  out.push(`  ${pad('Chips put in', 24)}${padLeft('', 12)}${padLeft(s.investedBB.toFixed(1), 10)} bb`);
  out.push('');

  let group = '';
  for (const st of s.stats) {
    if (st.group !== group) {
      group = st.group;
      out.push(group.toUpperCase());
      out.push(
        `  ${pad('', 24)}${padLeft('n', 8)}${padLeft('', 9)}   ${pad('band', 9)}`,
      );
    }
    out.push(statLine(st));
    if (st.note && st.flag) out.push(`  ${' '.repeat(24)}↳ ${st.note}`);
  }
  out.push('');

  out.push('BY FLOP TEXTURE');
  out.push(`  ${SPLIT_CAVEAT}`);
  if (!s.byBoard.length) out.push('  no postflop spots in this window.');
  for (const b of s.byBoard) {
    out.push(
      `  ${pad(b.key, 18)}${pad(b.board, 18)}${padLeft(`${b.made}/${b.opp}`, 7)}${padLeft(`${b.pct.toFixed(1)}%`, 9)}`,
    );
  }
  out.push('');

  out.push('WHERE IT GOES / WHAT IS MISSING');
  if (!flags.length) out.push('  nothing outside its band on this sample.');
  for (const f of bleeds) out.push(`  BLEED   ${f.label} at ${pct(f.pct)} (band ${f.band?.[0]}–${f.band?.[1]}%)`);
  for (const f of missed) out.push(`  MISSED  ${f.label} at ${pct(f.pct)} (band ${f.band?.[0]}–${f.band?.[1]}%)`);
  out.push('');

  out.push('NET BY HOW HERO ENTERED');
  out.push(`  ${pad('', 24)}${padLeft('hands', 8)}${padLeft('net bb', 10)}`);
  for (const r of s.byRole) {
    out.push(`  ${pad(r.role, 24)}${padLeft(String(r.hands), 8)}${padLeft(bb(r.netBB), 10)}`);
  }
  out.push('');

  out.push('WORST POTS');
  for (const h of s.worstPots) out.push(handLine(h));
  out.push('');

  out.push('BIGGEST CALLS  (what the pot was laying vs what it cost)');
  for (const c of s.biggestCalls) {
    const need = (c.potOdds * 100).toFixed(0);
    out.push(
      `  ${pad(c.hand.id, 15)}${pad(c.street, 8)}${padLeft(`${(c.toCall / c.hand.bb).toFixed(1)} bb`, 9)}   needed ${need}% equity   ${c.hand.cards?.join(' ') ?? '??'}`,
    );
  }

  return out.join('\n');
}

/**
 * Stats that answer "did it work" rather than "what did you do". They are in
 * the text report, which a human reads, and never in the payload.
 */
const RESULT_STATS = new Set(['wwsf', 'wtsd', 'wsd']);

/**
 * The payload the coaching agent reads. **Blind to results by construction.**
 *
 * An agent that can see what a hand returned will coach the hands that lost,
 * and the hands that lost are not the hands that were played badly — a cooler
 * played perfectly loses a stack, and a dreadful fold costs nothing and leaves
 * no trace. So the money never reaches here: no chip flow, no net by role, no
 * loss-ranked pot list, no won-when/won-at-showdown, and `board` stops where
 * Hero stopped.
 *
 * This is why there is no `--mode blind`: the main path *is* blind, and
 * `--mode pots` is the one place results are deliberately visible, for a human
 * asking where the chips went.
 *
 * **Hands reach the agent because they carry a label.** That is the selector,
 * and it is the reason the money could be deleted rather than filtered: every
 * other hand-picker here ranked by chips, so a payload without them had nothing
 * per-hand but `rfiFolds`. A label is a fact about a decision — what the hand
 * was, what the board was, what Hero did and how big — and it is knowable
 * before the next card comes, which is exactly what "blind to results" means.
 */
export function renderJson(
  s: Summary,
  meta: ReportMeta,
  folds: RfiFold[],
  groups: LabelGroup[],
) {
  return {
    // Ordered as it should be read. `labels` is why any hand is in the
    // payload; `stats` is context and goes last so it is not mistaken for
    // the finding.
    meta: { ...meta, levels: s.levels, tournaments: s.tournaments },
    labels: groups.map((g) => {
      const stride = strideFor(g.decisions);
      return {
        label: g.label,
        shared: g.shared,
        // The count is here so a sampled group is not mistaken for a whole one.
        // It is not a rate and there is no denominator to make it one: `shared`
        // is the finding, per docs/leak-coaching.md §2.
        instances: g.decisions.length,
        stride,
        decisions: everyNth(g.decisions, stride).map(decisionDetail),
      };
    }),
    // How Hero entered, without what it returned: the distribution is a fact
    // about play, the net is a fact about luck.
    rfiFolds: folds,
    byBoard: {
      caveat: SPLIT_CAVEAT,
      splits: s.byBoard.map((b) => ({
        key: b.key,
        board: b.board,
        made: b.made,
        opportunities: b.opp,
        pct: Number(b.pct.toFixed(1)),
      })),
    },
    byRole: s.byRole.map((r) => ({ role: r.role, hands: r.hands })),
    stats: s.stats
      .filter((x) => !RESULT_STATS.has(x.key))
      .map((x) => ({
        key: x.key,
        label: x.label,
        made: x.made,
        opportunities: x.opp,
        pct: x.pct === null ? null : Number(x.pct.toFixed(1)),
        band: x.band,
        verdict: x.verdict,
        flag: x.flag as Flag,
      })),
  };
}

/**
 * At ~500 hands a label can easily carry a hundred instances, and dumping all
 * of them would make the payload mostly repetition of one spot.
 *
 * So a group ships at most `PER_LABEL` of them, chosen by **stride in archive
 * order** — every ⌈n/N⌉-th, with the stride in the payload so the agent knows
 * it is reading a sample. Archive order and nothing else: any interesting
 * ranking would be a ranking by money, which is the thing this payload exists
 * to not have, and "the biggest" or "the worst" are the same trap wearing a
 * different name. A stride also spreads the sample across the whole window
 * rather than stacking it on one session, which the first N would not.
 *
 * `shared` is computed over *every* instance in labels.ts, not over the sample,
 * so truncation can never invent agreement that the full group does not have.
 */
const PER_LABEL = 5;

function strideFor(ds: unknown[]): number {
  return Math.ceil(ds.length / PER_LABEL);
}

function everyNth<T>(xs: T[], stride: number): T[] {
  return xs.filter((_, i) => i % stride === 0);
}

/**
 * One labelled decision, with enough context for a model to argue about it:
 * where Hero sat, how deep, what the pot was worth relative to the stack, what
 * the hand and the board were, and what it cost as a fraction of the pot.
 *
 * `sizing` is null for a fold, a check, a call and an all-in — nothing was
 * chosen — and `allIn` tells the last of those apart from the rest.
 */
function decisionDetail(d: LabelledDecision) {
  return {
    id: d.id,
    street: d.street,
    action: d.kind,
    position: d.position,
    stackBB: Number(d.stackBB.toFixed(1)),
    depth: d.depth,
    spr: d.spr === null ? null : Number(d.spr.toFixed(1)),
    sizing: d.sizing === null ? null : Number(d.sizing.toFixed(2)),
    allIn: d.allIn,
    pfa: d.pfa,
    facedBet: d.facedBet,
    cards: d.cards,
    board: d.board,
    handClass: d.handClass,
    boardType: d.boardType,
    removals: d.removals,
    labels: d.labels,
  };
}

/**
 * `--mode pots`: the biggest pots Hero contested, by what they cost to play —
 * not by what they returned. Money is visible here; that is the whole mode.
 */
const POTS_LIMIT = 20;

export function topPots(hands: HeroHand[]): HeroHand[] {
  return [...hands].sort((a, b) => b.grossBB - a.grossBB).slice(0, POTS_LIMIT);
}

export function renderPotsText(hands: HeroHand[], meta: ReportMeta): string {
  const out: string[] = ['BLUFF-CATCHER · BIGGEST POTS', ...headerLines(meta), ''];
  out.push(`  ${pad('hand', 15)}${pad('pos', 5)}${pad('cards', 7)}${padLeft('in', 8)}${padLeft('net', 9)}   line`);

  for (const h of topPots(hands)) {
    const cards = h.cards ? h.cards.join(' ') : '??';
    const board = boardSeen(h).join(' ');
    out.push(
      `  ${pad(h.id, 15)}${pad(h.position, 5)}${pad(cards, 7)}${padLeft(`${h.grossBB.toFixed(1)}bb`, 8)}${padLeft(`${bb(h.netBB)}bb`, 9)}   ${pad(h.role, 13)}${h.streetReached}${board ? ` · ${board}` : ''}`,
    );
  }

  return out.join('\n');
}

export function renderPotsJson(hands: HeroHand[], meta: ReportMeta) {
  return { meta, pots: topPots(hands).map(handDetail) };
}

function handDetail(h: HeroHand) {
  return {
    id: h.id,
    position: h.position,
    cards: h.cards,
    board: boardSeen(h),
    stackBB: Number(h.stackBB.toFixed(1)),
    role: h.role,
    pfa: h.pfa,
    streetReached: h.streetReached,
    showdown: h.showdown,
    grossBB: Number(h.grossBB.toFixed(2)),
    netBB: Number(h.netBB.toFixed(2)),
    decisions: h.decisions.map((a) => ({
      street: a.street,
      action: a.kind,
      chips: a.amount,
      potBefore: a.potBefore,
      toCall: a.toCall,
      equityNeeded:
        a.toCall > 0 ? Number(((a.toCall / (a.potBefore + a.toCall)) * 100).toFixed(1)) : null,
    })),
  };
}
