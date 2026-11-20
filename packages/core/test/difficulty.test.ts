import { describe, expect, it } from 'vitest';
import { createRng, levelParams, startDifficultyLevel } from '../src';

describe('createRng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const seq = (s: number) => {
      const r = createRng(s);
      return [r.next(), r.next(), r.next()];
    };
    expect(seq(1)).toEqual(seq(1));
    expect(seq(1)).not.toEqual(seq(2));
    const r = createRng(5);
    for (let i = 0; i < 200; i++) {
      const v = r.int(2, 4);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(4);
    }
  });
});

describe('levelParams', () => {
  it('starts at level 1', () => {
    expect(levelParams(1)).toEqual({
      urinals: 3,
      persons: 1,
      smellyPersons: 0,
      wet: 0,
      pee: 0,
      timeMs: 15000,
    });
  });
  it('clamps time and urinals', () => {
    expect(levelParams(1000).timeMs).toBe(3000);
    expect(levelParams(1000).urinals).toBeLessThanOrEqual(18);
  });
  it('is monotonic and respects limits over 1..200', () => {
    let prev = levelParams(1);
    for (let l = 2; l <= 200; l++) {
      const p = levelParams(l);
      expect(p.timeMs).toBeLessThanOrEqual(prev.timeMs);
      expect(p.urinals).toBeGreaterThanOrEqual(prev.urinals);
      expect(p.persons).toBeLessThanOrEqual(p.urinals - 2);
      expect(p.smellyPersons).toBeLessThanOrEqual(p.persons);
      expect(p.wet + p.pee).toBeLessThanOrEqual(p.urinals - p.persons);
      prev = p;
    }
  });
  it('maps difficulty to start level', () => {
    expect(startDifficultyLevel('easy')).toBe(1);
    expect(startDifficultyLevel('medium')).toBe(8);
    expect(startDifficultyLevel('hard')).toBe(15);
  });
});

describe('levelParams smelly mix', () => {
  it('always keeps a plain person when there are two or more', () => {
    for (let level = 1; level <= 300; level++) {
      const p = levelParams(level);
      expect(p.smellyPersons).toBeLessThanOrEqual(p.persons);
      if (p.persons >= 2) expect(p.smellyPersons).toBeLessThan(p.persons);
    }
  });
});

