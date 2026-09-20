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
import type { HeroHand } from './hero.ts';
import type { Street } from './parse.ts';
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

/** How much of the board Hero had actually seen when they last acted. */
const BOARD_SEEN: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

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

export function renderText(s: Summary, meta: ReportMeta, folds: RfiFold[]): string {
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

  out.push('CHART FOLDS  (first in, and the chart plays it)');
  if (!folds.length) out.push('  none: every first-in fold was outside the chart, or too close to call.');
  for (const f of folds) {
    out.push(
      `  ${pad(f.id, 15)}${pad(f.position, 5)}${pad(f.cards.join(' '), 7)}${pad(`(${f.hand})`, 6)}${padLeft(`${f.stackBB}bb`, 7)}   the ${f.depth} chart makes this ${f.action}`,
    );
    if (f.caveat) out.push(`  ${' '.repeat(15)}↳ ${f.caveat}`);
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
 * asking where the chips went. Nothing selects hands by money any more, which
 * leaves `rfiFolds` as the only hand-level finding — the honest state of the
 * harness until labelling lands.
 */
export function renderJson(s: Summary, meta: ReportMeta, folds: RfiFold[]) {
  return {
    meta: { ...meta, levels: s.levels, tournaments: s.tournaments },
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
    rfiFolds: folds,
    // How Hero entered, without what it returned: the distribution is a fact
    // about play, the net is a fact about luck.
    byRole: s.byRole.map((r) => ({ role: r.role, hands: r.hands })),
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
