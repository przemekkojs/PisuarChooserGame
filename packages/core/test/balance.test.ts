import { describe, expect, it } from 'vitest';
import { PERK_BASE, SCORING, createRng, generateBoard, levelParams } from '../src';
import { levelStats } from '../scripts/stats';

describe('balance invariants', () => {
  it('random free pick hits best >= 40% at level 1', () => {
    expect(levelStats(1, 100).pHit).toBeGreaterThanOrEqual(0.4);
  });
  it('random free pick hits best <= 20% at level 30', () => {
    expect(levelStats(30, 100).pHit).toBeLessThanOrEqual(0.2);
  });
  it('time never increases with level', () => {
    for (let l = 2; l <= 40; l++) {
      expect(levelParams(l).timeMs).toBeLessThanOrEqual(levelParams(l - 1).timeMs);
    }
  });
  it('difficulty index is non-decreasing over levels 1..60 (2% tolerance for deterministic dips)', () => {
    let prev = levelStats(1).difficulty;
    for (let l = 2; l <= 60; l++) {
      const d = levelStats(l).difficulty;
      expect(d, `level ${l}`).toBeGreaterThanOrEqual(prev * 0.98);
      prev = d;
    }
  });
  it('levels 1..60 give finite stats (no NaN)', () => {
    for (let l = 1; l <= 60; l++) {
      const s = levelStats(l, 20);
      for (const v of [s.pHit, s.expDelta, s.difficulty, s.timeMs, s.underOccupantPct]) {
        expect(Number.isFinite(v), `level ${l}`).toBe(true);
      }
    }
  });
  it('levels 10..40 have more people than floor effects (people >= wet + pee + 1)', () => {
    for (let l = 10; l <= 40; l++) {
      const p = levelParams(l);
      expect(p.people, `level ${l}`).toBeGreaterThanOrEqual(p.wet + p.pee + 1);
    }
  });
  it('on levels 10..40 at least 30% of boards have a floor effect under an occupant', () => {
    for (let l = 10; l <= 40; l++) {
      expect(levelStats(l, 100).underOccupantPct, `level ${l}`).toBeGreaterThanOrEqual(0.3);
    }
  });
  it('on levels 15..40 at least 40% of boards have a wet floor', () => {
    for (let l = 15; l <= 40; l++) {
      const p = levelParams(l);
      let wet = 0;
      for (let seed = 1; seed <= 200; seed++) {
        if (generateBoard(p, createRng(seed)).some((s) => s.floor === 'wet')) wet++;
      }
      expect(wet / 200, `level ${l}`).toBeGreaterThanOrEqual(0.4);
    }
  });
  it('first skip costs about one well-played level', () => {
    expect(PERK_BASE.skip).toBe(SCORING.rewardBest);
  });
});
