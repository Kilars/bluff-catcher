/**
 * Golden deals: the exact spots today's dealers produce for fixed seeds.
 *
 * Written before the cash format landed (PLAN-cash C0b) so that adding a
 * `format` to the dealers provably leaves every tournament deal — seat, hand,
 * cards, answer — byte-identical. `deal.test.ts`'s "same seed, same spot"
 * test compares the new code with itself and would not catch a changed RNG
 * call order; this one compares against a recorded fixture.
 *
 * If a deliberate dealer change moves these, regenerate the fixture and say
 * why in the commit.
 */

import { describe, it, expect } from 'vitest';
import { dealPreflopSpot } from './deal';
import { dealFacingSpot } from './facingDeal';
import { DEPTHS } from './ranges';

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

function rfiDigest(): string[] {
  const out: string[] = [];
  for (const depth of DEPTHS) {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = makeRng(seed);
      for (let i = 0; i < 3; i++) {
        const s = dealPreflopSpot({ rng, depth });
        out.push(`${depth}:${seed}:${i} ${s.position} ${s.cards.join('')} ${s.handClass} ${s.correct}`);
      }
    }
  }
  return out;
}

function facingDigest(): string[] {
  const out: string[] = [];
  for (let seed = 1; seed <= 20; seed++) {
    const rng = makeRng(seed);
    for (let i = 0; i < 3; i++) {
      const s = dealFacingSpot({ rng });
      out.push(`${seed}:${i} ${s.opener} ${s.bucket} ${s.cards.join('')} ${s.handClass} ${s.correct}${s.kind ? `/${s.kind}` : ''}`);
    }
  }
  return out;
}

describe('golden deals (tournament format)', () => {
  it('RFI dealer reproduces the recorded spots', () => {
    expect(rfiDigest()).toEqual(RFI_GOLDEN);
  });

  it('facing dealer reproduces the recorded spots', () => {
    expect(facingDigest()).toEqual(FACING_GOLDEN);
  });
});

// ─── Recorded fixture ────────────────────────────────────────────────────────

const RFI_GOLDEN: string[] = [
  'deep:1:0 UTG1 Ad5d A5s open',
  'deep:1:1 HJ AhQh AQs open',
  'deep:1:2 CO Ks2s K2s open',
  'deep:2:0 UTG1 Kc9h K9o fold',
  'deep:2:1 UTG KsQd KQo open',
  'deep:2:2 HJ Kd8d K8s open',
  'deep:3:0 UTG1 Qh9s Q9o fold',
  'deep:3:1 BTN Jd5c J5o fold',
  'deep:3:2 UTG1 As2h A2o fold',
  'deep:4:0 UTG1 Qh7s Q7o fold',
  'deep:4:1 HJ Ah9h A9s open',
  'deep:4:2 LJ Qs4c Q4o fold',
  'deep:5:0 UTG1 Ac3h A3o fold',
  'deep:5:1 UTG2 Kd8h K8o fold',
  'deep:5:2 UTG AdJs AJo open',
  'deep:6:0 UTG1 Th6s T6o fold',
  'deep:6:1 UTG 8c6d 86o fold',
  'deep:6:2 LJ Kd2s K2o fold',
  'deep:7:0 UTG1 Th4s T4o fold',
  'deep:7:1 CO As2s A2s open',
  'deep:7:2 UTG 7d2s 72o fold',
  'deep:8:0 UTG1 KsKc KK open',
  'deep:8:1 HJ 9c4c 94s fold',
  'deep:8:2 HJ 3c3d 33 open',
  'deep:9:0 UTG1 AhJd AJo open',
  'deep:9:1 UTG2 KhTd KTo open',
  'deep:9:2 BTN 7h4h 74s fold',
  'deep:10:0 UTG1 AhTc ATo open',
  'deep:10:1 UTG Td9s T9o fold',
  'deep:10:2 UTG2 Ad6s A6o fold',
  'deep:11:0 UTG1 Ad9c A9o fold',
  'deep:11:1 CO Kd9d K9s open',
  'deep:11:2 UTG Ac7c A7s open',
  'deep:12:0 UTG1 As5s A5s open',
  'deep:12:1 UTG As9c A9o fold',
  'deep:12:2 HJ Ah6c A6o fold',
  'mid:1:0 UTG1 QhJs QJo fold',
  'mid:1:1 UTG2 Jd2d J2s fold',
  'mid:1:2 UTG Qs7d Q7o fold',
  'mid:2:0 UTG1 Ac8h A8o fold',
  'mid:2:1 UTG JhTh JTs open',
  'mid:2:2 LJ Qc6h Q6o fold',
  'mid:3:0 UTG1 Ah7s A7o fold',
  'mid:3:1 BTN Kd3c K3o fold',
  'mid:3:2 UTG1 As2h A2o fold',
  'mid:4:0 UTG1 Kh6s K6o fold',
  'mid:4:1 HJ AsKd AKo open',
  'mid:4:2 HJ Td7d T7s open',
  'mid:5:0 UTG1 8s6s 86s fold',
  'mid:5:1 CO Td8s T8o fold',
  'mid:5:2 UTG Th5d T5o fold',
  'mid:6:0 UTG1 Th6s T6o fold',
  'mid:6:1 UTG 8c6d 86o fold',
  'mid:6:2 LJ Kd2s K2o fold',
  'mid:7:0 UTG1 Th4s T4o fold',
  'mid:7:1 CO Ad6h A6o open',
  'mid:7:2 BTN 9s8d 98o fold',
  'mid:8:0 UTG1 KsKc KK open',
  'mid:8:1 HJ 7c6c 76s open',
  'mid:8:2 HJ 3c3d 33 fold',
  'mid:9:0 UTG1 Kc9c K9s open',
  'mid:9:1 UTG QdJc QJo fold',
  'mid:9:2 UTG Kc9c K9s open',
  'mid:10:0 UTG1 Kd8d K8s open',
  'mid:10:1 UTG 2c2d 22 fold',
  'mid:10:2 HJ QdJs QJo open',
  'mid:11:0 UTG1 Kh7h K7s open',
  'mid:11:1 UTG Qc2c Q2s fold',
  'mid:11:2 UTG Js3s J3s fold',
  'mid:12:0 UTG1 QhJd QJo fold',
  'mid:12:1 HJ Ac6s A6o fold',
  'mid:12:2 UTG1 8d5c 85o fold',
  'short:1:0 UTG1 QhTs QTo fold',
  'short:1:1 UTG2 Jd2d J2s fold',
  'short:1:2 UTG Ks6d K6o fold',
  'short:2:0 UTG1 Kc8h K8o fold',
  'short:2:1 UTG KsTd KTo fold',
  'short:2:2 HJ Kd8d K8s open',
  'short:3:0 UTG1 Ac3c A3s open',
  'short:3:1 CO Qd6s Q6o fold',
  'short:3:2 UTG Jc6h J6o fold',
  'short:4:0 UTG1 Kh6s K6o fold',
  'short:4:1 HJ Ah9h A9s open',
  'short:4:2 LJ Js5c J5o fold',
  'short:5:0 UTG1 8s6s 86s fold',
  'short:5:1 CO Ad2s A2o fold',
  'short:5:2 UTG Th5d T5o fold',
  'short:6:0 UTG1 Th6s T6o fold',
  'short:6:1 UTG 8c6d 86o fold',
  'short:6:2 LJ Kd2s K2o fold',
  'short:7:0 UTG1 Th4s T4o fold',
  'short:7:1 CO Kd5h K5o fold',
  'short:7:2 BTN Ks3d K3o fold',
  'short:8:0 UTG1 KsKc KK open',
  'short:8:1 HJ 9c4c 94s fold',
  'short:8:2 HJ 3c3d 33 open',
  'short:9:0 UTG1 AhJd AJo open',
  'short:9:1 UTG2 Jc8c J8s fold',
  'short:9:2 UTG AhJs AJo open',
  'short:10:0 UTG1 KhTc KTo fold',
  'short:10:1 UTG Jd8s J8o fold',
  'short:10:2 UTG2 Ad6s A6o fold',
  'short:11:0 UTG1 Jh8h J8s fold',
  'short:11:1 UTG Td8h T8o fold',
  'short:11:2 UTG QhJd QJo fold',
  'short:12:0 UTG1 QhTd QTo fold',
  'short:12:1 HJ Jc8s J8o fold',
  'short:12:2 UTG1 8d5c 85o fold',
];
const FACING_GOLDEN: string[] = [
  '1:0 UTG early Kd2d K2s fold',
  '1:1 UTG early 9d2d 92s fold',
  '1:2 UTG1 early Ah6h A6s fold',
  '2:0 UTG early AdJc AJo 3bet/bluff',
  '2:1 UTG2 late Ah9c A9o fold',
  '2:2 HJ late Ts9d T9o fold',
  '3:0 UTG1 early 6c5c 65s fold',
  '3:1 UTG1 early Jh9d J9o fold',
  '3:2 UTG1 early AcQs AQo 3bet/bluff',
  '4:0 UTG1 early QcTs QTo fold',
  '4:1 UTG1 early 7s7d 77 call',
  '4:2 CO late Qh7h Q7s fold',
  '5:0 UTG1 early Ac7h A7o fold',
  '5:1 LJ late Ks7s K7s fold',
  '5:2 UTG1 early 7s7h 77 call',
  '6:0 UTG1 early 5c4h 54o fold',
  '6:1 UTG early 5s4d 54o fold',
  '6:2 CO late Kc5c K5s fold',
  '7:0 UTG1 early JcTd JTo fold',
  '7:1 UTG1 early As2h A2o fold',
  '7:2 UTG1 early 3d2d 32s fold',
  '8:0 UTG early Ac4d A4o fold',
  '8:1 HJ late 8c7c 87s call',
  '8:2 UTG2 late KsJs KJs call',
  '9:0 UTG early 3s2h 32o fold',
  '9:1 UTG early Ac9c A9s fold',
  '9:2 UTG early 6c5h 65o fold',
  '10:0 UTG early Js7h J7o fold',
  '10:1 UTG early Jc8c J8s fold',
  '10:2 UTG2 late Ad4h A4o fold',
  '11:0 UTG early As2h A2o fold',
  '11:1 CO late 5h5c 55 call',
  '11:2 UTG early 8h7s 87o fold',
  '12:0 UTG early TsTh TT call',
  '12:1 UTG1 early QdJd QJs call',
  '12:2 LJ late Ac8d A8o fold',
  '13:0 UTG early Ts5d T5o fold',
  '13:1 UTG early 4d3d 43s fold',
  '13:2 UTG early Td9h T9o fold',
  '14:0 UTG1 early KsJc KJo fold',
  '14:1 UTG2 late Ah2h A2s 3bet/bluff',
  '14:2 LJ late AhJh AJs call',
  '15:0 UTG1 early 5s5d 55 call',
  '15:1 UTG1 early 8h6h 86s fold',
  '15:2 UTG early JsTs JTs call',
  '16:0 UTG1 early 9h2h 92s fold',
  '16:1 UTG1 early Ah8s A8o fold',
  '16:2 HJ late 8h8c 88 call',
  '17:0 UTG1 early Kh9h K9s fold',
  '17:1 LJ late Js9c J9o fold',
  '17:2 UTG1 early Kh2d K2o fold',
  '18:0 UTG1 early AhQh AQs call',
  '18:1 UTG early 4s4h 44 call',
  '18:2 HJ late 4s3h 43o fold',
  '19:0 UTG early 7h6h 76s call',
  '19:1 UTG1 early QsJh QJo fold',
  '19:2 UTG1 early KdJc KJo fold',
  '20:0 UTG early QhJh QJs call',
  '20:1 HJ late 4c3d 43o fold',
  '20:2 HJ late 7h2c 72o fold',
];
