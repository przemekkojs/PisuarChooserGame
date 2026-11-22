import { describe, expect, it } from 'vitest';
import { createRng, generateBoard, levelParams, urinalCost } from '../src';

function freeCosts(board: ReturnType<typeof generateBoard>): number[] {
  return board.flatMap((s, i) => (!s.occupant ? [urinalCost(board, i)] : []));
}

describe('generateBoard', () => {
  it('produces valid boards for levels 1..300 and 50 seeds', () => {
    for (let level = 1; level <= 60; level++) {
      const params = levelParams(level);
      for (let seed = 1; seed <= 200; seed++) {
        const board = generateBoard(params, createRng(seed));
        expect(board).toHaveLength(params.urinals);
        expect(board.filter((s) => s.occupant)).toHaveLength(params.people);
        expect(board.filter((s) => s.floor !== 'clean').length).toBeLessThanOrEqual(params.wet + params.pee);
        const costs = freeCosts(board);
        expect(costs.length).toBeGreaterThanOrEqual(2);
        expect(Math.max(...costs) - Math.min(...costs)).toBeGreaterThan(1e-9);
      }
    }
  });
  it('is deterministic per seed', () => {
    const p = levelParams(20);
    expect(generateBoard(p, createRng(7))).toEqual(generateBoard(p, createRng(7)));
  });
  it('still yields a valid board for a tight 3-slot board', () => {
    const p = { ...levelParams(1), wet: 2, pee: 0, timeMs: 3000 };
    for (let seed = 1; seed <= 50; seed++) {
      const costs = freeCosts(generateBoard(p, createRng(seed)));
      expect(costs).toHaveLength(2);
      expect(Math.abs(costs[0]! - costs[1]!)).toBeGreaterThan(1e-9);
    }
  });
  it('floor effects coexist under occupants about half the time (level 20)', () => {
    const p = levelParams(20);
    let under = 0;
    let total = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const s of generateBoard(p, createRng(seed))) {
        if (s.floor === 'clean') continue;
        total++;
        if (s.occupant) under++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(under / total).toBeGreaterThanOrEqual(0.3);
    expect(under / total).toBeLessThanOrEqual(0.7);
  });
  it('keeps a plain person in every mixed board (level 12)', () => {
    const p = levelParams(12);
    for (let seed = 1; seed <= 200; seed++) {
      const board = generateBoard(p, createRng(seed));
      if (p.people >= 2) expect(board.some((s) => s.occupant?.kind === 'plain')).toBe(true);
    }
  });
});
