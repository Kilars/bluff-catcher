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
 *
 *  - Run-it-twice all-ins (cash) print per-run street markers: "*** FIRST FLOP
 *    *** [9h 7c 9c]", "*** SECOND TURN *** [9h 7c 9c] [9d]". The run starts at
 *    the street the money went in on, so the flop of a flop all-in is itself a
 *    FIRST FLOP, with the flop betting after it. The winner collects once per
 *    run. Every action happens before the runouts.
 */

export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;

/** Which game a hand is from. Tournaments and Rush & Cash share this parser and
 * every downstream stage; only the header grammar and the money format differ. */
export type GameVariant = 'mtt' | 'cash';

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
  /** Chips the player had to put in to continue (0 when checking was free),
   * capped at their stack. */
  toCall: number;
  /**
   * Set only when the player cannot match the bet in front of them: the part of
   * `potBefore` they can actually win. The rest is other players' chips above
   * this player's whole stack — a side pot, or an uncalled bet coming back — so
   * a capped `toCall` priced against `potBefore` reads far cheaper than it is.
   * Absent, the whole `potBefore` is in play; read it through `callablePot`.
   */
  potCallable?: number;
  /**
   * The mirror image of `potCallable`, for the bettor. Set only on a bet or raise
   * whose player outreaches every opponent still in the hand: how far the
   * deepest of them can still follow once it is in — their stack plus this
   * street's commitment, less the bettor's new commitment. Negative is the part
   * of the bet nobody can call, which can only come back uncalled, so sizing
   * reads the bet without it (`decisions.ts`). Absent, someone covers the bet.
   */
  coverBehind?: number;
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
  variant: GameVariant;
  /** '' for cash — Rush & Cash reseats every hand, so there is no tournament. */
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
  /** The board, as the first run dealt it on a run-it-twice hand. */
  board: string[];
  /**
   * Run-it-twice only: every run's full board, the first equal to `board`.
   * Absent on a hand dealt once. No action follows the runouts, so the
   * decisions read `board`; this is for the record.
   */
  runs?: string[][];
  /** Streets actually dealt (the first run's, on a run-it-twice hand). */
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
// Cash header: `Poker Hand #RC…: Hold'em No Limit ($0.25/$0.5) - <timestamp>`.
// No tournament, level, or ante; blinds are the only stake, in dollars.
const CASH_HEADER = /^Poker Hand #(\S+): Hold'em No Limit \(\$([\d.]+)\/\$([\d.]+)\) - (.+)$/;
const TABLE = /^Table '(.+?)' (\d+)-max Seat #(\d+) is the button$/;
// Amounts carry an optional `$` and decimals in cash, comma-grouped integers in
// tournaments; `num` normalises both (see below).
const SEAT = /^Seat (\d+): (.+?) \((\$?[\d,.]+) in chips\)$/;
const DEALT = /^Dealt to (.+?)(?: \[([^\]]+)\])?\s*$/;
const UNCALLED = /^Uncalled bet \((\$?[\d,.]+)\) returned to (.+)$/;
const COLLECTED = /^(.+?) collected (\$?[\d,.]+) from pot$/;
const TOTAL_POT = /^Total pot (\$?[\d,.]+)/;
// Promotional dead money seeded into the pot before the blinds (Rush & Cash).
const CASH_DROP = /^Cash Drop to Pot : total (\$?[\d,.]+)/;
// Run-it-twice street markers: the run's ordinal and the street.
const RUN_STREET = /^\*\*\* (FIRST|SECOND|THIRD) (FLOP|TURN|RIVER) \*\*\*/;
const RUN_INDEX: Record<string, number> = { FIRST: 0, SECOND: 1, THIRD: 2 };
const CARDS_GROUP = /\[([^\]]+)\]/g;

/** Splits an export into hand blocks. Exported so the split-hands sorter and the
 * parser agree on where one hand ends and the next begins. */
export const HAND_BLOCK_SPLIT = /\r?\n(?=Poker Hand #)/;

/** Dollars (as a bare decimal string) to whole cents: `0.5`→50, `117.77`→11777. */
function cents(dollars: string): number {
  return Math.round(parseFloat(dollars) * 100);
}

/**
 * A money token to its minor unit as an integer: tournament chips stay whole
 * chips, cash dollars become whole cents. Keyed on the `$` GGPoker prints only
 * in cash, which keeps every downstream sum — and the exact-equality pot
 * reconciliation — on integers. Comma grouping is stripped either way.
 */
function num(s: string): number {
  const t = s.replace(/,/g, '');
  return t.includes('$') ? cents(t.slice(1)) : Number(t);
}

/**
 * Which game a hand's header describes, or null if it is neither. Shared by the
 * parser and the `split-hands` sorter so both read the format the same way.
 */
export function detectVariant(headerLine: string): GameVariant | null {
  if (HEADER.test(headerLine)) return 'mtt';
  if (CASH_HEADER.test(headerLine)) return 'cash';
  return null;
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

/**
 * An action the player chose: not a forced post, and not a fold made with no
 * chips left. A blind or ante that takes the last chip is all-in, but GG prints
 * no "and is all-in" on a post — and then logs the player "folding" to the
 * action behind. GG means it: the poster is out, the raiser collects their
 * chips uncontested, and they are not in a later showdown. So the fold stays in
 * `actions` (the showdown and flop-seen facts read it), but there was nothing
 * to decide, so it is no decision to coach, count or print.
 */
export function isDecision(a: Action): boolean {
  if (a.kind === 'ante' || a.kind === 'sb' || a.kind === 'bb') return false;
  return !(a.kind === 'fold' && a.stackBefore === 0);
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

  let m = /^posts the ante (\$?[\d,.]+)$/.exec(body);
  if (m) return { kind: 'ante', amount: num(m[1]), allIn };
  m = /^posts small blind (\$?[\d,.]+)$/.exec(body);
  if (m) return { kind: 'sb', amount: num(m[1]), allIn };
  m = /^posts big blind (\$?[\d,.]+)$/.exec(body);
  if (m) return { kind: 'bb', amount: num(m[1]), allIn };
  m = /^calls (\$?[\d,.]+)$/.exec(body);
  if (m) return { kind: 'call', amount: num(m[1]), allIn };
  m = /^bets (\$?[\d,.]+)$/.exec(body);
  if (m) return { kind: 'bet', amount: num(m[1]), allIn };
  m = /^raises (\$?[\d,.]+) to (\$?[\d,.]+)$/.exec(body);
  if (m) return { kind: 'raise', amount: num(m[1]), to: num(m[2]), allIn };

  return null;
}

/**
 * Rotate the live seats into preflop action order and name them.
 *
 * The anchor is a *posted blind*, not the button's seat number, because the
 * seat number is not a reliable anchor in two common cases:
 *
 *  - **Heads-up the button IS the small blind.** `positionNames(2)` returns
 *    `['SB/BTN', 'BB']`, an array that starts at the small blind, but "the
 *    first live seat past the button" is the big blind when only two players
 *    remain. Anchoring on the seat number handed the button player `BB` and
 *    the big blind `SB/BTN` — exactly backwards, on every hand of every final
 *    table.
 *  - **A dead button with a dead small blind.** After a bust the button can
 *    sit on an empty seat with no small blind posted behind it. The first live
 *    seat past the button is then the *big* blind, so labelling it `SB` shifted
 *    every position in the hand by one — including the non-blind seats, which
 *    is how a fold from UTG came back as a fold from the big blind.
 *
 * The small blind is the anchor whenever one is posted, which is identical to
 * the old behaviour for every hand that has one: the first live seat past the
 * button *is* the small blind, live button or dead. When no small blind is
 * posted, the big blind anchors instead and the `SB` label is dropped, because
 * there is no player in that position to wear it.
 *
 * A hand with neither blind posted is not a hand we can read positions from,
 * so it falls back to the seat number and labels as best it can.
 */
function rotateToBlinds(
  sorted: Seat[],
  actions: Action[],
  btnSeat: number,
): { rotated: Seat[]; labels: string[] } {
  const poster = (kind: 'sb' | 'bb') => actions.find((a) => a.kind === kind)?.player ?? null;
  const rotate = (start: number) => [...sorted.slice(start), ...sorted.slice(0, start)];

  const sbIdx = sorted.findIndex((s) => s.name === poster('sb'));
  if (sbIdx >= 0) return { rotated: rotate(sbIdx), labels: positionNames(sorted.length) };

  const bbIdx = sorted.findIndex((s) => s.name === poster('bb'));
  if (bbIdx >= 0) {
    // Name the seats as though the empty small blind were still at the table,
    // then drop its label. Sizing the array to the live count instead would
    // walk every remaining seat one position closer to the button.
    return { rotated: rotate(bbIdx), labels: positionNames(sorted.length + 1).slice(1) };
  }

  const after = sorted.findIndex((s) => s.seat > btnSeat);
  return { rotated: rotate(after < 0 ? 0 : after), labels: positionNames(sorted.length) };
}

function parseHand(block: string): Hand | { error: string } {
  const lines = block.split(/\r?\n/);

  const mtt = HEADER.exec(lines[0]);
  const cash = mtt ? null : CASH_HEADER.exec(lines[0]);
  if (!mtt && !cash) return { error: 'unrecognised header (not a tournament or cash hand)' };

  const tbl = lines[1] ? TABLE.exec(lines[1]) : null;
  if (!tbl) return { error: 'missing table line' };

  const seats: Seat[] = [];
  const actions: Action[] = [];
  const collected: { player: string; amount: number }[] = [];
  const shows: Shown[] = [];
  const board: string[] = [];
  const streets: Street[] = ['preflop'];
  // Later runs' boards on a run-it-twice hand, by run index (1, 2).
  const laterRuns: string[][] = [];

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
  // Who can still match a bet: dealt in, and not folded. A seat printed in the
  // header but not dealt (sitting out) has chips that are not in play.
  const dealtIn = new Set<string>();
  const folded = new Set<string>();
  let inSummary = false;

  for (const line of lines.slice(2)) {
    if (!line.trim()) continue;

    if (line.startsWith('*** ')) {
      // The first run walks as the hand's own streets. A later run's line holds
      // its whole board so far (shared cards, then its own), and no action
      // follows it, so its last line is its full board.
      const run = RUN_STREET.exec(line);
      if (run && RUN_INDEX[run[1]] > 0) {
        laterRuns[RUN_INDEX[run[1]] - 1] = [...line.matchAll(CARDS_GROUP)].flatMap((g) => cards(g[1]));
        continue;
      }
      const marker = run ? `*** ${run[2]} ***` : line;

      if (marker.startsWith('*** SUMMARY ***')) inSummary = true;
      else if (marker.startsWith('*** FLOP ***')) street = 'flop';
      else if (marker.startsWith('*** TURN ***')) street = 'turn';
      else if (marker.startsWith('*** RIVER ***')) street = 'river';

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
      dealtIn.add(dealt[1]);
      if (dealt[2]) {
        hero = dealt[1];
        heroCards = cards(dealt[2]);
      }
      continue;
    }

    const drop = CASH_DROP.exec(line);
    if (drop) {
      // Nobody invested it, so it joins the pot (and the winner's take) but no
      // player's `invested`. Adding it here keeps `computedPot` equal to the
      // printed total; omitting it left every dropped hand short and dropped.
      pot += num(drop[1]);
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
      const post = a.kind === 'ante' || a.kind === 'sb' || a.kind === 'bb';

      // Chips this player could never win: everything any other player has in
      // this street above what this player's whole stack can reach. Earlier
      // streets are matched in full, or the player would already be all-in.
      const reach = already + (stack[owner] ?? Infinity);
      let excess = 0;
      if (toCall > 0 && reach < level) {
        for (const [p, c] of Object.entries(committed)) if (p !== owner) excess += Math.max(0, c - reach);
      }

      // The bettor's side of the same question: the most any opponent still in
      // can reach this street. An export prints every player's "Dealt to" line;
      // a hand-built one may print Hero's alone, so anyone who has acted counts
      // too, and with no other dealt line every seat does.
      let coverBehind: number | undefined;
      if (a.kind === 'bet' || a.kind === 'raise') {
        const inHand = (p: string) => dealtIn.size < 2 || dealtIn.has(p) || acted.has(p);
        const rivals = seats.filter((x) => x.name !== owner && !folded.has(x.name) && inHand(x.name));
        const cover = Math.max(0, ...rivals.map((x) => (committed[x.name] ?? 0) + (stack[x.name] ?? 0)));
        if (cover < reach) coverBehind = cover - (already + added);
      }

      actions.push({
        street,
        player: owner,
        kind: a.kind,
        amount: added,
        to: a.to,
        raiseBy: a.kind === 'raise' ? a.amount : undefined,
        allIn: a.allIn || (post && stack[owner] !== undefined && stack[owner] - added === 0),
        potBefore: pot,
        toCall: Math.min(toCall, stack[owner] ?? toCall),
        stackBefore: stack[owner] ?? 0,
        ...(excess > 0 ? { potCallable: pot - excess } : {}),
        ...(coverBehind !== undefined ? { coverBehind } : {}),
      });

      pot += added;
      invested[owner] = (invested[owner] ?? 0) + added;
      stack[owner] = (stack[owner] ?? 0) - added;
      if (a.kind !== 'ante') {
        committed[owner] = already + added;
        level = Math.max(level, committed[owner]);
      }
      acted.add(owner);
      if (a.kind === 'fold') folded.add(owner);
      continue;
    }

    const col = COLLECTED.exec(line);
    if (col && seats.some((s) => s.name === col[1])) {
      collected.push({ player: col[1], amount: num(col[2]) });
      continue;
    }
  }

  // Seats that took part, rotated into preflop action order.
  const live = seats.filter((s) => acted.has(s.name));
  const sorted = [...live].sort((a, b) => a.seat - b.seat);
  const { rotated, labels } = rotateToBlinds(sorted, actions, Number(tbl[3]));
  const position: Record<string, string> = {};
  rotated.forEach((s, i) => {
    position[s.name] = labels[i] ?? '?';
  });

  const won: Record<string, number> = {};
  for (const c of collected) won[c.player] = (won[c.player] ?? 0) + c.amount;

  // The two header shapes normalise to one set of fields. Cash has no
  // tournament, level, or ante; its stake is the blinds, in cents.
  const header = mtt
    ? {
        variant: 'mtt' as const,
        id: mtt[1],
        tournamentId: mtt[2],
        gameName: mtt[3],
        level: Number(mtt[4]),
        sb: num(mtt[5]),
        bb: num(mtt[6]),
        ante: mtt[7] ? num(mtt[7]) : 0,
        timestamp: mtt[8],
      }
    : {
        variant: 'cash' as const,
        id: cash![1],
        tournamentId: '',
        gameName: `Hold'em No Limit ($${cash![2]}/$${cash![3]})`,
        level: 0,
        sb: cents(cash![2]),
        bb: cents(cash![3]),
        ante: 0,
        timestamp: cash![4],
      };

  return {
    ...header,
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
    ...(laterRuns.length ? { runs: [board, ...laterRuns] } : {}),
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
    .split(HAND_BLOCK_SPLIT)
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
