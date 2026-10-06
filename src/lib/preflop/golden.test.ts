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
  '1:0 UTG early KdQc KQo 3bet/bluff',
  '1:1 UTG early JdTs JTo fold',
  '1:2 UTG1 early AhTh ATs call',
  '2:0 UTG early AdQc AQo 3bet/bluff',
  '2:1 UTG2 late AhJc AJo call',
  '2:2 HJ late QsJd QJo fold',
  '3:0 UTG1 early Tc9s T9o fold',
  '3:1 UTG1 early Kh3h K3s fold',
  '3:2 UTG1 early 2h2c 22 call',
  '4:0 UTG1 early KcTs KTo fold',
  '4:1 UTG1 early 9s9d 99 call',
  '4:2 CO late Kh9c K9o fold',
  '5:0 UTG1 early AcJh AJo 3bet/bluff',
  '5:1 LJ late As2c A2o fold',
  '5:2 UTG1 early 9s9h 99 call',
  '6:0 UTG1 early 9c8h 98o fold',
  '6:1 UTG early 9s8d 98o fold',
  '6:2 CO late KcQh KQo call',
  '7:0 UTG1 early Kc6d K6o fold',
  '7:1 UTG1 early As5h A5o fold',
  '7:2 UTG1 early 7d5d 75s fold',
  '8:0 UTG early Ac9d A9o fold',
  '8:1 HJ late JcTd JTo fold',
  '8:2 UTG2 late As4c A4o fold',
  '9:0 UTG early 6s5s 65s fold',
  '9:1 UTG early AcJh AJo 3bet/bluff',
  '9:2 UTG early Tc8c T8s fold',
  '10:0 UTG early QsJh QJo fold',
  '10:1 UTG early QcJc QJs call',
  '10:2 UTG2 late Ad7h A7o fold',
  '11:0 UTG early As5h A5o fold',
  '11:1 CO late 7h7c 77 call',
  '11:2 UTG early Jh9h J9s call',
  '12:0 UTG early JsJh JJ call',
  '12:1 UTG1 early KdJd KJs call',
  '12:2 LJ late AcTd ATo 3bet/bluff',
  '13:0 UTG early Qs9s Q9s fold',
  '13:1 UTG early 8d7d 87s call',
  '13:2 UTG early QdTh QTo fold',
  '14:0 UTG1 early As3s A3s 3bet/bluff',
  '14:1 UTG2 late Ah5h A5s 3bet/bluff',
  '14:2 LJ late AhKs AKo 3bet/value',
  '15:0 UTG1 early 7s7d 77 call',
  '15:1 UTG1 early Jh9d J9o fold',
  '15:2 UTG early Ks8h K8o fold',
  '16:0 UTG1 early JhTs JTo fold',
  '16:1 UTG1 early AhJs AJo 3bet/bluff',
  '16:2 HJ late 9h9c 99 call',
  '17:0 UTG1 early Ah2s A2o fold',
  '17:1 LJ late Ks3s K3s fold',
  '17:2 UTG1 early KhJh KJs call',
  '18:0 UTG1 early 3s3c 33 call',
  '18:1 UTG early 6s6h 66 call',
  '18:2 HJ late 7s6s 76s call',
  '19:0 UTG early Jh8h J8s fold',
  '19:1 UTG1 early KsJh KJo fold',
  '19:2 UTG1 early Ad3c A3o fold',
  '20:0 UTG early KhJh KJs call',
  '20:1 HJ late 7c6c 76s call',
  '20:2 HJ late Th9c T9o fold',
];
