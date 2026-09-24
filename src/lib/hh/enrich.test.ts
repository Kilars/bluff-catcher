import { describe, expect, it } from 'vitest';

import { enrich } from './enrich.ts';
import type { LabelledDecision } from './labels.ts';

/** enrich reads four fields; the rest of a LabelledDecision is irrelevant here. */
function dec(over: Partial<LabelledDecision>): LabelledDecision {
  return {
    sizing: null,
    facedSizing: null,
    spr: null,
    boardType: null,
    ...over,
  } as LabelledDecision;
}

describe('enrich', () => {
  it('turns Hero’s own bet size into alpha and the MDF it offers', () => {
    // A pot-sized bet needs to work half the time and asks the caller to defend
    // half; a half-pot bet needs 1/3 folds and offers a 2/3 defence.
    expect(enrich(dec({ sizing: 1 }))).toMatchObject({ alpha: 0.5, mdfOffered: 0.5 });
    expect(enrich(dec({ sizing: 0.5 }))).toMatchObject({ alpha: 0.33, mdfOffered: 0.67 });
  });

  it('turns the faced bet size into pot odds and Hero’s MDF', () => {
    // Facing a pot bet: call needs 1/3 equity, defend 1/2. Facing half-pot:
    // needs 1/4, defends 2/3.
    expect(enrich(dec({ facedSizing: 1 }))).toMatchObject({ requiredEquity: 0.33, mdf: 0.5 });
    expect(enrich(dec({ facedSizing: 0.5 }))).toMatchObject({ requiredEquity: 0.25, mdf: 0.67 });
  });

  it('leaves the other seat’s numbers null when no size was chosen or faced', () => {
    const e = enrich(dec({ sizing: 0.75 }));
    expect({ requiredEquity: e.requiredEquity, mdf: e.mdf }).toEqual({
      requiredEquity: null,
      mdf: null,
    });
    const f = enrich(dec({ facedSizing: 0.75 }));
    expect({ alpha: f.alpha, mdfOffered: f.mdfOffered }).toEqual({ alpha: null, mdfOffered: null });
  });

  it('buckets stack-to-pot commitment, and stays null with no pot', () => {
    expect(enrich(dec({ spr: 2 })).sprCommitment).toBe('committed');
    expect(enrich(dec({ spr: 4 })).sprCommitment).toBe('medium');
    expect(enrich(dec({ spr: 7 })).sprCommitment).toBe('deep');
    expect(enrich(dec({ spr: null })).sprCommitment).toBeNull();
  });

  it('reads the range edge from texture, and abstains on paired or monotone', () => {
    expect(enrich(dec({ boardType: 'dry-high-mine' })).boardFavoursPfa).toBe(true);
    expect(enrich(dec({ boardType: 'wet-high-mine' })).boardFavoursPfa).toBe(true);
    expect(enrich(dec({ boardType: 'middling-theirs' })).boardFavoursPfa).toBe(false);
    expect(enrich(dec({ boardType: 'paired' })).boardFavoursPfa).toBeNull();
    expect(enrich(dec({ boardType: 'monotone' })).boardFavoursPfa).toBeNull();
    expect(enrich(dec({ boardType: null })).boardFavoursPfa).toBeNull();
  });
});
