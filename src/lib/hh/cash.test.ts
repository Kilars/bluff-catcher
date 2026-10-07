import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { readArchive } from './archive.ts';
import { detectVariant, parseHands } from './parse.ts';
import { heroHand } from './hero.ts';
import { renderPotsJson, type ReportMeta } from './report.ts';
import { summarise } from './stats.ts';

/**
 * Rush & Cash (6-max) parsing, against four real hands:
 *
 *   RC4834985843  a plain BTN fold — positions and cents-scaled blinds
 *   RC4834992904  a `Cash Drop to Pot` promo hand — the $5 drop must reconcile
 *   RC4834846895  a raked all-in ($0.01/$0.02) — pre-rake pot reconciles; net is post-rake
 *   RC4834989265  run-it-twice — both boards kept, the pot collected once per run
 *
 * Money is asserted in cents throughout: the whole point of the cents boundary
 * is that the exact-equality pot check survives decimal dollars.
 */
const SESSION = readFileSync('src/lib/hh/fixtures/rc/session.txt', 'utf8');
const parsed = parseHands(SESSION);
const byId = (id: string) => parsed.hands.find((h) => h.id === id)!;

describe('detectVariant', () => {
  it('reads the cash and tournament headers', () => {
    expect(detectVariant("Poker Hand #RC1: Hold'em No Limit ($0.25/$0.5) - 2026/09/27 16:44:53")).toBe('cash');
    expect(
      detectVariant(
        "Poker Hand #TM1: Tournament #310296737, Daily Special $2.50 Hold'em No Limit - Level7(175/350(45)) - 2026/09/08 20:03:09",
      ),
    ).toBe('mtt');
    expect(detectVariant('some other line')).toBeNull();
  });
});

describe('Rush & Cash parsing', () => {
  it('parses all four real hands, run-it-twice included', () => {
    expect(parsed.hands.map((h) => h.id)).toEqual([
      'RC4834985843',
      'RC4834992904',
      'RC4834846895',
      'RC4834989265',
    ]);
    expect(parsed.skipped).toEqual([]);
  });

  it('reads a run-it-twice flop all-in: first run as the board, both runs kept, the pot won twice', () => {
    const h = byId('RC4834989265');
    // The flop itself is a "FIRST FLOP", with the flop betting after it.
    expect(h.actions.filter((a) => a.player === 'Hero').map((a) => `${a.street}:${a.kind}`)).toEqual([
      'preflop:bb',
      'preflop:raise',
      'preflop:call',
      'flop:check',
      'flop:raise',
    ]);
    expect(h.board).toEqual(['9h', '7c', '9c', '2d', 'Jh']);
    expect(h.runs).toEqual([
      ['9h', '7c', '9c', '2d', 'Jh'],
      ['9h', '7c', '9c', '9d', 'Td'],
    ]);
    expect(h.streets).toEqual(['preflop', 'flop', 'turn', 'river']);
    expect(h.potMatches).toBe(true);
    // $49.75 collected once per run.
    expect(h.won).toEqual({ '890f76c2': 9950 });
  });

  it('leaves runs off a hand dealt once', () => {
    expect(byId('RC4834846895').runs).toBeUndefined();
  });

  it('every parsed hand is cash and reconciles in cents', () => {
    for (const h of parsed.hands) {
      expect(h.variant).toBe('cash');
      expect(h.tournamentId).toBe('');
      expect(h.level).toBe(0);
      expect(h.ante).toBe(0);
      expect(h.potMatches).toBe(true);
      expect(h.computedPot).toBe(h.totalPot);
    }
  });

  it('scales dollars to integer cents', () => {
    const h = byId('RC4834985843');
    expect(h.sb).toBe(25);
    expect(h.bb).toBe(50);
    expect(h.gameName).toBe("Hold'em No Limit ($0.25/$0.5)");
    expect(h.maxSeats).toBe(6);
    // $117.77 → 11777 cents; the button is Hero (seat #1).
    expect(h.seats.find((s) => s.name === 'Hero')?.chips).toBe(11777);
    expect(h.position.Hero).toBe('BTN');
  });

  it('reconciles the Cash Drop dead money into the pot', () => {
    const h = byId('RC4834992904');
    // $5 drop + blinds + bets = $9.50; without the drop the pot is $5 short.
    expect(h.totalPot).toBe(950);
    expect(h.computedPot).toBe(950);
    const hero = heroHand(h)!;
    expect(hero.position).toBe('SB');
    expect(hero.role).toBe('iso-raise');
  });

  it('books net off the post-rake collected, pot off the pre-rake total', () => {
    const h = byId('RC4834846895');
    expect(h.totalPot).toBe(406); // pre-rake = sum of bets
    const hero = heroHand(h)!;
    expect(hero.won).toBe(397); // collected, already net of $0.06 rake + $0.03 jackpot
    expect(hero.invested).toBe(200); // $2 stack, all in
    expect(hero.net).toBe(197);
    // $2 stack at a 2-cent big blind is exactly 100bb.
    expect(hero.stackBB).toBe(100);
    expect(hero.variant).toBe('cash');
  });
});

describe('cash in the archive and summary meta', () => {
  const MTT = readFileSync('src/lib/hh/fixtures/t310296737/day1.txt', 'utf8');

  it('counts no tournament for a cash-only archive or window', () => {
    // Cash hands carry tournamentId '' — not a tournament to count.
    const archive = readArchive([{ path: 'rc/session.txt', text: SESSION }]);
    expect(archive.meta.tournaments).toBe(0);
    expect(summarise(archive.hands).tournaments).toBe(0);
  });

  it('names the hand clock as the client\'s, not the file name\'s', () => {
    // Hand times are the GG client's local clock (UTC+2 in this archive); the
    // export file names run two hours behind (most likely UTC). "export-local"
    // could be read as the file name's clock.
    const archive = readArchive([{ path: 'rc/session.txt', text: SESSION }]);
    expect(archive.meta.timezone).toBe('GG client local clock (no zone printed; not the file-name clock)');
  });

  it('counts only the real tournaments when cash is mixed in', () => {
    const archive = readArchive([
      { path: 'rc/session.txt', text: SESSION },
      { path: 't310296737/day1.txt', text: MTT },
    ]);
    expect(archive.meta.tournaments).toBe(1);
    expect(summarise(archive.hands).tournaments).toBe(1);
  });

  it('reports no blind levels for cash, and the MTT span unchanged', () => {
    // Cash has no blind levels; [0, 0] was a sentinel a coach could quote as
    // "levels 0–0". Mixed windows span the tournament hands alone.
    const cash = readArchive([{ path: 'rc/session.txt', text: SESSION }]);
    const mtt = readArchive([{ path: 't310296737/day1.txt', text: MTT }]);
    const mixed = readArchive([
      { path: 'rc/session.txt', text: SESSION },
      { path: 't310296737/day1.txt', text: MTT },
    ]);
    expect(summarise(cash.hands).levels).toBeNull();
    expect(summarise([], 'cash').levels).toBeNull();
    expect(summarise(mtt.hands).levels).toEqual([5, 7]);
    expect(summarise(mixed.hands).levels).toEqual([5, 7]);
    expect(summarise([]).levels).toEqual([0, 0]);
  });

  it('grades an empty cash window as cash', () => {
    // `--variant cash` with a window that selects nothing still asked for cash;
    // reporting the MTT frame and bands was a lie about what was graded.
    const s = summarise([], 'cash');
    expect(s.variant).toBe('cash');
    expect(s.stats.find((x) => x.key === 'vpip')?.band).toEqual([21, 28]);
    expect(summarise([]).variant).toBe('mtt');
  });
});

describe('--mode pots decisions', () => {
  const text = readFileSync('src/lib/hh/fixtures/rc/short-calls.txt', 'utf8');
  const hands = parseHands(text).hands.map((h) => heroHand(h)!);
  const meta = { archive: {}, window: {} } as unknown as ReportMeta;
  const pot = renderPotsJson(hands, meta).pots.find((p) => p.id === 'RC4834985541')!;

  it('states amounts in big blinds, not raw cents labelled chips', () => {
    // $149.29 before the call at $0.50 a big blind.
    const call = pot.decisions.find((d) => d.action === 'call')!;
    expect(call).toMatchObject({ potBB: 298.6, toCallBB: 69.5, amountBB: 69.5 });
    for (const d of pot.decisions) {
      expect(Object.keys(d)).not.toContain('chips');
      expect(Object.keys(d)).not.toContain('potBefore');
    }
  });

  it('prices only calls, against the pot Hero can win', () => {
    const call = pot.decisions.find((d) => d.action === 'call')!;
    expect(call.equityNeeded).toBe(29);
    for (const d of pot.decisions.filter((x) => x.action !== 'call')) {
      expect(d.equityNeeded, `${d.street} ${d.action}`).toBeNull();
    }
  });
});
