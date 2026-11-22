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
      timeMs: 15000,
      people: 1,
      smelly: 0,
      shy: 0,
      splasher: 0,
      pairs: 0,
      outOfOrder: 0,
      wet: 0,
      pee: 0,
      dynamic: [],
      dynamicMax: 1,
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
      expect(p.people).toBeLessThanOrEqual(p.urinals - 2);
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
      expect(p.smelly).toBeLessThanOrEqual(p.people);
      if (p.people >= 2) expect(p.smelly).toBeLessThan(p.people);
    }
  });
});


describe('levelParams v2 budget', () => {
  it('people share, effect budget and sanity over 1..60', () => {
    for (let l = 1; l <= 60; l++) {
      const p = levelParams(l);
      const expected = Math.min(p.urinals - 2, Math.max(1, Math.round(p.urinals * 0.35)));
      expect(p.people, `level ${l}`).toBe(expected);
      expect(p.wet + p.pee).toBeLessThanOrEqual(Math.floor(p.people / 2));
      expect(p.smelly).toBeLessThanOrEqual(p.people);
      for (const v of Object.values(p)) if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
    }
  });
  it('sanitises NaN and negative levels to level 1', () => {
    expect(levelParams(NaN)).toEqual(levelParams(1));
    expect(levelParams(-5)).toEqual(levelParams(1));
  });
});

describe('levelParams v2 unlocks', () => {
  it('gates shy, splasher and outOfOrder by level and keeps a plain person', () => {
    for (let l = 1; l <= 200; l++) {
      const p = levelParams(l);
      if (l < 12) expect(p.shy).toBe(0);
      if (l < 16) expect(p.splasher).toBe(0);
      if (l < 9) expect(p.outOfOrder).toBe(0);
      if (p.people >= 2) expect(p.shy + p.splasher + p.smelly).toBeLessThanOrEqual(p.people - 1);
      expect(p.people + p.outOfOrder).toBeLessThanOrEqual(p.urinals - 2);
      expect(p.wet + p.pee).toBeLessThanOrEqual(Math.floor(p.people / 2));
      expect(p.wet + p.pee).toBeGreaterThanOrEqual(2 * p.splasher);
    }
    const p = levelParams(30);
    expect(p.shy).toBeGreaterThanOrEqual(1);
    expect(p.splasher).toBeGreaterThanOrEqual(1);
    expect(p.outOfOrder).toBeGreaterThanOrEqual(1);
  });
});

describe('levelParams pairs', () => {
  it('unlocks pairs at level 8 when the budget fits', () => {
    for (let l = 1; l <= 200; l++) {
      const p = levelParams(l);
      if (l < 8) expect(p.pairs).toBe(0);
      if (p.pairs === 1) {
        expect(p.urinals).toBeGreaterThanOrEqual(5);
        expect(p.people).toBeGreaterThanOrEqual(3);
        // pair takes 3 slots (2 people + gap); at least 2 stay free
        expect(p.urinals - (p.people + 1) - p.outOfOrder).toBeGreaterThanOrEqual(4);
        expect(p.shy + p.splasher + p.smelly).toBeLessThanOrEqual(p.people - 2);
      }
    }
    expect(levelParams(13).pairs).toBe(1);
  });
});

describe('levelParams dynamic events', () => {
  it('unlocks mop at 14, leave at 20, arrive at 24; two events from 30', () => {
    for (let l = 1; l <= 200; l++) {
      const p = levelParams(l);
      if (l < 14) expect(p.dynamic, `level ${l}`).toEqual([]);
      else if (l < 20) expect(p.dynamic, `level ${l}`).toEqual(['mop']);
      else if (l < 24) expect(p.dynamic, `level ${l}`).toEqual(['mop', 'leave']);
      else expect(p.dynamic, `level ${l}`).toEqual(['mop', 'leave', 'arrive']);
      expect(p.dynamicMax, `level ${l}`).toBe(l >= 30 ? 2 : 1);
    }
  });
});
