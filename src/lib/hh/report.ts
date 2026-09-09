/**
 * Renders a Summary as plain text for the terminal, and as a compact JSON
 * object suitable for handing to a coach (human or model) as grounding.
 */

import type { HeroHand } from './hero.ts';
import type { Flag, Stat, Summary } from './stats.ts';

const MARK: Record<string, string> = {
  bleed: 'BLEED',
  missed: 'MISSED',
};

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

export function renderText(s: Summary, meta: { game: string; date: string }): string {
  const out: string[] = [];
  const flags = s.stats.filter((x) => x.flag);
  const bleeds = flags.filter((x) => x.flag === 'bleed');
  const missed = flags.filter((x) => x.flag === 'missed');

  out.push('BLUFF-CATCHER · LEAK REPORT');
  out.push(
    `${s.hands} hands · ${meta.game} · levels ${s.levels[0]}–${s.levels[1]} · ${meta.date}`,
  );
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

/** The same numbers, shaped for a coaching prompt rather than a terminal. */
export function renderJson(s: Summary, meta: { game: string; date: string }) {
  return {
    meta: { ...meta, hands: s.hands, levels: s.levels },
    chipFlow: {
      netChips: s.netChips,
      netBB: Number(s.netBB.toFixed(2)),
      showdownBB: Number(s.showdownBB.toFixed(2)),
      nonShowdownBB: Number(s.nonShowdownBB.toFixed(2)),
      investedBB: Number(s.investedBB.toFixed(2)),
    },
    stats: s.stats.map((x) => ({
      key: x.key,
      label: x.label,
      made: x.made,
      opportunities: x.opp,
      pct: x.pct === null ? null : Number(x.pct.toFixed(1)),
      band: x.band,
      verdict: x.verdict,
      flag: x.flag as Flag,
    })),
    byRole: s.byRole.map((r) => ({ ...r, netBB: Number(r.netBB.toFixed(2)) })),
    worstPots: s.worstPots.map(handDetail),
    biggestCalls: s.biggestCalls.map((c) => ({
      id: c.hand.id,
      street: c.street,
      costBB: Number((c.toCall / c.hand.bb).toFixed(2)),
      equityNeeded: Number((c.potOdds * 100).toFixed(1)),
      cards: c.hand.cards,
      board: c.hand.board,
    })),
  };
}

function handDetail(h: HeroHand) {
  return {
    id: h.id,
    position: h.position,
    cards: h.cards,
    board: h.board,
    stackBB: Number(h.stackBB.toFixed(1)),
    role: h.role,
    pfa: h.pfa,
    streetReached: h.streetReached,
    showdown: h.showdown,
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
