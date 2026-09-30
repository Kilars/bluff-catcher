import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { detectVariant, parseHands } from './parse.ts';
import { heroHand } from './hero.ts';

/**
 * Rush & Cash (6-max) parsing, against four real hands:
 *
 *   RC4834985843  a plain BTN fold — positions and cents-scaled blinds
 *   RC4834992904  a `Cash Drop to Pot` promo hand — the $5 drop must reconcile
 *   RC4834846895  a raked all-in ($0.01/$0.02) — pre-rake pot reconciles; net is post-rake
 *   RC4834989265  run-it-twice — must be skipped, not mis-parsed
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
  it('parses the three real hands and skips run-it-twice', () => {
    expect(parsed.hands.map((h) => h.id)).toEqual([
      'RC4834985843',
      'RC4834992904',
      'RC4834846895',
    ]);
    expect(parsed.skipped).toEqual([
      expect.objectContaining({ reason: 'run-it-twice not supported' }),
    ]);
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
