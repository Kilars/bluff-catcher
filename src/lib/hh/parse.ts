/**
 * Parser for GGPoker hand-history text exports (tournament format).
 *
 * Pure — takes file text, returns structured hands. No Node APIs and no DOM, so
 * the same code runs in the `npm run leaks` CLI and, later, in the browser.
 *
 * ── Format notes, verified against a 44-hand MTT export ─────────────────────
 *
 *  - Every amount is comma-grouped: "raises 525 to 875", "(18,094 in chips)".
 *
 *  - "X: raises A to B" — A is the raise size *over the previous bet level*,
 *    NOT the chips X puts in. Chips added = B minus what X already committed
 *    this street. Getting this backwards silently inflates every pot, which is
 *    why `parseHands` recomputes each pot and compares it to the printed
 *    "Total pot" line (see `Hand.potMatches`).
 *
 *  - "calls A" / "bets A" / "posts ... A" are all plain increments.
 *
 *  - Only Hero's hole cards are face-up; other "Dealt to" lines end in a space
 *    with no bracket. Hero is auto-detected from that, so a renamed hero works.
 *
 *  - "*** SHOWDOWN ***" is printed on every hand, including ones that end to a
 *    fold — it marks the pot award, not a showdown. Use the `shows` lines to
 *    tell whether cards were actually turned over.
 *
 *  - Antes are posted before the blinds and do not count toward the street's
 *    bet level, so they never affect what a player has to call.
 */

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;

export type ActionKind =
  | 'ante'
  | 'sb'
  | 'bb'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise';

/** A single logged action, enriched with the pot context it happened in. */
export interface Action {
  street: Street;
  player: string;
  kind: ActionKind;
  /** Chips this action actually adds to the pot (0 for fold/check). */
  amount: number;
  /** Raises only: the street commitment the raise brings the player to. */
  to?: number;
  /** Raises only: the printed increment over the previous bet level. */
  raiseBy?: number;
  allIn: boolean;
  /** Pot total before this action resolves. */
  potBefore: number;
  /** Chips the player had to put in to continue (0 when checking was free). */
  toCall: number;
  /** The player's remaining stack before acting. */
  stackBefore: number;
}

export interface Seat {
  seat: number;
  name: string;
  chips: number;
}

export interface Shown {
  player: string;
  cards: string[];
  desc?: string;
}

export interface Hand {
  id: string;
  tournamentId: string;
  gameName: string;
  level: number;
  sb: number;
  bb: number;
  ante: number;
  timestamp: string;
  table: string;
  maxSeats: number;
  buttonSeat: number;
  /** Every seat printed in the header, including any that never act. */
  seats: Seat[];
  /** Seats that took part, in preflop action order: SB, BB, UTG … BTN. */
  order: string[];
  /** player -> position label. */
  position: Record<string, string>;
  hero: string | null;
  heroCards: string[] | null;
  actions: Action[];
  board: string[];
  /** Streets actually dealt. */
  streets: Street[];
  uncalled: { player: string; amount: number } | null;
  collected: { player: string; amount: number }[];
  shows: Shown[];
  /** The printed "Total pot" figure. */
  totalPot: number;
  /** Pot recomputed from the actions; should equal `totalPot`. */
  computedPot: number;
  potMatches: boolean;
  /** player -> chips put in across the hand, net of any uncalled bet returned. */
  invested: Record<string, number>;
  /** player -> chips awarded. */
  won: Record<string, number>;
}

export interface ParseResult {
  hands: Hand[];
  /** Blocks that did not look like a tournament hand, with the reason. */
  skipped: { head: string; reason: string }[];
}

// ─── Line grammar ────────────────────────────────────────────────────────────

const HEADER =
  /^Poker Hand #([^:]+): Tournament #(\d+), (.+?) - Level(\d+)\(([\d,]+)\/([\d,]+)(?:\(([\d,]+)\))?\) - (.+)$/;
const TABLE = /^Table '(.+?)' (\d+)-max Seat #(\d+) is the button$/;
const SEAT = /^Seat (\d+): (.+?) \(([\d,]+) in chips\)$/;
const DEALT = /^Dealt to (.+?)(?: \[([^\]]+)\])?\s*$/;
const UNCALLED = /^Uncalled bet \(([\d,]+)\) returned to (.+)$/;
const COLLECTED = /^(.+?) collected ([\d,]+) from pot$/;
const TOTAL_POT = /^Total pot ([\d,]+)/;
const CARDS_GROUP = /\[([^\]]+)\]/g;

function num(s: string): number {
  return Number(s.replace(/,/g, ''));
}

function cards(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

/** Last bracketed group on a street marker line — the newly dealt card(s). */
function lastCardGroup(line: string): string[] {
  const groups = [...line.matchAll(CARDS_GROUP)];
  const last = groups.at(-1);
  return last ? cards(last[1]) : [];
}

// ─── Positions ───────────────────────────────────────────────────────────────

const LATE = ['LJ', 'HJ', 'CO', 'BTN'];

/**
 * Position labels for an n-handed pot, in preflop action order starting at the
 * small blind. 8-max gives SB, BB, UTG, UTG1, LJ, HJ, CO, BTN.
 */
export function positionNames(n: number): string[] {
  if (n <= 1) return ['BTN'];
  if (n === 2) return ['SB/BTN', 'BB'];
  const nonBlind = n - 2;
  const late = LATE.slice(Math.max(0, LATE.length - nonBlind));
  const early: string[] = [];
  for (let i = 0; i < nonBlind - late.length; i++) {
    early.push(i === 0 ? 'UTG' : `UTG${i}`);
  }
  return ['SB', 'BB', ...early, ...late];
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

interface RawAction {
  kind: ActionKind;
  amount: number;
  to?: number;
  allIn: boolean;
}

function parseActionBody(rest: string): RawAction | null {
  const allIn = / and is all-in$/.test(rest);
  const body = rest.replace(/ and is all-in$/, '');

  if (body === 'folds') return { kind: 'fold', amount: 0, allIn: false };
  if (body === 'checks') return { kind: 'check', amount: 0, allIn: false };

  let m = /^posts the ante ([\d,]+)$/.exec(body);
  if (m) return { kind: 'ante', amount: num(m[1]), allIn };
  m = /^posts small blind ([\d,]+)$/.exec(body);
  if (m) return { kind: 'sb', amount: num(m[1]), allIn };
  m = /^posts big blind ([\d,]+)$/.exec(body);
  if (m) return { kind: 'bb', amount: num(m[1]), allIn };
  m = /^calls ([\d,]+)$/.exec(body);
  if (m) return { kind: 'call', amount: num(m[1]), allIn };
  m = /^bets ([\d,]+)$/.exec(body);
  if (m) return { kind: 'bet', amount: num(m[1]), allIn };
  m = /^raises ([\d,]+) to ([\d,]+)$/.exec(body);
  if (m) return { kind: 'raise', amount: num(m[1]), to: num(m[2]), allIn };

  return null;
}

function parseHand(block: string): Hand | { error: string } {
  const lines = block.split(/\r?\n/);
  const head = HEADER.exec(lines[0]);
  if (!head) return { error: 'unrecognised header (cash games are not supported yet)' };

  const tbl = lines[1] ? TABLE.exec(lines[1]) : null;
  if (!tbl) return { error: 'missing table line' };

  const seats: Seat[] = [];
  const actions: Action[] = [];
  const collected: { player: string; amount: number }[] = [];
  const shows: Shown[] = [];
  const board: string[] = [];
  const streets: Street[] = ['preflop'];

  let hero: string | null = null;
  let heroCards: string[] | null = null;
  let uncalled: { player: string; amount: number } | null = null;
  let totalPot = 0;

  // Walking state.
  let street: Street = 'preflop';
  let pot = 0;
  let level = 0; // highest street commitment so far
  let committed: Record<string, number> = {};
  const invested: Record<string, number> = {};
  const stack: Record<string, number> = {};
  const acted = new Set<string>();
  let inSummary = false;

  for (const line of lines.slice(2)) {
    if (!line.trim()) continue;

    if (line.startsWith('*** ')) {
      if (line.startsWith('*** SUMMARY ***')) inSummary = true;
      else if (line.startsWith('*** FLOP ***')) street = 'flop';
      else if (line.startsWith('*** TURN ***')) street = 'turn';
      else if (line.startsWith('*** RIVER ***')) street = 'river';

      if (street !== 'preflop' && !inSummary && !streets.includes(street)) {
        streets.push(street);
        board.push(...lastCardGroup(line));
        level = 0;
        committed = {};
      }
      continue;
    }

    if (inSummary) {
      const tp = TOTAL_POT.exec(line);
      if (tp) totalPot = num(tp[1]);
      continue;
    }

    const seat = SEAT.exec(line);
    if (seat) {
      const s = { seat: Number(seat[1]), name: seat[2], chips: num(seat[3]) };
      seats.push(s);
      stack[s.name] = s.chips;
      continue;
    }

    const dealt = DEALT.exec(line);
    if (dealt) {
      if (dealt[2]) {
        hero = dealt[1];
        heroCards = cards(dealt[2]);
      }
      continue;
    }

    const unc = UNCALLED.exec(line);
    if (unc) {
      uncalled = { player: unc[2], amount: num(unc[1]) };
      pot -= uncalled.amount;
      invested[uncalled.player] = (invested[uncalled.player] ?? 0) - uncalled.amount;
      stack[uncalled.player] = (stack[uncalled.player] ?? 0) + uncalled.amount;
      continue;
    }

    // Player-prefixed lines. Resolve against known seat names so that a name
    // containing ": " cannot split in the wrong place.
    const owner = seats.find((s) => line.startsWith(`${s.name}: `))?.name;
    if (owner) {
      const rest = line.slice(owner.length + 2);

      const sh = /^shows \[([^\]]+)\](?: \((.+)\))?$/.exec(rest);
      if (sh) {
        shows.push({ player: owner, cards: cards(sh[1]), desc: sh[2] });
        continue;
      }
      if (rest === 'mucks hand' || rest === "doesn't show hand") continue;

      const a = parseActionBody(rest);
      if (!a) continue;

      const already = committed[owner] ?? 0;
      const added = a.kind === 'raise' ? (a.to ?? 0) - already : a.amount;
      const toCall = a.kind === 'ante' ? 0 : Math.max(0, level - already);

      actions.push({
        street,
        player: owner,
        kind: a.kind,
        amount: added,
        to: a.to,
        raiseBy: a.kind === 'raise' ? a.amount : undefined,
        allIn: a.allIn,
        potBefore: pot,
        toCall: Math.min(toCall, stack[owner] ?? toCall),
        stackBefore: stack[owner] ?? 0,
      });

      pot += added;
      invested[owner] = (invested[owner] ?? 0) + added;
      stack[owner] = (stack[owner] ?? 0) - added;
      if (a.kind !== 'ante') {
        committed[owner] = already + added;
        level = Math.max(level, committed[owner]);
      }
      acted.add(owner);
      continue;
    }

    const col = COLLECTED.exec(line);
    if (col && seats.some((s) => s.name === col[1])) {
      collected.push({ player: col[1], amount: num(col[2]) });
      continue;
    }
  }

  // Seats that took part, rotated so the seat left of the button comes first.
  const live = seats.filter((s) => acted.has(s.name));
  const sorted = [...live].sort((a, b) => a.seat - b.seat);
  const btnIdx = sorted.findIndex((s) => s.seat === Number(tbl[3]));
  const rotated =
    btnIdx < 0 ? sorted : [...sorted.slice(btnIdx + 1), ...sorted.slice(0, btnIdx + 1)];
  const labels = positionNames(rotated.length);
  const position: Record<string, string> = {};
  rotated.forEach((s, i) => {
    position[s.name] = labels[i] ?? '?';
  });

  const won: Record<string, number> = {};
  for (const c of collected) won[c.player] = (won[c.player] ?? 0) + c.amount;

  return {
    id: head[1],
    tournamentId: head[2],
    gameName: head[3],
    level: Number(head[4]),
    sb: num(head[5]),
    bb: num(head[6]),
    ante: head[7] ? num(head[7]) : 0,
    timestamp: head[8],
    table: tbl[1],
    maxSeats: Number(tbl[2]),
    buttonSeat: Number(tbl[3]),
    seats,
    order: rotated.map((s) => s.name),
    position,
    hero,
    heroCards,
    actions,
    board,
    streets,
    uncalled,
    collected,
    shows,
    totalPot,
    computedPot: pot,
    potMatches: pot === totalPot,
    invested,
    won,
  };
}

export function parseHands(text: string): ParseResult {
  const blocks = text
    .trim()
    .split(/\r?\n(?=Poker Hand #)/)
    .map((b) => b.trim())
    .filter(Boolean);

  const hands: Hand[] = [];
  const skipped: { head: string; reason: string }[] = [];

  for (const block of blocks) {
    const out = parseHand(block);
    if ('error' in out) skipped.push({ head: block.split('\n')[0].slice(0, 80), reason: out.error });
    else hands.push(out);
  }

  return { hands, skipped };
}
