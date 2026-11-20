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
  it('first skip costs about one well-played level', () => {
    expect(PERK_BASE.skip).toBe(SCORING.rewardBest);
  });
});
