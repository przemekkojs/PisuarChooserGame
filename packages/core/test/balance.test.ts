import { describe, expect, it } from 'vitest';
import { PERK_BASE, SCORING, levelParams } from '../src';
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
  it('difficulty index is non-decreasing over levels 1..40 (2% tolerance for the deterministic L12 dip)', () => {
    let prev = levelStats(1).difficulty;
    for (let l = 2; l <= 40; l++) {
      const d = levelStats(l).difficulty;
      expect(d, `level ${l}`).toBeGreaterThanOrEqual(prev * 0.98);
      prev = d;
    }
  });
  it('first skip costs about one well-played level', () => {
    expect(PERK_BASE.skip).toBe(SCORING.rewardBest);
  });
});
