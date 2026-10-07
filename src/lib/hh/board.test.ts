import { describe, expect, it } from 'vitest';

import { boardType } from './board.ts';

const cards = (s: string): string[] => s.split(' ');

describe('boardType — every example docs/strategy-notes.md §2 Stage 1 names', () => {
  it.each([
    // Dry high-card, yours
    ['A-7-2r', 'dry-high-mine', 'As 7d 2c'],
    ['K-8-3r', 'dry-high-mine', 'Kh 8s 3d'],
    // Wet high-card, yours
    ['A♠-J♠-8♦', 'wet-high-mine', 'As Js 8d'],
    ['K♥-Q♥-4♣', 'wet-high-mine', 'Kh Qh 4c'],
    // Middling connected, theirs — the T-high and low-paired rows are the
    // ones the notes pin: "~25% on T-9-7".
    ['8-6-5r', 'middling-theirs', '8s 6d 5c'],
    ['T-9-7r', 'middling-theirs', 'Ts 9d 7c'],
    ['7-7-6', 'middling-theirs', '7s 7h 6d'],
    // Paired
    ['9-9-5', 'paired', '9s 9h 5d'],
    // Monotone
    ['♠♠♠', 'monotone', 'Ks 9s 4s'],
  ])('%s → %s', (_name, want, board) => {
    expect(boardType(cards(board))).toBe(want);
  });

  it('K-7-2-2 reads as its flop: the type is the flop texture on every street', () => {
    // The notes list K-7-2-2 under Paired, but that pair arrives on the turn.
    // boardType is flop-only by design (labels.ts carries it to every street),
    // so the flop K-7-2r is what it reports.
    expect(boardType(cards('Kh 7d 2c 2s'))).toBe('dry-high-mine');
  });
});

describe('boardType — edges', () => {
  it('returns null before the flop', () => {
    expect(boardType([])).toBeNull();
    expect(boardType(cards('As Kd'))).toBeNull();
  });

  it('reports a paired monotone flop as monotone', () => {
    expect(boardType(cards('9s 9s 5s'))).toBe('monotone');
  });

  it('keeps a T-high flop that is not connected out of middling', () => {
    // The notes only move *connected* T-high flops; T-6-2r stays where it was.
    expect(boardType(cards('Ts 6d 2c'))).toBe('dry-high-mine');
  });

  it('keeps a high paired flop paired even when the ranks touch', () => {
    // The 7-7-6 rule is for middling boards; J-J-T is a high card, not theirs.
    expect(boardType(cards('Js Jh Td'))).toBe('paired');
  });

  it('keeps a low pair with a gap paired: only touching ranks move', () => {
    // The notes name 7-7-6 (adjacent) and 9-9-5 (four apart); a gap in between
    // is not pinned, so it keeps the old bucket.
    expect(boardType(cards('8s 8h 6d'))).toBe('paired');
  });

  it('keeps a trips flop paired: it has no other card to touch', () => {
    expect(boardType(cards('7s 7h 7d'))).toBe('paired');
    expect(boardType(cards('Ts Th Td'))).toBe('paired');
  });

  it('leaves an unconnected low flop middling, as before', () => {
    expect(boardType(cards('9s 5d 2c'))).toBe('middling-theirs');
  });
});
